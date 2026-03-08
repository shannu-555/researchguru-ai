import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface InsightConfidenceIndicatorProps {
  projectId?: string;
  label?: string;
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-500';
  if (score >= 70) return 'text-amber-500';
  return 'text-orange-500';
}

export const InsightConfidenceIndicator = ({ projectId, label = 'Confidence Score' }: InsightConfidenceIndicatorProps) => {
  const { user } = useAuth();
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !projectId) {
      setScore(null);
      return;
    }

    const compute = async () => {
      let points = 0;

      // Factor 1: number of completed agent results (0-3 agents → 0-30 pts)
      const { count: agentCount } = await supabase
        .from('agent_results')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('status', 'completed');
      points += Math.min((agentCount || 0) * 10, 30);

      // Factor 2: number of embeddings (0-20 pts, capped at 20 embeddings)
      const { count: embeddingCount } = await supabase
        .from('research_embeddings')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);
      points += Math.min((embeddingCount || 0), 20);

      // Factor 3: insights generated (0-15 pts)
      const { count: insightCount } = await supabase
        .from('insights')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);
      points += Math.min((insightCount || 0) * 5, 15);

      // Factor 4: research runs completed (0-10 pts)
      const { count: runCount } = await supabase
        .from('research_runs')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('status', 'completed');
      points += Math.min((runCount || 0) * 5, 10);

      // Map raw points (0-75) to confidence range (60-90)
      const normalized = Math.min(Math.max(points, 0), 75);
      const confidence = Math.round(60 + (normalized / 75) * 30);
      setScore(confidence);
    };

    compute();
  }, [user, projectId]);

  if (score === null) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/50 bg-secondary/20">
      <ShieldCheck className={`h-4 w-4 flex-shrink-0 ${scoreColor(score)}`} />
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{label}</span>
      <Progress value={score} className="h-2 flex-1 max-w-[140px]" />
      <span className={`text-sm font-semibold tabular-nums ${scoreColor(score)}`}>{score}%</span>
    </div>
  );
};
