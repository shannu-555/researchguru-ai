// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, productName, companyName, description, userId, userGeminiKey } = await req.json();
    
    console.log('Starting research orchestration for project:', projectId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create research run for traceability
    const { data: run, error: runError } = await supabase
      .from('research_runs')
      .insert({
        project_id: projectId,
        user_id: userId,
        status: 'running',
        agents_triggered: ['sentiment', 'competitor', 'trend'],
        metadata: {
          product_name: productName,
          company_name: companyName,
          started_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (runError) {
      console.error('Error creating research run:', runError);
      throw runError;
    }

    const runId = run.id;
    console.log('Created research run:', runId);

    // Step 1: Run AI Agents
    console.log('Step 1: Running AI agents...');
    const agentsResponse = await fetch(`${supabaseUrl}/functions/v1/run-agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        productName,
        companyName,
        description,
        projectId,
        userGeminiKey
      }),
    });

    if (!agentsResponse.ok) {
      const errorText = await agentsResponse.text();
      console.error('Agent execution failed:', errorText);
      
      await supabase.from('research_runs').update({
        status: 'failed',
        error_message: 'Agent execution failed',
        completed_at: new Date().toISOString()
      }).eq('id', runId);
      
      throw new Error('Agent execution failed');
    }

    const agentsResult = await agentsResponse.json();
    console.log('Agents completed:', agentsResult.results?.length || 0, 'results');

    // Step 2: Check data sufficiency
    const { data: sufficiencyCheck } = await supabase
      .rpc('check_data_sufficiency', { p_project_id: projectId });

    const needsFeedbackLoop = sufficiencyCheck?.needs_feedback_loop || false;
    console.log('Data sufficiency check:', sufficiencyCheck);

    // Step 3: Generate embeddings from agent results
    console.log('Step 3: Generating embeddings...');
    const agentResultsForEmbedding = agentsResult.results?.map((r: any) => ({
      type: r.type,
      data: r.data,
      resultId: null // We don't have individual IDs from run-agents
    })) || [];

    const embeddingsResponse = await fetch(`${supabaseUrl}/functions/v1/generate-embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        projectId,
        agentResults: agentResultsForEmbedding,
        runId
      }),
    });

    let embeddingsCount = 0;
    if (embeddingsResponse.ok) {
      const embeddingsResult = await embeddingsResponse.json();
      embeddingsCount = embeddingsResult.embeddingsCount || 0;
      console.log('Generated embeddings:', embeddingsCount);
    } else {
      console.error('Embedding generation failed');
    }

    // Step 4: Handle feedback loop if data insufficient
    let feedbackLoopTriggered = false;
    if (needsFeedbackLoop && embeddingsCount < 3) {
      console.log('Step 4: Triggering feedback loop for more data...');
      feedbackLoopTriggered = true;
      
      // Re-run agents with enhanced prompts
      const feedbackResponse = await fetch(`${supabaseUrl}/functions/v1/run-agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          productName: `${productName} (detailed analysis)`,
          companyName,
          description: `${description || ''} Provide comprehensive, detailed analysis with multiple data points.`,
          projectId,
          userGeminiKey
        }),
      });

      if (feedbackResponse.ok) {
        const feedbackResult = await feedbackResponse.json();
        console.log('Feedback loop completed with additional results');
        
        // Generate embeddings for feedback data
        const feedbackAgentResults = feedbackResult.results?.map((r: any) => ({
          type: r.type,
          data: r.data,
          resultId: null
        })) || [];

        if (feedbackAgentResults.length > 0) {
          await fetch(`${supabaseUrl}/functions/v1/generate-embeddings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              projectId,
              agentResults: feedbackAgentResults,
              runId
            }),
          });
        }
      }
    }

    // Step 5: Generate aggregated insights
    console.log('Step 5: Generating aggregated insights...');
    const insightsResponse = await fetch(`${supabaseUrl}/functions/v1/generate-insights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ projectId }),
    });

    let insights = null;
    if (insightsResponse.ok) {
      const insightsResult = await insightsResponse.json();
      insights = insightsResult.insights;
      console.log('Insights generated successfully');
    }

    // Step 6: Update research run status
    await supabase.from('research_runs').update({
      status: 'completed',
      embeddings_count: embeddingsCount,
      feedback_loop_triggered: feedbackLoopTriggered,
      completed_at: new Date().toISOString(),
      metadata: {
        ...run.metadata,
        results_count: agentsResult.results?.length || 0,
        has_insights: !!insights,
        completed_at: new Date().toISOString()
      }
    }).eq('id', runId);

    // Update project status
    await supabase.from('research_projects').update({
      status: 'completed',
      updated_at: new Date().toISOString()
    }).eq('id', projectId);

    console.log('Research orchestration completed for run:', runId);

    return new Response(JSON.stringify({
      success: true,
      runId,
      projectId,
      agentResults: agentsResult.results,
      summary: agentsResult.summary,
      insights,
      embeddingsCount,
      feedbackLoopTriggered,
      pipeline: {
        step1_agents: 'completed',
        step2_sufficiency: sufficiencyCheck,
        step3_embeddings: embeddingsCount > 0 ? 'completed' : 'partial',
        step4_feedback: feedbackLoopTriggered ? 'triggered' : 'not_needed',
        step5_insights: insights ? 'completed' : 'pending',
        step6_status: 'completed'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in research orchestration:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
