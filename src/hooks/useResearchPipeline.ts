import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ResearchRun {
  id: string;
  project_id: string;
  status: string;
  agents_triggered: string[];
  embeddings_count: number;
  feedback_loop_triggered: boolean;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, any>;
}

interface PipelineStatus {
  step1_agents: string;
  step2_sufficiency: any;
  step3_embeddings: string;
  step4_feedback: string;
  step5_insights: string;
  step6_status: string;
}

interface OrchestrationResult {
  success: boolean;
  runId: string;
  projectId: string;
  agentResults: any[];
  summary: string;
  insights: any;
  embeddingsCount: number;
  feedbackLoopTriggered: boolean;
  pipeline: PipelineStatus;
}

interface UseResearchPipelineResult {
  runPipeline: (params: {
    projectId: string;
    productName: string;
    companyName?: string;
    description?: string;
    userId: string;
    userGeminiKey?: string;
  }) => Promise<OrchestrationResult | null>;
  isRunning: boolean;
  currentRun: ResearchRun | null;
  pipelineStatus: PipelineStatus | null;
  error: string | null;
}

export function useResearchPipeline(): UseResearchPipelineResult {
  const [isRunning, setIsRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<ResearchRun | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runPipeline = useCallback(async (params: {
    projectId: string;
    productName: string;
    companyName?: string;
    description?: string;
    userId: string;
    userGeminiKey?: string;
  }): Promise<OrchestrationResult | null> => {
    setIsRunning(true);
    setError(null);
    setPipelineStatus(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('orchestrate-research', {
        body: params
      });

      if (invokeError) {
        throw invokeError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.pipeline) {
        setPipelineStatus(data.pipeline);
      }

      if (data?.runId) {
        // Fetch the complete run details
        const { data: runData } = await supabase
          .from('research_runs')
          .select('*')
          .eq('id', data.runId)
          .single();

        if (runData) {
          setCurrentRun(runData as ResearchRun);
        }
      }

      return data as OrchestrationResult;
    } catch (err: any) {
      const errorMessage = err.message || 'Research pipeline failed';
      setError(errorMessage);
      console.error('Research pipeline error:', err);
      return null;
    } finally {
      setIsRunning(false);
    }
  }, []);

  return {
    runPipeline,
    isRunning,
    currentRun,
    pipelineStatus,
    error
  };
}
