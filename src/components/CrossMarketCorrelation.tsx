import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Network } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface CorrelationData {
  market1: string;
  market2: string;
  correlation: number;
  insight: string;
}

export default function CrossMarketCorrelation() {
  const { user } = useAuth();
  const [correlations, setCorrelations] = useState<CorrelationData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCorrelations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { type: 'market-correlation' }
      });

      if (error) throw error;
      if (data?.correlations) {
        setCorrelations(data.correlations);
      }
    } catch (error) {
      console.error('Error loading correlations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCorrelations();
  }, [user]);

  const getCorrelationColor = (correlation: number) => {
    const absCorr = Math.abs(correlation);
    if (absCorr >= 0.7) return 'bg-green-500/20 text-green-500 border-green-500/30';
    if (absCorr >= 0.4) return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    return 'bg-red-500/20 text-red-500 border-red-500/30';
  };

  const getCorrelationStrength = (correlation: number) => {
    const absCorr = Math.abs(correlation);
    if (absCorr >= 0.7) return 'Strong';
    if (absCorr >= 0.4) return 'Moderate';
    return 'Weak';
  };

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          Cross-Market Correlation Explorer
        </CardTitle>
        <CardDescription>AI-powered analysis of inter-market relationships</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : correlations.length > 0 ? (
          <div className="space-y-4">
            {/* Correlation Heatmap Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {correlations.map((corr, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${getCorrelationColor(corr.correlation)} transition-all hover:scale-105 cursor-pointer`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm">
                      {corr.market1} ↔ {corr.market2}
                    </div>
                    <div className="text-2xl font-bold">
                      {corr.correlation.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-xs opacity-80 mb-2">
                    {getCorrelationStrength(corr.correlation)} Correlation
                  </div>
                  <div className="text-xs italic opacity-70">
                    {corr.insight}
                  </div>
                </div>
              ))}
            </div>

            {/* Correlation Matrix Visualization */}
            <div className="bg-secondary/10 p-4 rounded-lg">
              <h4 className="text-sm font-semibold mb-3">Correlation Strength Legend</h4>
              <div className="flex gap-4 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500/50"></div>
                  <span className="text-xs">Strong (0.7+)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-500/50"></div>
                  <span className="text-xs">Moderate (0.4-0.7)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500/50"></div>
                  <span className="text-xs">Weak (&lt;0.4)</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No correlation data available. Analyze multiple markets to see relationships.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
