import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { productName, currency } = await req.json();
    if (!productName) {
      return new Response(JSON.stringify({ error: 'Product name required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const curr = currency || 'USD';
    const prompt = `You are a price comparison engine. Analyze pricing for "${productName}" across major retailers.

Return JSON with this structure:
{
  "productName": "${productName}",
  "currency": "${curr}",
  "analyzedAt": "${new Date().toISOString()}",
  "retailers": [
    {
      "name": "<retailer name e.g. Amazon, Best Buy, Walmart, Flipkart>",
      "price": <number>,
      "originalPrice": <number or null if no discount>,
      "discount": <percentage or null>,
      "inStock": <boolean>,
      "shippingCost": <number>,
      "deliveryDays": <number>,
      "sellerRating": <number 0-5>,
      "url": "<realistic product URL>",
      "lastUpdated": "${new Date().toISOString()}"
    }
  ],
  "priceHistory": {
    "last30Days": [
      {"date": "<YYYY-MM-DD>", "price": <number>, "retailer": "<name>"}
    ],
    "last6Months": [
      {"month": "<Mon YYYY>", "avgPrice": <number>, "minPrice": <number>, "maxPrice": <number>}
    ]
  },
  "priceAnalysis": {
    "currentBestPrice": <number>,
    "bestRetailer": "<name>",
    "averagePrice": <number>,
    "priceRange": {"min": <number>, "max": <number>},
    "priceVolatility": "<low|medium|high>",
    "recommendation": "<buy now / wait for sale / price dropping>",
    "expectedSaleDate": "<upcoming sale event or null>",
    "savingsOpportunity": <percentage potential savings>
  },
  "similarProducts": [
    {
      "name": "<product name>",
      "price": <number>,
      "rating": <number>,
      "valuScore": <0-100>
    }
  ]
}

Only return valid JSON.`;

    const response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a price comparison engine. Return realistic pricing data as JSON.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Invalid response from price engine');
    }

    const result = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Price comparison error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Price comparison failed' 
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
