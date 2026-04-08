import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const researchSchema = z.object({
  productName: z.string().min(1).max(200).trim(),
  companyName: z.string().max(200).trim().optional().nullable(),
  description: z.string().max(2000).trim().optional().nullable(),
  mode: z.enum(['quick', 'deep']).default('quick'),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.json();
    const validationResult = researchSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return new Response(JSON.stringify({
        error: 'Invalid input',
        details: validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { productName, companyName, description, mode } = validationResult.data;

    // Try user's own Gemini key first, then fall back to server secret
    let geminiApiKey: string | undefined;
    const { data: userKey } = await supabase
      .from('user_api_keys')
      .select('key_value')
      .eq('user_id', user.id)
      .eq('key_name', 'GEMINI_API_KEY')
      .single();

    if (userKey?.key_value) {
      geminiApiKey = userKey.key_value;
    } else {
      geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    }

    if (!geminiApiKey) {
      return new Response(JSON.stringify({
        error: 'Gemini API key not configured. Please add your API key in Settings or configure it in your research settings.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isQuickMode = mode === 'quick';
    const model = isQuickMode ? 'gemini-2.5-flash-preview-05-20' : 'gemini-2.5-pro-preview-05-06';

    const systemPrompt = isQuickMode
      ? `You are a market research assistant. Provide BRIEF, CONCISE summaries. Keep responses short with bullet points. Focus on key facts only. Maximum 3-4 sentences per section.`
      : `You are an expert market research analyst. Provide COMPREHENSIVE, DETAILED analysis with full explanations, data points, market context, competitive landscape details, and thorough insights. Include specific numbers, percentages, and concrete examples where possible.`;

    const userPrompt = `Analyze the product/company: "${productName}"${companyName ? ` by ${companyName}` : ''}${description ? `. Additional context: ${description}` : ''}.

Provide a structured analysis with these sections:
1. MARKET OVERVIEW: ${isQuickMode ? 'Brief market position' : 'Detailed market analysis, size, growth trajectory, and positioning'}
2. SENTIMENT ANALYSIS: ${isQuickMode ? 'Quick sentiment summary' : 'Comprehensive sentiment breakdown with sources and evidence'}
3. COMPETITIVE LANDSCAPE: ${isQuickMode ? 'Top 3 competitors with prices' : 'Full competitive analysis with pricing, features, market share'}
4. TRENDS: ${isQuickMode ? 'Key trend highlights' : 'Detailed trend analysis with predictions and market shifts'}
5. KEY INSIGHTS: ${isQuickMode ? '3 main takeaways' : 'Comprehensive insights with actionable recommendations'}
6. LIMITATIONS: List any data gaps, uncertainties, or areas where information was limited
7. SUGGESTIONS: Recommend what additional research or data would improve this analysis

IMPORTANT: Respond ONLY with valid JSON (no markdown, no code blocks). Use this exact structure:
{
  "marketOverview": "...",
  "sentimentSummary": { "overall": "positive/neutral/negative", "confidence": 0-100, "details": "..." },
  "competitors": [{ "name": "...", "price": "...", "rating": "...", "keyDifference": "..." }],
  "trends": ["..."],
  "keyInsights": ["..."],
  "limitations": ["..."],
  "suggestions": ["..."],
  "sources": ["..."]
}`;

    console.log(`Running ${mode} mode Gemini research (${model}) for: ${productName}`);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: isQuickMode ? 2000 : 8000,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);

      if (response.status === 400 || response.status === 403) {
        return new Response(JSON.stringify({
          error: 'Invalid Gemini API key or insufficient permissions. Please update your key in Settings.',
          details: errorText
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        error: `Gemini API error: ${response.status}`,
        details: errorText
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return new Response(JSON.stringify({ error: 'No response from Gemini' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsedResult;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsedResult = JSON.parse(jsonStr);
    } catch {
      parsedResult = {
        marketOverview: content,
        sentimentSummary: { overall: "unknown", confidence: 50, details: "Could not parse structured data" },
        competitors: [],
        trends: [],
        keyInsights: [content.substring(0, 500)],
        limitations: ["Response was not in expected format"],
        suggestions: ["Try running the analysis again"],
        sources: []
      };
    }

    console.log(`Gemini research completed for: ${productName}`);

    return new Response(JSON.stringify({
      success: true,
      mode,
      data: parsedResult,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Gemini research error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'Please check your Gemini API key configuration and try again'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
