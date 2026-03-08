import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, TrendingUp, Target, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ParsedInsight {
  id: string;
  title: string;
  description: string;
  agent: 'Sentiment' | 'Competitor' | 'Trend';
  createdAt: string;
}

const agentMeta = {
  Sentiment: { icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  Competitor: { icon: Target, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  Trend: { icon: Activity, color: 'text-green-400', bg: 'bg-green-500/10' },
} as const;

function mapAgentType(type: string): ParsedInsight['agent'] {
  const lower = type.toLowerCase();
  if (lower.includes('sentiment')) return 'Sentiment';
  if (lower.includes('competitor')) return 'Competitor';
  return 'Trend';
}

export const InsightSummaryPanel = () => {
  const { user } = useAuth();
  const [insights, setInsights] = useState<ParsedInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      try {
        // Try agent_results first for richer data
        const { data: results } = await supabase
          .from('agent_results')
          .select('id, agent_type, results, created_at, status')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(5);

        if (results && results.length > 0) {
          const parsed: ParsedInsight[] = results.map((r) => {
            const res = r.results as any;
            const summary =
              res?.summary || res?.keyFindings?.[0] || res?.overview || 'Analysis completed';
            return {
              id: r.id,
              title: `${r.agent_type?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} Result`,
              description: typeof summary === 'string' ? summary : JSON.stringify(summary).slice(0, 120),
              agent: mapAgentType(r.agent_type),
              createdAt: r.created_at,
            };
          });
          setInsights(parsed);
        } else {
          // Fallback to insights table
          const { data: insightsData } = await supabase
            .from('insights')
            .select('id, insight_type, data, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

          if (insightsData && insightsData.length > 0) {
            const parsed: ParsedInsight[] = insightsData.map((i) => {
              const d = i.data as any;
              return {
                id: i.id,
                title: i.insight_type?.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Insight',
                description: d?.summary || d?.keyFindings?.[0] || 'Analysis completed',
                agent: mapAgentType(i.insight_type),
                createdAt: i.created_at,
              };
            });
            setInsights(parsed);
          }
        }
      } catch (err) {
        console.error('InsightSummaryPanel: error loading insights', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  if (loading) return null;

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Key Insights Summary
        </CardTitle>
        <CardDescription>Top insights from AI agent analyses</CardDescription>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No insights generated yet. Run agents on a research project to see results here.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.map((insight) => {
              const meta = agentMeta[insight.agent];
              const Icon = meta.icon;
              return (
                <Card key={insight.id} className="border-border/50 bg-secondary/20">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-full ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold line-clamp-1">{insight.title}</p>
                        <span className={`text-[10px] font-medium ${meta.color}`}>{insight.agent} Agent</span>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {insight.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          {new Date(insight.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
