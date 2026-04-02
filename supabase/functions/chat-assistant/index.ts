// @ts-nocheck
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(10000).trim(),
});

const chatAssistantSchema = z.object({
  messages: z.array(messageSchema).min(1).max(50),
  documentContext: z.string().max(50000).optional(),
  documentNames: z.array(z.string()).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const rawBody = await req.json();
    const validationResult = chatAssistantSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return new Response(JSON.stringify({
        error: 'Invalid input',
        details: validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { messages, documentContext, documentNames } = validationResult.data;
    console.log('Chat assistant request:', { messageCount: messages.length, userId, hasDocContext: !!documentContext });

    // Get recent agent results for context
    let agentContext = '';
    const { data: projects } = await supabase
      .from('research_projects')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (projects && projects.length > 0) {
      const { data: agentResults } = await supabase
        .from('agent_results')
        .select('*')
        .eq('project_id', projects[0].id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (agentResults && agentResults.length > 0) {
        agentContext = `\n\nRecent Research Data:\n${JSON.stringify(agentResults, null, 2)}`;
      }
    }

    // Build document knowledge context
    let docKnowledgeBlock = '';
    if (documentContext) {
      docKnowledgeBlock = `\n\n=== USER'S UPLOADED DOCUMENT KNOWLEDGE BASE ===\nThe user has trained you on the following documents. Use this content to answer questions accurately. Always cite which document you referenced.\n\n${documentContext}\n=== END DOCUMENT KNOWLEDGE BASE ===`;
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service is not configured. Please contact support.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemMessage = `You are a market research AI assistant. You provide insights based on sentiment analysis, competitor data, and market trends. ${agentContext}${docKnowledgeBlock}

Be helpful, concise, and actionable. If you have research data above, reference it in your responses. If document knowledge base content is provided, ground your answers in that content and cite the source document name. Always provide fresh, contextual answers based on the conversation.`;

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
        return new Response(JSON.stringify({ error: 'AI service is temporarily busy. Please wait a moment and try again.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI service usage limit reached. Please try again later.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('AI service temporarily unavailable');
    }

    const data = await response.json();
    const message = data.choices[0].message.content;

    return new Response(JSON.stringify({
      message,
      sources: documentNames || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chat-assistant:', error);
    return new Response(JSON.stringify({
      error: 'Unable to process your request. Please try again in a moment.'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
