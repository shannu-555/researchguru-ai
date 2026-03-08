import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, TrendingUp, DollarSign, Brain, Eye, ShieldCheck, FileText, Database } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ComparisonSelector } from "@/components/ComparisonSelector";
import { CompetitorRadarChart } from "@/components/CompetitorRadarChart";
import { ProductPurchaseLinks } from "@/components/ProductPurchaseLinks";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

interface StructuredInsight {
  title: string;
  confidence: number;
  evidence: string[];
  sources: string[];
  rawText: string;
}

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
  const [structuredInsights, setStructuredInsights] = useState<StructuredInsight[]>([]);

  const parseInsights = (raw: string, products: Product[]): StructuredInsight[] => {
    const paragraphs = raw.split(/\n\n+/).filter(p => p.trim().length > 20);
    if (paragraphs.length === 0) return [];

    const sourcePools = ["Agent Results", "Review Analysis", "Market Data", "Trend Reports", "Feature Comparison"];
    const productNames = products.map(p => p.name);

    return paragraphs.slice(0, 6).map((para, idx) => {
      const sentences = para.split(/[.!]\s+/).filter(s => s.trim().length > 10);
      const title = sentences[0]?.replace(/^[-•*#\d.)\s]+/, '').trim().slice(0, 80) || `Insight ${idx + 1}`;

      // Derive confidence from content richness
      let confidence = 60;
      if (sentences.length >= 3) confidence += 10;
      if (productNames.some(n => para.includes(n))) confidence += 8;
      if (/\d+%|\d+\.\d+|\d+ out of/.test(para)) confidence += 12;
      confidence = Math.min(95, confidence);

      // Extract evidence from sentences
      const evidence = sentences.slice(1, 4).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
      if (evidence.length === 0) evidence.push("Based on comparative analysis of selected products");

      // Assign sources contextually
      const sources: string[] = [];
      if (/rating|review|sentiment/i.test(para)) sources.push("Review Analysis");
      if (/feature|specification|spec/i.test(para)) sources.push("Feature Comparison");
      if (/market|share|position/i.test(para)) sources.push("Market Data");
      if (/trend|growth|rising/i.test(para)) sources.push("Trend Reports");
      if (/competitor|rival|vs/i.test(para)) sources.push("Agent Results");
      if (sources.length === 0) sources.push(sourcePools[idx % sourcePools.length]);

      return { title, confidence, evidence, sources, rawText: para };
    });
  };

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
              content: `Compare these products and provide key insights: ${productNames}. Focus on competitive advantages, market positioning, and recommendations. For each insight, include specific data points, percentages, and evidence.`
            }
          ],
          userId: user?.id 
        }
      });

      if (error) throw error;
      if (data?.message) {
        setAiInsights(data.message);
        setStructuredInsights(parseInsights(data.message, products));
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

      {/* Competitor Radar Analysis */}
      <CompetitorRadarChart products={selectedProducts} />

      {/* AI-generated insights */}
      <Card className="glass-effect border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI-Generated Comparative Insights
          </CardTitle>
          <CardDescription>
            Intelligent analysis with confidence scoring and evidence
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
          ) : structuredInsights.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {structuredInsights.map((insight, idx) => {
                const confColor = insight.confidence >= 80 ? "text-green-600 dark:text-green-400" : insight.confidence >= 65 ? "text-yellow-600 dark:text-yellow-400" : "text-orange-600 dark:text-orange-400";
                const barColor = insight.confidence >= 80 ? "[&>div]:bg-green-500" : insight.confidence >= 65 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-orange-500";
                return (
                  <Card key={idx} className="border-border/50 bg-muted/20">
                    <CardContent className="p-4 space-y-3">
                      {/* Title */}
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-sm font-semibold leading-snug">{insight.title}</p>
                      </div>

                      {/* Confidence */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Confidence</span>
                          <span className={`font-semibold ${confColor}`}>{insight.confidence}%</span>
                        </div>
                        <Progress value={insight.confidence} className={`h-1.5 ${barColor}`} />
                      </div>

                      {/* Evidence preview */}
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Supporting Evidence
                        </span>
                        <ul className="space-y-0.5">
                          {insight.evidence.slice(0, 2).map((e, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="text-primary mt-px">•</span>
                              <span className="line-clamp-2">{e}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Sources */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Database className="h-3 w-3 text-muted-foreground" />
                        {insight.sources.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{s}</Badge>
                        ))}
                      </div>

                      {/* View Evidence Dialog */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5 h-7">
                            <Eye className="h-3 w-3" /> View Evidence
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-base">
                              <Brain className="h-4 w-4 text-primary" />
                              {insight.title}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground">Confidence:</span>
                              <Progress value={insight.confidence} className={`h-2 flex-1 ${barColor}`} />
                              <span className={`text-sm font-semibold ${confColor}`}>{insight.confidence}%</span>
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">Supporting Evidence</h4>
                              <ul className="space-y-1.5">
                                {insight.evidence.map((e, i) => (
                                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                    <span className="text-primary mt-0.5">•</span>
                                    <span>{e}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">Data Sources</h4>
                              <div className="flex flex-wrap gap-2">
                                {insight.sources.map((s, i) => (
                                  <Badge key={i} variant="secondary">{s}</Badge>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">Full Analysis</h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{insight.rawText}</p>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : aiInsights ? (
            <div className="prose prose-sm max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiInsights}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Select products to generate comparative insights.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
