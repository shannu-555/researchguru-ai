import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PersonaData {
  name: string;
  description: string;
  icon: string;
  priceImpact: number;
  featureImpact: number;
  launchImpact: number;
  behaviorData: { scenario: string; impact: number }[];
}

export default function ConsumerPersonaPredictor() {
  const { user } = useAuth();
  const [personas, setPersonas] = useState<PersonaData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPersonas = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { type: 'consumer-personas' }
      });

      if (error) throw error;
      if (data?.personas) {
        setPersonas(data.personas);
      }
    } catch (error) {
      console.error('Error loading personas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersonas();
  }, [user]);

  const getImpactIcon = (impact: number) => {
    if (impact > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (impact < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-yellow-500" />;
  };

  const getImpactColor = (impact: number) => {
    if (impact > 0) return 'text-green-500';
    if (impact < 0) return 'text-red-500';
    return 'text-yellow-500';
  };

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Consumer Persona Predictor & Behavior Simulator
        </CardTitle>
        <CardDescription>AI-generated buyer personas with predictive behavior analysis</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : personas.length > 0 ? (
          <div className="space-y-6">
            {/* Persona Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {personas.map((persona, idx) => (
                <Card key={idx} className="border-border/50 hover:border-primary/30 transition-all">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                        {persona.icon}
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">{persona.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{persona.description}</p>
                      </div>
                      
                      {/* Impact Predictions */}
                      <div className="w-full space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Price +10%:</span>
                          <div className="flex items-center gap-1">
                            {getImpactIcon(persona.priceImpact)}
                            <span className={getImpactColor(persona.priceImpact)}>
                              {persona.priceImpact > 0 ? '+' : ''}{persona.priceImpact}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Feature Removal:</span>
                          <div className="flex items-center gap-1">
                            {getImpactIcon(persona.featureImpact)}
                            <span className={getImpactColor(persona.featureImpact)}>
                              {persona.featureImpact > 0 ? '+' : ''}{persona.featureImpact}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">New Launch:</span>
                          <div className="flex items-center gap-1">
                            {getImpactIcon(persona.launchImpact)}
                            <span className={getImpactColor(persona.launchImpact)}>
                              {persona.launchImpact > 0 ? '+' : ''}{persona.launchImpact}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Behavior Simulation Graph */}
            {personas[0]?.behaviorData && (
              <div className="bg-secondary/10 p-4 rounded-lg">
                <h4 className="text-sm font-semibold mb-4">Simulated Behavior Trends</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={personas[0].behaviorData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="scenario" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {personas.map((persona, idx) => (
                      <Line
                        key={idx}
                        type="monotone"
                        dataKey="impact"
                        stroke={['#8b5cf6', '#06b6d4', '#10b981'][idx % 3]}
                        strokeWidth={2}
                        name={persona.name}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No persona data available. Run market analysis to generate consumer profiles.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
