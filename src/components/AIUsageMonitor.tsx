import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Zap, DollarSign, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UsageStats {
  totalRuns: number;
  tokensConsumed: number;
  apiCalls: number;
  estimatedCost: number;
}

type TimeRange = '7d' | '30d' | 'all';

const COST_PER_1K_TOKENS = 0.00035;

function dateFilter(range: TimeRange): string | null {
  if (range === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - (range === '7d' ? 7 : 30));
  return d.toISOString();
}

export const AIUsageMonitor = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>('all');

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      const since = dateFilter(range);

      let runsQuery = supabase.from('research_runs').select('id', { count: 'exact', head: true });
      let agentsQuery = supabase.from('agent_results').select('tokens_used, execution_time_ms, created_at');

      if (since) {
        runsQuery = runsQuery.gte('started_at', since);
        agentsQuery = agentsQuery.gte('created_at', since);
      }

      const [runsRes, agentsRes] = await Promise.all([runsQuery, agentsQuery]);

      const totalRuns = runsRes.count ?? 0;
      const agents = agentsRes.data ?? [];

      let tokensConsumed = 0;
      agents.forEach((a) => { tokensConsumed += a.tokens_used ?? 0; });
      if (tokensConsumed === 0 && agents.length > 0) {
        tokensConsumed = agents.length * 800;
      }

      const apiCalls = agents.length + totalRuns;
      const estimatedCost = (tokensConsumed / 1000) * COST_PER_1K_TOKENS;

      setStats({ totalRuns, tokensConsumed, apiCalls, estimatedCost });
      setLoading(false);
    };

    load();
  }, [user, range]);

  if (loading || !stats) return null;

  const metrics = [
    { label: 'Research Runs', value: stats.totalRuns.toLocaleString(), icon: BarChart3 },
    { label: 'Tokens Consumed', value: stats.tokensConsumed.toLocaleString(), icon: Zap },
    { label: 'API Calls', value: stats.apiCalls.toLocaleString(), icon: Activity },
    { label: 'Est. Cost', value: `$${stats.estimatedCost.toFixed(4)}`, icon: DollarSign },
  ];

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              AI Usage Monitor
            </CardTitle>
            <CardDescription>Estimated usage statistics across research operations</CardDescription>
          </div>
          <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-secondary/20">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{m.label}</p>
                  <p className="text-base font-semibold">{m.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
