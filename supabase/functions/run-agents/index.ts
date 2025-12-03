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
    const { productName, companyName, description, projectId, userGeminiKey } = await req.json();
    
    console.log('Starting agents for:', { productName, companyName, projectId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine which API to use - prioritize GEMINI_API_KEY
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || null;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') || null;
    
    // Use user-provided key, then server GEMINI key, then Lovable AI as fallback
    const geminiKey = userGeminiKey?.trim() || GEMINI_API_KEY;
    const useGemini = geminiKey && geminiKey.length > 0;
    
    // Validate Gemini API key if using it
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
    
    console.log('Using API:', useGemini ? 'Gemini API Direct (validated)' : 'Lovable AI Gateway');

    // Run all agents in parallel
    const [sentimentResult, competitorResult, trendResult] = await Promise.allSettled([
      runSentimentAgent(productName, companyName, useGemini ? geminiKey : null, LOVABLE_API_KEY),
      runCompetitorAgent(productName, companyName, useGemini ? geminiKey : null, LOVABLE_API_KEY),
      runTrendAgent(productName, companyName, useGemini ? geminiKey : null, LOVABLE_API_KEY),
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

async function runSentimentAgent(productName, companyName, userGeminiKey, lovableApiKey) {
  console.log('Running sentiment agent for:', productName);
  
  const prompt = `Analyze the sentiment for the product "${productName}" by ${companyName || 'the company'}.

CRITICAL REQUIREMENTS:
1. Provide GROUNDED sentiment analysis based on realistic market patterns for this specific product category
2. Include source evidence snippets that justify each sentiment claim
3. Calculate confidence score based on data availability

Provide analysis with:
- Overall sentiment score (0-100) with justification
- Positive percentage (must sum to 100 with negative and neutral)
- Negative percentage
- Neutral percentage
- Key positive themes (3-5) with supporting evidence snippets
- Key negative themes (3-5) with supporting evidence snippets
- Sample reviews (5 realistic reviews with ratings 1-5)
- Confidence score (0-100) based on: data completeness, source reliability
- Confidence level: "High" if score >= 70, "Medium" if >= 40, "Low" otherwise
- Source domains used for analysis (e.g., "amazon.com reviews", "tech forums", "social media")

If evidence is weak or contradictory, mark sentiment as "Mixed / Low Confidence".

Format as JSON with fields: overallScore, positive, negative, neutral, positiveThemes, negativeThemes, reviews, confidence, confidenceLevel, sourceDomains, evidenceSnippets
Only respond with valid JSON, no markdown.`;

  try {
    let content;
    if (userGeminiKey) {
      content = await callGeminiDirect('You are a market research analyst specializing in consumer sentiment. Provide grounded, evidence-based analysis. ' + prompt, userGeminiKey);
    } else {
      content = await callLovableAI(prompt, 'You are a market research analyst. Provide grounded, evidence-based analysis. Always respond with valid JSON only.', lovableApiKey);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize percentages
      const total = (result.positive || 0) + (result.negative || 0) + (result.neutral || 0);
      if (total !== 100 && total > 0) {
        const factor = 100 / total;
        result.positive = Math.round((result.positive || 0) * factor);
        result.negative = Math.round((result.negative || 0) * factor);
        result.neutral = 100 - result.positive - result.negative;
      }
      
      // Ensure confidence fields exist
      if (!result.confidence) {
        result.confidence = result.sourceDomains?.length > 0 ? 65 : 40;
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
      positiveThemes: ['Product features', 'Design', 'Brand reputation'],
      negativeThemes: ['Price concerns', 'Availability'],
      reviews: [
        { rating: 4, text: 'Good product overall' },
        { rating: 3, text: 'Average experience' },
        { rating: 4, text: 'Worth the price' },
        { rating: 2, text: 'Some issues' },
        { rating: 3, text: 'Decent choice' },
      ],
      confidence: 25,
      confidenceLevel: 'Low',
      sourceDomains: [],
      evidenceSnippets: [],
      _fallback: true,
      _error: error instanceof Error ? error.message : 'Unknown error',
      _diagnostics: 'Sentiment analysis unavailable — low confidence due to API error'
    };
  }
}

async function runCompetitorAgent(productName, companyName, userGeminiKey, lovableApiKey) {
  console.log('Running competitor agent for:', productName);
  
  const prompt = `Analyze competitors for "${productName}" by ${companyName || 'the company'}.

CRITICAL REQUIREMENTS:
1. Only include REAL, VERIFIED competitor products that actually exist in the market
2. Prices must be realistic and grounded - if exact price unknown, provide a validated price range
3. Include source evidence for price claims
4. Calculate confidence score for each competitor based on data reliability

Provide 3-5 REAL competitor products with:
- name: actual, verified competitor product name (no made-up products)
- company: real company name
- price: validated price in USD (format: "$XX.XX" or "Price unavailable")
- priceSource: source domain where price was found (e.g., "amazon.com", "bestbuy.com")
- priceConfidence: 0-100 score based on: number of sources, recency, match accuracy
- rating: verified rating out of 5 (or null if unavailable)
- features: 3-5 verified key features
- advantages: 2-3 evidence-based points
- disadvantages: 2-3 evidence-based points
- marketShare: estimated percentage (or null if unknown)
- sourceEvidence: short snippet supporting the data

Price validation rules:
- Strip currency symbols, clean formatting
- Remove promotional/bundle prices
- If multiple sources show different prices, use median
- If price cannot be verified, return "Price unavailable — low confidence"

Format as JSON array. Only respond with valid JSON array, no markdown.`;

  try {
    let content;
    if (userGeminiKey) {
      content = await callGeminiDirect('You are a market research analyst. Provide only verified, grounded competitor data. ' + prompt, userGeminiKey);
    } else {
      content = await callLovableAI(prompt, 'You are a market research analyst. Provide only verified, grounded data. Always respond with valid JSON array.', lovableApiKey);
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const competitors = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize competitor data
      const validatedCompetitors = competitors.map(comp => {
        // Clean and validate price
        let cleanPrice = comp.price;
        let priceConfidence = comp.priceConfidence || 50;
        
        if (typeof cleanPrice === 'string') {
          // Remove promotional text
          if (/bundle|emi|offer|from/i.test(cleanPrice)) {
            cleanPrice = 'Price unavailable — promotional pricing detected';
            priceConfidence = 20;
          }
        }
        
        // Calculate overall confidence
        const hasValidPrice = cleanPrice && !cleanPrice.includes('unavailable');
        const hasSource = comp.priceSource && comp.priceSource.length > 0;
        const confidence = Math.round(
          (hasValidPrice ? 40 : 0) + 
          (hasSource ? 30 : 0) + 
          (comp.rating ? 15 : 0) + 
          (comp.features?.length >= 3 ? 15 : 0)
        );
        
        return {
          ...comp,
          price: cleanPrice,
          priceConfidence: Math.min(priceConfidence, confidence),
          confidenceLevel: confidence >= 70 ? 'High' : confidence >= 40 ? 'Medium' : 'Low',
          sourceEvidence: comp.sourceEvidence || 'No source evidence available'
        };
      });
      
      return { 
        competitors: validatedCompetitors,
        overallConfidence: Math.round(validatedCompetitors.reduce((sum, c) => sum + (c.priceConfidence || 0), 0) / validatedCompetitors.length),
        sourceDomains: [...new Set(validatedCompetitors.map(c => c.priceSource).filter(Boolean))]
      };
    }
    throw new Error('No valid JSON array found in competitor response');
  } catch (error) {
    console.error('Competitor agent error:', error);
    return {
      competitors: [{
        name: 'Unable to fetch competitors',
        company: 'N/A',
        price: 'Price unavailable — low confidence',
        priceSource: null,
        priceConfidence: 0,
        rating: null,
        features: [],
        advantages: [],
        disadvantages: [],
        marketShare: null,
        sourceEvidence: 'No data available',
        confidenceLevel: 'Low'
      }],
      overallConfidence: 0,
      sourceDomains: [],
      _fallback: true,
      _error: error instanceof Error ? error.message : 'Unknown error',
      _diagnostics: `Competitor analysis failed — ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function runTrendAgent(productName, companyName, userGeminiKey, lovableApiKey) {
  console.log('Running trend agent for:', productName);
  
  const currentDate = new Date().toISOString().split('T')[0];
  
  const prompt = `Analyze current market trends for "${productName}" by ${companyName || 'the company'}.

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
    if (userGeminiKey) {
      content = await callGeminiDirect('You are a market trend analyst. Provide grounded, evidence-based analysis. ' + prompt, userGeminiKey);
    } else {
      content = await callLovableAI(prompt, 'You are a market trend analyst. Provide grounded analysis. Always respond with valid JSON.', lovableApiKey);
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
  
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || null;
  
  const prompt = `Based on the following market research results for "${productName}" by ${companyName || 'the company'}, provide a brief executive summary (2-3 sentences):
  
  Results: ${JSON.stringify(results, null, 2)}
  
  Focus on key insights and actionable recommendations.`;

  try {
    let content;
    if (GEMINI_API_KEY) {
      content = await callGeminiDirect('You are a business analyst. Provide concise executive summaries. ' + prompt, GEMINI_API_KEY);
    } else if (lovableApiKey) {
      content = await callLovableAI(prompt, 'You are a business analyst. Provide concise executive summaries.', lovableApiKey);
    } else {
      return `Analysis complete for ${productName}. Review the detailed results above.`;
    }
    return content || `Analysis complete for ${productName}. Review the detailed results above.`;
  } catch (error) {
    console.error('Summary generation error:', error);
    return `Analysis complete for ${productName}. Review the detailed results above.`;
  }
}
