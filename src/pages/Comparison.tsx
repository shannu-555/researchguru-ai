import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp, DollarSign } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

export default function Comparison() {
  const { user } = useAuth();
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompetitors();
  }, [user]);

  const loadCompetitors = async () => {
    if (!user) return;

    try {
      const { data: projects } = await supabase
        .from('research_projects')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (projects && projects.length > 0) {
        const { data: results } = await supabase
          .from('agent_results')
          .select('*')
          .eq('project_id', projects[0].id)
          .eq('agent_type', 'competitor')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1);

        if (results && results.length > 0) {
          const resultData = results[0].results as any;
          if (resultData?.competitors && Array.isArray(resultData.competitors)) {
            setCompetitors(resultData.competitors);
          }
        }
      }
    } catch (error) {
      console.error('Error loading competitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = competitors.map(c => ({
    name: c.name,
    rating: c.rating,
    marketShare: c.marketShare || 0,
  }));

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-muted-foreground">Loading competitor data...</p>
      </div>
    );
  }

  if (competitors.length === 0) {
    return (
      <div className="p-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Competitor Analysis</h1>
          <p className="text-muted-foreground text-lg">
            Real-time competitor insights and market positioning
          </p>
        </div>
        <Card className="glass-effect border-border/50">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              No competitor data available. Start a research project to see competitor analysis.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Competitor Analysis</h1>
        <p className="text-muted-foreground text-lg">
          Real-time competitor insights and market positioning
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {competitors.map((competitor, index) => (
          <Card
            key={index}
            className="glass-effect border-border/50 hover:border-primary/50 transition-all"
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{competitor.name}</span>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm">{competitor.rating}</span>
                </div>
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {competitor.price}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Company</h4>
                <p className="text-sm">{competitor.company}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Key Features</h4>
                <div className="flex flex-wrap gap-2">
                  {competitor.features?.map((feature: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Advantages</h4>
                <ul className="text-sm space-y-1">
                  {competitor.advantages?.map((adv: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-400">✓</span>
                      <span>{adv}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Disadvantages</h4>
                <ul className="text-sm space-y-1">
                  {competitor.disadvantages?.map((dis: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-400">✗</span>
                      <span>{dis}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {competitor.marketShare && (
                <div className="p-2 rounded-lg bg-secondary/50 border border-border/50">
                  <p className="text-xs text-muted-foreground">Market Share</p>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3 w-3 text-primary" />
                    <p className="text-sm font-medium">{competitor.marketShare}%</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {chartData.length > 0 && (
        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle>Competitive Landscape</CardTitle>
            <CardDescription>Market positioning and ratings comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="rating" fill="#10b981" name="Rating (out of 5)" />
                <Bar dataKey="marketShare" fill="#06b6d4" name="Market Share %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
