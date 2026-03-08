import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface InsightConfidenceIndicatorProps {
  projectId?: string;
  label?: string;
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-500';
  if (score >= 70) return 'text-amber-500';
  return 'text-orange-500';
}

function barClassName(score: number) {
  if (score >= 80) return '[&>div]:bg-green-500';
  if (score >= 70) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-orange-500';
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

      const { count: agentCount } = await supabase
        .from('agent_results')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('status', 'completed');
      points += Math.min((agentCount || 0) * 10, 30);

      const { count: embeddingCount } = await supabase
        .from('research_embeddings')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);
      points += Math.min((embeddingCount || 0), 20);

      const { count: insightCount } = await supabase
        .from('insights')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);
      points += Math.min((insightCount || 0) * 5, 15);

      const { count: runCount } = await supabase
        .from('research_runs')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('status', 'completed');
      points += Math.min((runCount || 0) * 5, 10);

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
      <Progress value={score} className={`h-2 flex-1 max-w-[140px] ${barClassName(score)}`} />
      <span className={`text-sm font-semibold tabular-nums ${scoreColor(score)}`}>{score}%</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help flex-shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px] text-xs">
            <p className="font-medium mb-1">Score based on:</p>
            <ul className="space-y-0.5">
              <li>• Completed agents (up to 30pts)</li>
              <li>• Embedding matches (up to 20pts)</li>
              <li>• Generated insights (up to 15pts)</li>
              <li>• Research runs (up to 10pts)</li>
            </ul>
            <p className="mt-1 text-muted-foreground">Mapped to 60–90% range</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
