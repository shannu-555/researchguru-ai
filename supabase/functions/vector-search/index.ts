// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate embedding for query using Gemini API
async function generateQueryEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{ text }]
        }
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Embedding API error:', response.status, errorText);
    throw new Error(`Query embedding generation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.embedding?.values || [];
}

// Clean user query
function cleanQuery(query: string): string {
  return query
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, projectId, matchThreshold = 0.5, matchCount = 10 } = await req.json();
    
    console.log('Vector search query:', query, 'project:', projectId);

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured for vector search');
    }

    // Clean and embed the query
    const cleanedQuery = cleanQuery(query);
    const queryEmbedding = await generateQueryEmbedding(cleanedQuery, GEMINI_API_KEY);

    if (queryEmbedding.length === 0) {
      throw new Error('Failed to generate query embedding');
    }

    // Format embedding for PostgreSQL
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Perform similarity search using the database function
    const { data: matches, error: searchError } = await supabase
      .rpc('match_embeddings', {
        query_embedding: embeddingString,
        match_threshold: matchThreshold,
        match_count: matchCount,
        filter_project_id: projectId || null
      });

    if (searchError) {
      console.error('Vector search error:', searchError);
      throw searchError;
    }

    // Check if we have sufficient data
    const hasSufficientData = matches && matches.length >= 2;
    
    // Get unique content types found
    const contentTypes = [...new Set((matches || []).map((m: any) => m.content_type))];

    return new Response(JSON.stringify({ 
      success: true,
      matches: matches || [],
      hasSufficientData,
      contentTypes,
      query: cleanedQuery,
      matchCount: matches?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in vector search:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      matches: [],
      hasSufficientData: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
