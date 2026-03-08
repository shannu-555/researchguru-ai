import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, Loader2, XCircle, TrendingUp, Target, Activity, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AgentEntry {
  name: string;
  key: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  status: 'ready' | 'running' | 'completed' | 'failed';
  executionTimeMs: number | null;
  updatedAt: string | null;
}

const defaultAgents: AgentEntry[] = [
  { name: 'Sentiment Agent', key: 'sentiment', icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10', status: 'ready', executionTimeMs: null, updatedAt: null },
  { name: 'Competitor Agent', key: 'competitor', icon: Target, color: 'text-cyan-400', bg: 'bg-cyan-500/10', status: 'ready', executionTimeMs: null, updatedAt: null },
  { name: 'Trend Agent', key: 'trend', icon: Activity, color: 'text-green-400', bg: 'bg-green-500/10', status: 'ready', executionTimeMs: null, updatedAt: null },
  { name: 'Perplexity Research', key: 'perplexity', icon: Globe, color: 'text-amber-400', bg: 'bg-amber-500/10', status: 'ready', executionTimeMs: null, updatedAt: null },
];

interface AgentExecutionMonitorProps {
  projectId?: string | null;
  localStatus?: Record<string, string>;
  isPerplexityLoading?: boolean;
  perplexityDone?: boolean;
}

const statusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'completed': return 'Completed';
    case 'running': return 'Running';
    case 'failed': return 'Failed';
    default: return 'Ready';
  }
};

const statusDot = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-500';
    case 'running': return 'bg-blue-500 animate-pulse';
    case 'failed': return 'bg-destructive';
    default: return 'bg-muted-foreground/40';
  }
};

function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function mapDbStatus(s: string | null): AgentEntry['status'] {
  if (!s) return 'ready';
  const lower = s.toLowerCase();
  if (lower === 'completed') return 'completed';
  if (lower === 'in_progress' || lower === 'pending' || lower === 'running') return 'running';
  if (lower === 'failed' || lower === 'error') return 'failed';
  return 'ready';
}

function mapLocalStatus(s: string | undefined): AgentEntry['status'] {
  if (!s) return 'ready';
  const lower = s.toLowerCase();
  if (lower === 'completed') return 'completed';
  if (lower.includes('progress') || lower === 'pending') return 'running';
  if (lower === 'failed') return 'failed';
  return 'ready';
}

export const AgentExecutionMonitor = ({
  projectId,
  localStatus,
  isPerplexityLoading,
  perplexityDone,
}: AgentExecutionMonitorProps) => {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentEntry[]>(defaultAgents);

  // Load from DB when projectId is available
  useEffect(() => {
    if (!projectId || !user) return;

    const load = async () => {
      const { data } = await supabase
        .from('agent_results')
        .select('agent_type, status, execution_time_ms, updated_at')
        .eq('project_id', projectId);

      if (data && data.length > 0) {
        setAgents((prev) =>
          prev.map((agent) => {
            const match = data.find((r) => r.agent_type === agent.key);
            if (match) {
              return {
                ...agent,
                status: mapDbStatus(match.status),
                executionTimeMs: match.execution_time_ms,
                updatedAt: match.updated_at,
              };
            }
            return agent;
          })
        );
      }
    };

    load();
  }, [projectId, user]);

  // Merge local status overrides (from Research page state)
  useEffect(() => {
    if (!localStatus) return;

    setAgents((prev) =>
      prev.map((agent) => {
        if (agent.key === 'perplexity') {
          const pStatus: AgentEntry['status'] = isPerplexityLoading
            ? 'running'
            : perplexityDone
              ? 'completed'
              : 'ready';
          return { ...agent, status: pStatus };
        }
        const override = localStatus[agent.key];
        if (override) {
          return { ...agent, status: mapLocalStatus(override) };
        }
        return agent;
      })
    );
  }, [localStatus, isPerplexityLoading, perplexityDone]);

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          Agent Execution Monitor
        </CardTitle>
        <CardDescription>Real-time status of AI research agents</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {agents.map((agent) => {
          const Icon = agent.icon;
          return (
            <div
              key={agent.key}
              className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/20"
            >
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full ${agent.bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${agent.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">{agent.name}</p>
                  {agent.executionTimeMs !== null && agent.status === 'completed' && (
                    <p className="text-[10px] text-muted-foreground">
                      Exec: {formatMs(agent.executionTimeMs)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${statusDot(agent.status)}`} />
                {statusIcon(agent.status)}
                <span className="text-xs text-muted-foreground w-16 text-right">
                  {statusLabel(agent.status)}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
