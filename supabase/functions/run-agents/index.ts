// @ts-nocheck
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lovable AI Gateway configuration
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'Authorization header required' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create client with user's JWT to validate
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate user from JWT
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ 
        error: 'Invalid or expired token' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Authenticated user:', user.id);

    const { productName, companyName, description, projectId, userGeminiKey } = await req.json();
    
    // Validate that the user owns the project
    const { data: project, error: projectError } = await userSupabase
      .from('research_projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ 
        error: 'Project not found or access denied' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting agents for:', { productName, companyName, projectId });

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine which API to use - prioritize Lovable AI Gateway (more reliable)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') || null;
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || null;
    
    // Use Lovable AI as primary, fall back to user-provided Gemini key
    const geminiKey = userGeminiKey?.trim() || GEMINI_API_KEY;
    
    // Prioritize Lovable AI Gateway for reliability
    const useLovableAI = LOVABLE_API_KEY && LOVABLE_API_KEY.length > 0;
    const useGemini = !useLovableAI && geminiKey && geminiKey.length > 0;
    
    // Only validate Gemini API key if we're using it as primary
    if (useGemini) {
      const isValid = await validateGeminiKey(geminiKey);
      if (!isValid) {
        console.error('Gemini API key validation failed');
        return new Response(JSON.stringify({ 
          error: 'Invalid Gemini API key — update it in API Key Management.',
          diagnostics: { timestamp: new Date().toISOString(), errorCode: 'INVALID_API_KEY' }
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    console.log('Using API:', useLovableAI ? 'Lovable AI Gateway (primary)' : useGemini ? 'Gemini API Direct' : 'No API available');

    // Run all agents in parallel - pass Lovable API key as primary
    const [sentimentResult, competitorResult, trendResult] = await Promise.allSettled([
      runSentimentAgent(productName, companyName, description, useGemini ? geminiKey : null, LOVABLE_API_KEY),
      runCompetitorAgent(productName, companyName, description, useGemini ? geminiKey : null, LOVABLE_API_KEY),
      runTrendAgent(productName, companyName, description, useGemini ? geminiKey : null, LOVABLE_API_KEY),
    ]);

    // Store results in database
    const results = [];

    if (sentimentResult.status === 'fulfilled') {
      const { error } = await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'sentiment',
        status: 'completed',
        results: sentimentResult.value,
      });
      if (!error) results.push({ type: 'sentiment', data: sentimentResult.value });
    } else {
      console.error('Sentiment agent failed:', sentimentResult.reason);
      await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'sentiment',
        status: 'failed',
        error_message: getErrorMessage(sentimentResult.reason),
      });
    }

    if (competitorResult.status === 'fulfilled') {
      const { error } = await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'competitor',
        status: 'completed',
        results: competitorResult.value,
      });
      if (!error) results.push({ type: 'competitor', data: competitorResult.value });
    } else {
      console.error('Competitor agent failed:', competitorResult.reason);
      await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'competitor',
        status: 'failed',
        error_message: getErrorMessage(competitorResult.reason),
      });
    }

    if (trendResult.status === 'fulfilled') {
      const { error } = await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'trend',
        status: 'completed',
        results: trendResult.value,
      });
      if (!error) results.push({ type: 'trend', data: trendResult.value });
    } else {
      console.error('Trend agent failed:', trendResult.reason);
      await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'trend',
        status: 'failed',
        error_message: getErrorMessage(trendResult.reason),
      });
    }

    // Generate AI summary
    const summary = await generateAISummary(productName, companyName, results, LOVABLE_API_KEY);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      summary 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in run-agents:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getErrorMessage(error) {
  const message = error?.message || 'Unknown error';
  if (message.includes('429') || message.includes('quota') || message.includes('rate limit')) {
    return 'API rate limit exceeded. Please try again later or use a different API key.';
  }
  if (message.includes('401') || message.includes('403') || message.includes('invalid')) {
    return 'Invalid API Key. Please update your Gemini API key in settings.';
  }
  return message;
}

