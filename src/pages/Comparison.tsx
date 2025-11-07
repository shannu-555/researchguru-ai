import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp, DollarSign, Brain } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ComparisonSelector } from "@/components/ComparisonSelector";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

interface Product {
  id: string;
  name: string;
  company: string;
  rating: number;
  price: string;
  features?: string[];
  advantages?: string[];
  disadvantages?: string[];
  marketShare?: number;
}

export default function Comparison() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [aiInsights, setAiInsights] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleProductsSelected = async (products: Product[]) => {
    setSelectedProducts(products);
    setLoading(true);

    try {
      const productNames = products.map(p => p.name).join(', ');
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: { 
          messages: [
            {
              role: "user",
              content: `Compare these products and provide key insights: ${productNames}. Focus on competitive advantages, market positioning, and recommendations.`
            }
          ],
          userId: user?.id 
        }
      });

      if (error) throw error;
      if (data?.message) {
        setAiInsights(data.message);
      }
    } catch (error) {
      console.error('Error generating AI insights:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI insights",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const comparisonData = selectedProducts.map(p => ({
    name: p.name,
    rating: p.rating,
    features: p.features?.length || 0,
    marketShare: p.marketShare || 0,
  }));

  const radarData = [
    { metric: 'Rating', ...Object.fromEntries(selectedProducts.map(p => [p.name, p.rating * 20])) },
    { metric: 'Features', ...Object.fromEntries(selectedProducts.map(p => [p.name, (p.features?.length || 0) * 10])) },
    { metric: 'Price Value', ...Object.fromEntries(selectedProducts.map(p => [p.name, 75])) },
    { metric: 'Market Share', ...Object.fromEntries(selectedProducts.map(p => [p.name, (p.marketShare || 15)])) },
  ];

  if (selectedProducts.length === 0) {
    return (
      <div className="p-8 space-y-8 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Product Comparison Dashboard</h1>
          <p className="text-muted-foreground text-lg">
            Side-by-side analysis with AI-powered insights
          </p>
        </div>
        <ComparisonSelector onProductsSelected={handleProductsSelected} />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Product Comparison Dashboard</h1>
        <p className="text-muted-foreground text-lg">
          Side-by-side analysis with synchronized metrics and AI insights
        </p>
      </div>

      {/* Side-by-side comparison cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {selectedProducts.map((product) => (
          <Card
            key={product.id}
            className="glass-effect border-border/50 hover:border-primary/50 transition-all"
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{product.name}</span>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm">{product.rating}</span>
                </div>
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {product.price}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Company</h4>
                <p className="text-sm">{product.company}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Key Features</h4>
                <div className="flex flex-wrap gap-2">
                  {product.features?.map((feature: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Advantages</h4>
                <ul className="text-sm space-y-1">
                  {product.advantages?.map((adv: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-400">✓</span>
                      <span>{adv}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {product.marketShare && (
                <div className="p-2 rounded-lg bg-secondary/50 border border-border/50">
                  <p className="text-xs text-muted-foreground">Market Share</p>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3 w-3 text-primary" />
                    <p className="text-sm font-medium">{product.marketShare}%</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Synchronized charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle>Side-by-Side Metrics</CardTitle>
            <CardDescription>Direct comparison of key indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="rating" fill="#10b981" name="Rating" />
                <Bar dataKey="features" fill="#06b6d4" name="Features Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle>Multi-Dimensional Analysis</CardTitle>
            <CardDescription>Radar chart showing all metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" />
                <PolarRadiusAxis />
                {selectedProducts.map((product, index) => (
                  <Radar
                    key={product.id}
                    name={product.name}
                    dataKey={product.name}
                    stroke={`hsl(${index * 120}, 70%, 50%)`}
                    fill={`hsl(${index * 120}, 70%, 50%)`}
                    fillOpacity={0.3}
                  />
                ))}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* AI-generated insights */}
      <Card className="glass-effect border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI-Generated Comparative Insights
          </CardTitle>
          <CardDescription>
            Intelligent analysis powered by Groq AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="flex gap-1">
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce delay-100" />
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce delay-200" />
              </div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiInsights}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
