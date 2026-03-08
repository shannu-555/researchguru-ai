import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Zap, DollarSign, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UsageStats {
  totalRuns: number;
  tokensConsumed: number;
  apiCalls: number;
  estimatedCost: number;
}

const COST_PER_1K_TOKENS = 0.00035; // approximate blended rate

export const AIUsageMonitor = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      const [runsRes, agentsRes] = await Promise.all([
        supabase.from('research_runs').select('id', { count: 'exact', head: true }),
        supabase.from('agent_results').select('tokens_used, execution_time_ms'),
      ]);

      const totalRuns = runsRes.count ?? 0;
      const agents = agentsRes.data ?? [];

      let tokensConsumed = 0;
      agents.forEach((a) => {
        tokensConsumed += a.tokens_used ?? 0;
      });

      // If no token data recorded, estimate ~800 tokens per agent call
      if (tokensConsumed === 0 && agents.length > 0) {
        tokensConsumed = agents.length * 800;
      }

      const apiCalls = agents.length + totalRuns; // agents + run orchestration calls
      const estimatedCost = (tokensConsumed / 1000) * COST_PER_1K_TOKENS;

      setStats({ totalRuns, tokensConsumed, apiCalls, estimatedCost });
      setLoading(false);
    };

    load();
  }, [user]);

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
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          AI Usage Monitor
        </CardTitle>
        <CardDescription>Estimated usage statistics across all research operations</CardDescription>
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
