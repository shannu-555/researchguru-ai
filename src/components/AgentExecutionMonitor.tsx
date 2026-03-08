import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, Loader2, XCircle, TrendingUp, Target, Activity, Globe, Timer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AgentStage {
  label: string;
  progress: number;
  detail: string;
}

interface AgentEntry {
  name: string;
  key: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  status: 'ready' | 'running' | 'completed' | 'failed';
  executionTimeMs: number | null;
  updatedAt: string | null;
  stage: AgentStage;
  avgHistoricalMs: number | null;
  startedAt: number | null; // timestamp when agent started running
}

const STAGES = {
  ready: { label: 'Waiting', progress: 0, detail: '' },
  collecting: { label: 'Collecting Data', progress: 25, detail: '' },
  processing: { label: 'Processing Data', progress: 60, detail: '' },
  generating: { label: 'Generating Insights', progress: 85, detail: '' },
  completed: { label: 'Completed', progress: 100, detail: '' },
  failed: { label: 'Failed', progress: 0, detail: '' },
};

function deriveStage(status: AgentEntry['status'], agentKey: string, results: any): AgentStage {
  if (status === 'completed') {
    const detail = getSummaryDetail(agentKey, results);
    return { label: 'Completed', progress: 100, detail };
  }
  if (status === 'failed') return { label: 'Failed', progress: 0, detail: '' };
  if (status === 'ready') return { label: 'Waiting', progress: 0, detail: '' };
  return getRunningStage(agentKey);
}

function getRunningStage(agentKey: string): AgentStage {
  switch (agentKey) {
    case 'sentiment':
      return { label: 'Processing Reviews', progress: 55, detail: 'Analyzing sentiment signals...' };
    case 'competitor':
      return { label: 'Collecting Competitor Data', progress: 40, detail: 'Mapping competitor landscape...' };
    case 'trend':
      return { label: 'Processing Trend Signals', progress: 50, detail: 'Detecting market patterns...' };
    case 'perplexity':
      return { label: 'Web Research In Progress', progress: 45, detail: 'Querying search APIs...' };
    default:
      return { label: 'Processing', progress: 50, detail: '' };
  }
}

function getSummaryDetail(agentKey: string, results: any): string {
  if (!results) return 'Analysis complete';
  const r = results as Record<string, any>;
  switch (agentKey) {
    case 'sentiment': {
      const count = Array.isArray(r.reviews) ? r.reviews.length : r.review_count ?? r.total_reviews ?? null;
      if (count !== null) return `${count} reviews analyzed`;
      return 'Sentiment analysis complete';
    }
    case 'competitor': {
      const count = Array.isArray(r.competitors) ? r.competitors.length : r.competitor_count ?? null;
      if (count !== null) return `${count} competitors analyzed`;
      return 'Competitor analysis complete';
    }
    case 'trend': {
      const count = Array.isArray(r.trends) ? r.trends.length : r.trend_count ?? null;
      if (count !== null) return `${count} trends detected`;
      return 'Trend detection complete';
    }
    case 'perplexity':
      return 'Web research complete';
    default:
      return 'Analysis complete';
  }
}