async function callLovableAI(prompt, systemPrompt, lovableApiKey) {
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const response = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI error:', response.status, errorText);
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 402) {
      throw new Error('Payment required. Please add credits to your workspace.');
    }
    throw new Error(`AI service error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Validate Gemini API key with a lightweight test
async function validateGeminiKey(geminiKey) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
      { method: 'GET' }
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function callGeminiDirect(prompt, geminiKey, retryCount = 0) {
  const maxRetries = 3;
  const backoffMs = Math.pow(2, retryCount) * 1000;
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    // Mask API key in logs
    console.error('Gemini API error:', response.status, errorText.substring(0, 200));
    
    if (response.status === 429 && retryCount < maxRetries) {
      console.log(`Rate limited, retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      return callGeminiDirect(prompt, geminiKey, retryCount + 1);
    }
    if (response.status === 429) {
      throw new Error('API rate limit exceeded after retries. Please try again later.');
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new Error('Invalid Gemini API key — update it in API Key Management.');
    }
    if (response.status === 404) {
      throw new Error('Gemini model not available. Service may be temporarily unavailable.');
    }
    throw new Error(`Gemini API error: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid response structure from Gemini');
  }
  return data.candidates[0].content.parts[0].text;
}

async function runSentimentAgent(productName, companyName, description, userGeminiKey, lovableApiKey) {
  console.log('Running sentiment agent for:', productName);
  
  const productContext = description ? `Product description: ${description}` : '';
  
  const prompt = `You are a sentiment analysis expert. Analyze the market sentiment for "${productName}" by ${companyName || 'the company'}.
${productContext}

IMPORTANT SCORING METHODOLOGY:
1. Overall Score Calculation (0-100):
   - Base score from general market reception: 50
   - Add/subtract based on: review ratings (+/-20), social media sentiment (+/-15), news coverage (+/-10), brand reputation (+/-5)
   - Weight product-specific keywords 40% higher in sentiment calculation
   
2. Sentiment Distribution (must sum to exactly 100%):
   - Analyze actual review distributions and social mentions
   - Positive: percentage of favorable mentions/reviews
   - Negative: percentage of critical mentions/reviews  
   - Neutral: percentage of balanced/informational mentions

3. Evidence Requirements:
   - Each theme must have supporting evidence from real sources
   - Include specific quotes or paraphrased feedback

Provide comprehensive analysis as JSON:
{
  "overallScore": <number 0-100, calculated using methodology above>,
  "scoreBreakdown": {
    "reviewRatings": <contribution from reviews -20 to +20>,
    "socialSentiment": <contribution from social -15 to +15>,
    "newsCoverage": <contribution from news -10 to +10>,
    "brandReputation": <contribution from brand -5 to +5>
  },
  "positive": <percentage, integer>,
  "negative": <percentage, integer>,
  "neutral": <percentage, integer>,
  "positiveThemes": [{"theme": "...", "evidence": "...", "strength": "strong/moderate/weak"}],
  "negativeThemes": [{"theme": "...", "evidence": "...", "strength": "strong/moderate/weak"}],
  "reviews": [{"rating": 1-5, "text": "...", "source": "..."}],
  "confidence": <0-100>,
  "confidenceLevel": "High/Medium/Low",
  "sourceDomains": ["domain1.com", "domain2.com"],
  "methodology": "Brief explanation of how score was calculated"
}

Only respond with valid JSON, no markdown or explanations.`;

  try {
    let content;
    if (lovableApiKey) {
      content = await callLovableAI(prompt, 'You are a market research analyst specializing in consumer sentiment. Calculate scores using the exact methodology provided. Always respond with valid JSON only.', lovableApiKey);
    } else if (userGeminiKey) {
      content = await callGeminiDirect('You are a market research analyst. Calculate scores using the exact methodology provided. ' + prompt, userGeminiKey);
    } else {
      throw new Error('No API key available');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize percentages to exactly 100
      const total = (result.positive || 0) + (result.negative || 0) + (result.neutral || 0);
      if (total !== 100 && total > 0) {
        const factor = 100 / total;
        result.positive = Math.round((result.positive || 0) * factor);
        result.negative = Math.round((result.negative || 0) * factor);
        result.neutral = 100 - result.positive - result.negative;
      }
      
      // Validate overall score is within bounds
      if (result.overallScore < 0) result.overallScore = 0;
      if (result.overallScore > 100) result.overallScore = 100;
      
      // Ensure confidence fields exist
      if (!result.confidence) {
        result.confidence = result.sourceDomains?.length > 2 ? 75 : result.sourceDomains?.length > 0 ? 55 : 35;
      }
      if (!result.confidenceLevel) {
        result.confidenceLevel = result.confidence >= 70 ? 'High' : result.confidence >= 40 ? 'Medium' : 'Low';
      }
      
      return result;
    }
    throw new Error('No valid JSON found in sentiment response');
  } catch (error) {
    console.error('Sentiment agent error:', error);
    return {
      overallScore: 50,
      positive: 40,
      negative: 30,
      neutral: 30,
      positiveThemes: [{ theme: 'Product features', evidence: 'General market feedback', strength: 'weak' }],
      negativeThemes: [{ theme: 'Data unavailable', evidence: 'Unable to fetch sentiment data', strength: 'weak' }],
      reviews: [],
      confidence: 15,
      confidenceLevel: 'Low',
      sourceDomains: [],
      _fallback: true,
      _error: error instanceof Error ? error.message : 'Unknown error',
      _diagnostics: 'Sentiment analysis unavailable — using fallback due to API error'
    };
  }
}

async function runCompetitorAgent(productName, companyName, description, userGeminiKey, lovableApiKey) {
  console.log('Running competitor agent for:', productName);
  
  const productContext = description ? `Product context: ${description}` : '';
  
  const prompt = `You are a competitive intelligence analyst. Identify and analyze the TOP REAL competitors for "${productName}" by ${companyName || 'the company'}.
${productContext}

CRITICAL REQUIREMENTS:
1. ONLY include REAL products that ACTUALLY EXIST and compete directly with this product
2. Research the EXACT product category - if it's wireless earbuds, find other wireless earbuds; if it's a smartphone, find other smartphones
3. Include competitors from the same price segment and market positioning
4. Prices must be realistic current market prices in USD

For "${productName}", identify 4-6 direct competitors with:
- name: The EXACT real product name (e.g., "Sony WF-C500", "JBL Tune 130NC", "Samsung Galaxy Buds FE")
- company: The actual manufacturer
- price: Current retail price in USD (format: "$XX.XX")
- priceRange: {"min": XX, "max": XX} if price varies
- rating: Average rating out of 5 from major retailers
- features: 4-5 key features that this product has
- advantages: 2-3 advantages over "${productName}"
- disadvantages: 2-3 disadvantages compared to "${productName}"
- targetMarket: Who this product is designed for
- marketPosition: "budget", "mid-range", or "premium"

Return as JSON:
{
  "competitors": [...],
  "productCategory": "<category of the analyzed product>",
  "marketSegment": "<price/market segment>",
  "analysisDate": "<current date>",
  "overallConfidence": <0-100>
}

Only respond with valid JSON, no markdown.`;

  try {
    let content;
    if (lovableApiKey) {
      content = await callLovableAI(prompt, 'You are a competitive intelligence analyst. Only provide verified, real competitor products. Always respond with valid JSON.', lovableApiKey);
    } else if (userGeminiKey) {
      content = await callGeminiDirect('You are a competitive intelligence analyst. Only provide verified, real competitor products. ' + prompt, userGeminiKey);
    } else {
      throw new Error('No API key available');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // Validate competitor data
      if (result.competitors && Array.isArray(result.competitors)) {
        result.competitors = result.competitors.map(comp => {
          // Clean price format
          let cleanPrice = comp.price;
          if (typeof cleanPrice === 'number') {
            cleanPrice = `$${cleanPrice.toFixed(2)}`;
          }
          
          // Calculate confidence for each competitor
          const hasPrice = cleanPrice && !String(cleanPrice).includes('unavailable');
          const hasFeatures = comp.features?.length >= 3;
          const hasRating = comp.rating && comp.rating > 0;
          const confidence = (hasPrice ? 40 : 0) + (hasFeatures ? 30 : 0) + (hasRating ? 30 : 0);
          
          return {
            ...comp,
            price: cleanPrice,
            confidenceLevel: confidence >= 70 ? 'High' : confidence >= 40 ? 'Medium' : 'Low'
          };
        });
        
        // Calculate overall confidence
        if (!result.overallConfidence) {
          result.overallConfidence = Math.round(
            result.competitors.reduce((sum, c) => {
              const conf = c.confidenceLevel === 'High' ? 85 : c.confidenceLevel === 'Medium' ? 55 : 25;
              return sum + conf;
            }, 0) / result.competitors.length
          );
        }
      }
      
      return result;
    }
    throw new Error('No valid JSON found in competitor response');
  } catch (error) {
    console.error('Competitor agent error:', error);
    return {
      competitors: [],
      productCategory: 'Unknown',
      marketSegment: 'Unknown',
      overallConfidence: 0,
      _fallback: true,
      _error: error instanceof Error ? error.message : 'Unknown error',
      _diagnostics: `Competitor analysis failed — ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function runTrendAgent(productName, companyName, description, userGeminiKey, lovableApiKey) {
  console.log('Running trend agent for:', productName);
  
  const currentDate = new Date().toISOString().split('T')[0];
  const productContext = description ? `Product context: ${description}` : '';
  
  const prompt = `Analyze current market trends for "${productName}" by ${companyName || 'the company'}.
${productContext}

CRITICAL REQUIREMENTS:
1. Provide GROUNDED trend analysis based on realistic market data
2. Include source evidence for trend claims
3. Calculate confidence score based on data availability

Provide a comprehensive trend analysis with:
1. Top Trending Keywords (5-10 product-specific keywords)
2. Emerging Topics (3-5 relevant topics with evidence)
3. Recent Market Mentions (3-5 specific, verifiable points)
4. Market Shift Analysis (grounded observation)
5. Industry Impact (2-4 evidence-based impacts)
6. Consumer Interest Patterns
7. Growth Metrics with confidence level
8. Future Predictions (3 grounded predictions)
9. 12-Month Trend Data
10. Source domains used for analysis
11. Evidence snippets supporting key claims

Return ONLY a valid JSON object with this structure:
{
  "trendScore": <number 0-100>,
  "growthRate": <number percentage>,
  "keywords": [<array of 5-10 keyword strings>],
  "emergingTopics": [<array of 3-5 topic strings>],
  "recentMentions": [<array of 3-5 mention strings>],
  "marketShift": "<analysis string>",
  "industryImpact": [<array of 2-4 impact strings>],
  "demandPattern": "<rising|stable|declining>",
  "insights": [<array of 3-5 insight strings>],
  "predictions": [<array of 3 prediction strings>],
  "monthlyData": [<array of 12 objects with {month: string, value: number}>],
  "analysisDate": "${currentDate}",
  "confidence": <number 0-100>,
  "confidenceLevel": "<High|Medium|Low>",
  "sourceDomains": [<array of source domain strings>],
  "evidenceSnippets": [<array of supporting evidence strings>]
}

If evidence is weak, mark confidence as Low and include disclaimer.
Only respond with valid JSON, no markdown.`;

  try {
    let content;
    if (lovableApiKey) {
      content = await callLovableAI(prompt, 'You are a market trend analyst. Provide grounded analysis. Always respond with valid JSON.', lovableApiKey);
    } else if (userGeminiKey) {
      content = await callGeminiDirect('You are a market trend analyst. Provide grounded, evidence-based analysis. ' + prompt, userGeminiKey);
    } else {
      throw new Error('No API key available');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // Ensure confidence fields exist
      if (!result.confidence) {
        result.confidence = result.sourceDomains?.length > 0 ? 65 : 40;
      }
      if (!result.confidenceLevel) {
        result.confidenceLevel = result.confidence >= 70 ? 'High' : result.confidence >= 40 ? 'Medium' : 'Low';
      }
      
      return result;
    }
    throw new Error('No JSON found');
  } catch (error) {
    console.error('Trend agent error:', error);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const baseValue = 60 + Math.random() * 20;
    return {
      trendScore: 75,
      growthRate: 12,
      keywords: ['market growth', 'consumer demand', 'product innovation', 'competitive landscape', 'value proposition'],
      emergingTopics: ['Increased focus on product quality', 'Growing competitive pressure', 'Shift towards value-for-money'],
      recentMentions: ['Product category showing steady interest', 'Consumer reviews highlighting key attributes'],
      marketShift: 'The market shows moderate growth with increasing consumer awareness.',
      industryImpact: ['Consumer electronics sector', 'E-commerce platforms'],
      demandPattern: 'rising',
      insights: ['Market interest is gradually increasing', 'Consumer expectations are evolving'],
      predictions: ['Market expected to grow steadily', 'Increased product differentiation', 'Growing emphasis on customer experience'],
      monthlyData: months.map((month, i) => ({ month, value: Math.round(baseValue + (i * 2) + (Math.random() * 8 - 4)) })),
      analysisDate: new Date().toISOString().split('T')[0],
      _fallback: true,
      _error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function generateAISummary(productName, companyName, results, lovableApiKey) {
  console.log('Generating AI summary');
  
  const prompt = `Based on the following market research results for "${productName}" by ${companyName || 'the company'}, provide a brief executive summary (2-3 sentences):
  
  Results: ${JSON.stringify(results, null, 2)}
  
  Focus on key insights and actionable recommendations.`;

  try {
    let content;
    if (lovableApiKey) {
      content = await callLovableAI(prompt, 'You are a business analyst. Provide concise executive summaries.', lovableApiKey);
    } else {
      const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || null;
      if (GEMINI_API_KEY) {
        content = await callGeminiDirect('You are a business analyst. Provide concise executive summaries. ' + prompt, GEMINI_API_KEY);
      } else {
        return 'Executive summary generation unavailable.';
      }
    }
    return content;
  } catch (error) {
    console.error('Summary generation error:', error);
    return 'Executive summary generation unavailable due to API error.';
  }
}
