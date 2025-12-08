// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Text chunking utility
function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  
  if (words.length <= chunkSize) {
    return [text];
  }
  
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(' '));
    start = end - overlap;
    if (start >= words.length - overlap) break;
  }
  
  return chunks;
}

// Generate embeddings using Gemini API
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
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
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.embedding?.values || [];
}

// Preprocess and clean text
function preprocessText(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?;:'"()-]/g, '')
    .trim()
    .slice(0, 10000); // Limit text length
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, agentResults, runId } = await req.json();
    
    console.log('Generating embeddings for project:', projectId, 'run:', runId);

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured for embeddings');
    }

    const embeddings: any[] = [];
    
    // Process each agent result
    for (const result of agentResults) {
      const { type, data, resultId } = result;
      
      // Convert agent data to text chunks
      let textContent = '';
      
      if (type === 'sentiment') {
        textContent = `Sentiment Analysis:
Overall Score: ${data.overallScore || 'N/A'}
Positive: ${data.positive}% Negative: ${data.negative}% Neutral: ${data.neutral}%
Positive Themes: ${(data.positiveThemes || []).join(', ')}
Negative Themes: ${(data.negativeThemes || []).join(', ')}
Reviews: ${(data.reviews || []).map((r: any) => r.text).join(' ')}
Evidence: ${(data.evidenceSnippets || []).join(' ')}`;
      } else if (type === 'competitor') {
        const competitors = data.competitors || [];
        textContent = `Competitor Analysis:
${competitors.map((c: any) => `
Product: ${c.name}
Company: ${c.company}
Price: ${c.price}
Rating: ${c.rating}/5
Features: ${(c.features || []).join(', ')}
Advantages: ${(c.advantages || []).join(', ')}
Disadvantages: ${(c.disadvantages || []).join(', ')}
Market Share: ${c.marketShare}%
`).join('\n')}`;
      } else if (type === 'trend') {
        textContent = `Market Trends:
Trend Score: ${data.trendScore || 'N/A'}
Keywords: ${(data.keywords || []).join(', ')}
Emerging Topics: ${(data.emergingTopics || []).map((t: any) => t.topic || t).join(', ')}
Market Mentions: ${(data.marketMentions || []).map((m: any) => m.mention || m).join(', ')}
Summary: ${data.summary || ''}`;
      }

      // Preprocess and chunk the text
      const cleanedText = preprocessText(textContent);
      const chunks = chunkText(cleanedText);
      
      // Generate embeddings for each chunk
      for (let i = 0; i < chunks.length; i++) {
        try {
          const embedding = await generateEmbedding(chunks[i], GEMINI_API_KEY);
          
          if (embedding.length > 0) {
            embeddings.push({
              project_id: projectId,
              agent_result_id: resultId,
              content_type: type,
              content_text: cleanedText,
              content_chunk: chunks[i],
              embedding: embedding,
              run_id: runId,
              metadata: {
                chunk_index: i,
                total_chunks: chunks.length,
                processed_at: new Date().toISOString()
              }
            });
          }
        } catch (embeddingError) {
          console.error(`Error generating embedding for chunk ${i}:`, embeddingError);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Store embeddings in database
    if (embeddings.length > 0) {
      const { error: insertError } = await supabase
        .from('research_embeddings')
        .insert(embeddings);

      if (insertError) {
        console.error('Error storing embeddings:', insertError);
        throw insertError;
      }
    }

    // Update research run with embedding count
    if (runId) {
      await supabase
        .from('research_runs')
        .update({ embeddings_count: embeddings.length })
        .eq('id', runId);
    }

    console.log(`Generated ${embeddings.length} embeddings for project ${projectId}`);

    return new Response(JSON.stringify({ 
      success: true,
      embeddingsCount: embeddings.length,
      projectId,
      runId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
