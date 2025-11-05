import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface MarketPulseData {
  score: number;
  summary: string;
  sentiment: number;
  competition: number;
  trend: number;
}

export default function MarketPulseIndex() {
  const { user } = useAuth();
  const [pulseData, setPulseData] = useState<MarketPulseData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMarketPulse = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { type: 'market-pulse' }
      });

      if (error) throw error;
      if (data?.pulseData) {
        setPulseData(data.pulseData);
      }
    } catch (error) {
      console.error('Error loading market pulse:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketPulse();
    const interval = setInterval(loadMarketPulse, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [user]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const gaugeData = pulseData ? [
    { name: 'Score', value: pulseData.score },
    { name: 'Remaining', value: 100 - pulseData.score }
  ] : [];

  const COLORS = ['#10b981', '#1f2937'];

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary animate-pulse" />
          AI-Driven Market Pulse Index
        </CardTitle>
        <CardDescription>Real-time unified market intelligence score</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : pulseData ? (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={gaugeData}
                      cx="50%"
                      cy="50%"
                      startAngle={180}
                      endAngle={0}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={0}
                      dataKey="value"
                    >
                      {gaugeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${getScoreColor(pulseData.score)}`}>
                      {pulseData.score}
                    </div>
                    <div className="text-xs text-muted-foreground">MPI Score</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-secondary/20 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground italic">"{pulseData.summary}"</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-secondary/10 rounded-lg">
                <div className="text-2xl font-bold text-purple-400">{pulseData.sentiment}%</div>
                <div className="text-xs text-muted-foreground">Sentiment</div>
              </div>
              <div className="text-center p-3 bg-secondary/10 rounded-lg">
                <div className="text-2xl font-bold text-cyan-400">{pulseData.competition}%</div>
                <div className="text-xs text-muted-foreground">Competition</div>
              </div>
              <div className="text-center p-3 bg-secondary/10 rounded-lg">
                <div className="text-2xl font-bold text-green-400">{pulseData.trend}%</div>
                <div className="text-xs text-muted-foreground">Trend</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No market data available. Run a research project to generate insights.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
