import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, PieChart as PieIcon, TrendingUp, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';

const PIE_COLORS = ['hsl(142,70%,45%)', 'hsl(48,90%,55%)', 'hsl(0,70%,55%)'];
const BAR_COLOR = 'hsl(220,70%,55%)';
const LINE_COLOR = 'hsl(262,70%,55%)';

interface SentimentData { name: string; value: number }
interface CompetitorData { name: string; score: number }
interface TrendData { period: string; value: number }

const EmptyState = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
    <AlertTriangle className="h-6 w-6" />
    <p className="text-sm">No {label} data available yet</p>
    <p className="text-xs">Run a research project to generate data</p>
  </div>
);

export const MarketAnalyticsCharts = () => {
  const { user } = useAuth();
  const [sentiment, setSentiment] = useState<SentimentData[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      const { data: results } = await supabase
        .from('agent_results')
        .select('agent_type, results, created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(30);

      if (results && results.length > 0) {
        // --- Sentiment aggregation ---
        const sentimentTotals = { positive: 0, neutral: 0, negative: 0, count: 0 };
        results.filter(r => r.agent_type === 'sentiment').forEach(r => {
          const res = r.results as any;
          const sa = res?.sentimentAnalysis || res?.sentiment_analysis;
          if (sa) {
            sentimentTotals.positive += Number(sa.positive || 0);
            sentimentTotals.neutral += Number(sa.neutral || 0);
            sentimentTotals.negative += Number(sa.negative || 0);
            sentimentTotals.count++;
          }
        });

        if (sentimentTotals.count > 0) {
          const c = sentimentTotals.count;
          setSentiment([
            { name: 'Positive', value: Math.round(sentimentTotals.positive / c) },
            { name: 'Neutral', value: Math.round(sentimentTotals.neutral / c) },
            { name: 'Negative', value: Math.round(sentimentTotals.negative / c) },
          ]);
        }

        // --- Competitor data ---
        const compResults = results.filter(r => r.agent_type === 'competitor');
        const compMap = new Map<string, number[]>();
        compResults.forEach(r => {
          const res = r.results as any;
          const comps = res?.competitors || res?.competitorList || [];
          if (Array.isArray(comps)) {
            comps.slice(0, 6).forEach((comp: any) => {
              const name = comp?.name || comp?.company || '';
              const score = Number(comp?.score || comp?.marketShare || comp?.relevance || 0);
              if (name && score > 0) {
                const existing = compMap.get(name) || [];
                existing.push(score);
                compMap.set(name, existing);
              }
            });
          }
        });
        if (compMap.size > 0) {
          const compData: CompetitorData[] = [];
          compMap.forEach((scores, name) => {
            compData.push({ name, score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) });
          });
          setCompetitors(compData.sort((a, b) => b.score - a.score).slice(0, 6));
        }

        // --- Trend data (aggregate by month from trend agent results) ---
        const trendResults = results.filter(r => r.agent_type === 'trend');
        if (trendResults.length > 0) {
          // Group by month of creation as timeline proxy
          const monthMap = new Map<string, number>();
          trendResults.forEach(r => {
            const res = r.results as any;
            const score = Number(res?.overallScore || res?.trendScore || res?.score || 50);
            const date = new Date(r.created_at);
            const key = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
            const existing = monthMap.get(key);
            monthMap.set(key, existing ? Math.round((existing + score) / 2) : score);
          });

          const trendData: TrendData[] = [];
          monthMap.forEach((value, period) => trendData.push({ period, value }));
          // Keep chronological order (already desc from query, reverse)
          setTrends(trendData.reverse().slice(-8));
        }
      }

      setLoading(false);
    };

    load();
  }, [user]);

  if (loading) return null;

  const hasAnyData = sentiment.length > 0 || competitors.length > 0 || trends.length > 0;
  if (!hasAnyData) return null;

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Market Analytics
        </CardTitle>
        <CardDescription>Visual breakdown of research data from AI agents</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sentiment Pie */}
          <Card className="border-border/50 bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-primary" />
                Sentiment Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sentiment.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={sentiment}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name} ${value}%`}
                    >
                      {sentiment.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState label="sentiment" />
              )}
            </CardContent>
          </Card>

          {/* Competitor Bar */}
          <Card className="border-border/50 bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Competitor Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              {competitors.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={competitors} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="score" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState label="competitor" />
              )}
            </CardContent>
          </Card>

          {/* Trend Line */}
          <Card className="border-border/50 bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Market Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trends} margin={{ left: 0, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke={LINE_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState label="trend" />
              )}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};