const defaultAgents: AgentEntry[] = [
  { name: 'Sentiment Agent', key: 'sentiment', icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10', status: 'ready', executionTimeMs: null, updatedAt: null, stage: STAGES.ready, avgHistoricalMs: null, startedAt: null },
  { name: 'Competitor Agent', key: 'competitor', icon: Target, color: 'text-cyan-400', bg: 'bg-cyan-500/10', status: 'ready', executionTimeMs: null, updatedAt: null, stage: STAGES.ready, avgHistoricalMs: null, startedAt: null },
  { name: 'Trend Agent', key: 'trend', icon: Activity, color: 'text-green-400', bg: 'bg-green-500/10', status: 'ready', executionTimeMs: null, updatedAt: null, stage: STAGES.ready, avgHistoricalMs: null, startedAt: null },
  { name: 'Perplexity Research', key: 'perplexity', icon: Globe, color: 'text-amber-400', bg: 'bg-amber-500/10', status: 'ready', executionTimeMs: null, updatedAt: null, stage: STAGES.ready, avgHistoricalMs: null, startedAt: null },
];

// Default fallback ETAs per agent type (ms)
const DEFAULT_ETA: Record<string, number> = {
  sentiment: 12000,
  competitor: 14000,
  trend: 10000,
  perplexity: 8000,
};

interface AgentExecutionMonitorProps {
  projectId?: string | null;
  localStatus?: Record<string, string>;
  isPerplexityLoading?: boolean;
  perplexityDone?: boolean;
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

function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatEta(ms: number): string {
  if (ms <= 0) return '< 1s';
  if (ms < 1000) return '< 1s';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `~${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `~${m}m ${rem}s` : `~${m}m`;
}

const statusDot = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-500';
    case 'running': return 'bg-blue-500 animate-pulse';
    case 'failed': return 'bg-destructive';
    default: return 'bg-muted-foreground/40';
  }
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const progressColor = (status: string) => {
  if (status === 'completed') return '[&>div]:bg-green-500';
  if (status === 'running') return '[&>div]:bg-primary';
  if (status === 'failed') return '[&>div]:bg-destructive';
  return '';
};

export const AgentExecutionMonitor = ({
  projectId,
  localStatus,
  isPerplexityLoading,
  perplexityDone,
}: AgentExecutionMonitorProps) => {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentEntry[]>(defaultAgents);
  const [historicalAvgs, setHistoricalAvgs] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const startTimesRef = useRef<Record<string, number>>({});

  // Tick every second to update ETAs
  useEffect(() => {
    const hasRunning = agents.some((a) => a.status === 'running');
    if (!hasRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [agents]);

  // Load historical averages on mount
  useEffect(() => {
    if (!user) return;
    const loadHistory = async () => {
      const { data } = await supabase
        .from('agent_results')
        .select('agent_type, execution_time_ms')
        .eq('status', 'completed')
        .not('execution_time_ms', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        const grouped: Record<string, number[]> = {};
        data.forEach((r) => {
          if (r.execution_time_ms) {
            if (!grouped[r.agent_type]) grouped[r.agent_type] = [];
            grouped[r.agent_type].push(r.execution_time_ms);
          }
        });
        const avgs: Record<string, number> = {};
        Object.entries(grouped).forEach(([type, times]) => {
          avgs[type] = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        });
        setHistoricalAvgs(avgs);
      }
    };
    loadHistory();
  }, [user]);

  // Load current project agent results
  useEffect(() => {
    if (!projectId || !user) return;
    const load = async () => {
      const { data } = await supabase
        .from('agent_results')
        .select('agent_type, status, execution_time_ms, updated_at, results')
        .eq('project_id', projectId);

      if (data && data.length > 0) {
        setAgents((prev) =>
          prev.map((agent) => {
            const match = data.find((r) => r.agent_type === agent.key);
            if (match) {
              const st = mapDbStatus(match.status);
              return {
                ...agent,
                status: st,
                executionTimeMs: match.execution_time_ms,
                updatedAt: match.updated_at,
                stage: deriveStage(st, agent.key, match.results),
                avgHistoricalMs: historicalAvgs[agent.key] ?? DEFAULT_ETA[agent.key] ?? null,
              };
            }
            return agent;
          })
        );
      }
    };
    load();
  }, [projectId, user, historicalAvgs]);

  // Merge local status + track start times
  useEffect(() => {
    if (!localStatus) return;

    setAgents((prev) =>
      prev.map((agent) => {
        let newStatus: AgentEntry['status'];
        if (agent.key === 'perplexity') {
          newStatus = isPerplexityLoading ? 'running' : perplexityDone ? 'completed' : 'ready';
        } else {
          const override = localStatus[agent.key];
          newStatus = override ? mapLocalStatus(override) : agent.status;
        }

        // Track when agent starts running
        if (newStatus === 'running' && agent.status !== 'running') {
          startTimesRef.current[agent.key] = Date.now();
        }
        if (newStatus !== 'running') {
          delete startTimesRef.current[agent.key];
        }

        return {
          ...agent,
          status: newStatus,
          stage: deriveStage(newStatus, agent.key, null),
          startedAt: startTimesRef.current[agent.key] ?? agent.startedAt,
          avgHistoricalMs: historicalAvgs[agent.key] ?? DEFAULT_ETA[agent.key] ?? null,
        };
      })
    );
  }, [localStatus, isPerplexityLoading, perplexityDone, historicalAvgs]);

  const completedCount = agents.filter((a) => a.status === 'completed').length;
  const overallProgress = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.stage.progress, 0) / agents.length) : 0;

  const getEtaText = (agent: AgentEntry): string | null => {
    if (agent.status !== 'running') return null;
    const startTime = startTimesRef.current[agent.key] ?? agent.startedAt;
    const avgMs = agent.avgHistoricalMs ?? DEFAULT_ETA[agent.key] ?? null;
    if (!avgMs) return null;
    if (!startTime) return `ETA: ${formatEta(avgMs)}`;
    const elapsed = now - startTime;
    const remaining = Math.max(0, avgMs - elapsed);
    return `ETA: ${formatEta(remaining)}`;
  };

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          Agent Execution Monitor
        </CardTitle>
        <CardDescription className="flex items-center justify-between">
          <span>Real-time status of AI research agents</span>
          <span className="text-xs font-medium text-foreground">{completedCount}/{agents.length} completed · {overallProgress}%</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Progress value={overallProgress} className="h-1.5" />
        </div>

        {agents.map((agent) => {
          const Icon = agent.icon;
          const eta = getEtaText(agent);
          return (
            <div
              key={agent.key}
              className="p-3 rounded-lg border border-border/50 bg-secondary/20 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full ${agent.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-4 w-4 ${agent.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{agent.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Stage: <span className={`font-medium ${agent.status === 'completed' ? 'text-green-500' : agent.status === 'running' ? 'text-primary' : 'text-muted-foreground'}`}>{agent.stage.label}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {eta && (
                    <span className="text-[10px] text-primary flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      {eta}
                    </span>
                  )}
                  <div className={`h-2 w-2 rounded-full ${statusDot(agent.status)}`} />
                  <StatusIcon status={agent.status} />
                  {agent.executionTimeMs !== null && agent.status === 'completed' && (
                    <span className="text-[10px] text-muted-foreground">{formatMs(agent.executionTimeMs)}</span>
                  )}
                </div>
              </div>

              <Progress value={agent.stage.progress} className={`h-1 ${progressColor(agent.status)}`} />

              {agent.stage.detail && (
                <p className="text-[10px] text-muted-foreground pl-12">{agent.stage.detail}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
