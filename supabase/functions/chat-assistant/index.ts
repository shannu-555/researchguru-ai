// @ts-nocheck
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate query embedding using Gemini API
async function generateQueryEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] }
        }),
      }
    );

    if (!response.ok) {
      console.error('Embedding error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.embedding?.values || [];
  } catch (error) {
    console.error('Error generating embedding:', error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId, projectId } = await req.json();
    
    console.log('Chat assistant request:', { messageCount: messages.length, userId, projectId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Get the latest user message for vector search
    const latestUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || '';
    
    // Initialize context variables
    let vectorContext = '';
    let agentContext = '';
    let vectorMatches: any[] = [];
    let insufficientData = false;

    // Step 1: Perform vector similarity search if we have a query
    if (latestUserMessage && GEMINI_API_KEY) {
      console.log('Performing vector similarity search...');
      
      const queryEmbedding = await generateQueryEmbedding(latestUserMessage, GEMINI_API_KEY);
      
      if (queryEmbedding.length > 0) {
        const embeddingString = `[${queryEmbedding.join(',')}]`;
        
        // Search in vector database
        const { data: matches, error: searchError } = await supabase
          .rpc('match_embeddings', {
            query_embedding: embeddingString,
            match_threshold: 0.4,
            match_count: 8,
            filter_project_id: projectId || null
          });

        if (!searchError && matches && matches.length > 0) {
          vectorMatches = matches;
          vectorContext = `\n\n**Retrieved from Vector Database (${matches.length} relevant chunks):**\n`;
          matches.forEach((match: any, index: number) => {
            vectorContext += `\n[${match.content_type.toUpperCase()}] (Similarity: ${(match.similarity * 100).toFixed(1)}%)\n${match.content_chunk.slice(0, 500)}...\n`;
          });
          console.log(`Found ${matches.length} vector matches`);
        } else {
          console.log('No vector matches found');
          insufficientData = true;
        }
      }
    }

    // Step 2: Get recent agent results for additional context
    if (userId) {
      let projectQuery = supabase
        .from('research_projects')
        .select('id, product_name, company_name')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (projectId) {
        projectQuery = projectQuery.eq('id', projectId);
      }
      
      const { data: projects } = await projectQuery.limit(1);

      if (projects && projects.length > 0) {
        const { data: agentResults } = await supabase
          .from('agent_results')
          .select('*')
          .eq('project_id', projects[0].id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(6);

        if (agentResults && agentResults.length > 0) {
          agentContext = `\n\n**Agent Research Data for "${projects[0].product_name}":**\n`;
          
          agentResults.forEach((result: any) => {
            if (result.agent_type === 'sentiment') {
              agentContext += `\nSentiment Analysis:\n- Score: ${result.results?.overallScore || 'N/A'}/100\n- Positive: ${result.results?.positive}%\n- Confidence: ${result.results?.confidenceLevel || 'N/A'}\n`;
            } else if (result.agent_type === 'competitor') {
              const competitors = result.results?.competitors?.slice(0, 3) || [];
              agentContext += `\nCompetitor Analysis:\n${competitors.map((c: any) => `- ${c.name}: ${c.price} (${c.rating}/5)`).join('\n')}\n`;
            } else if (result.agent_type === 'trend') {
              agentContext += `\nTrend Analysis:\n- Score: ${result.results?.trendScore || 'N/A'}/100\n- Keywords: ${(result.results?.keywords || []).slice(0, 5).join(', ')}\n`;
            }
          });
        }
      }
    }

    // Step 3: Check if we need to suggest re-running agents
    let feedbackSuggestion = '';
    if (insufficientData && vectorMatches.length < 2) {
      feedbackSuggestion = '\n\n**Note:** Limited data available for this query. Consider running a new research analysis to gather more comprehensive data.';
    }

    // Build enhanced system prompt with RAG context
    const systemMessage = `You are an AI market research assistant with access to real-time research data.

**Your Capabilities:**
- Analyze sentiment, competitor, and trend data
- Provide insights based on vector-retrieved evidence
- Answer questions grounded in actual research findings
- Cite sources when making claims

**Response Guidelines:**
1. Use the retrieved data below to provide grounded answers
2. When citing data, mention the source type (sentiment, competitor, trend)
3. Be specific about confidence levels when available
4. If data is insufficient, acknowledge limitations honestly
5. Provide actionable recommendations when appropriate
${vectorContext}${agentContext}${feedbackSuggestion}

**Important:** Base your responses on the retrieved data above. If the data doesn't contain relevant information, say so clearly rather than making assumptions.`;

    // Step 4: Call LLM with enhanced context
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ 
        error: 'AI service is not configured. Please contact support.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemMessage },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'AI service is temporarily busy. Please wait a moment and try again.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'AI service usage limit reached. Please try again later.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error('AI service temporarily unavailable');
    }

    const data = await response.json();
    const message = data.choices[0].message.content;

    return new Response(JSON.stringify({ 
      message,
      context: {
        vectorMatchCount: vectorMatches.length,
        hasAgentData: agentContext.length > 0,
        insufficientData
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chat-assistant:', error);
    return new Response(JSON.stringify({ 
      error: 'Unable to process your request. Please try again in a moment.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
