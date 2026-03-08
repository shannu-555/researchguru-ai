import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, SlidersHorizontal } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Legend, ResponsiveContainer, Tooltip,
} from 'recharts';

interface Product {
  id: string;
  name: string;
  rating: number;
  price: string;
  features?: string[];
  marketShare?: number;
  advantages?: string[];
  disadvantages?: string[];
}

interface CompetitorRadarChartProps {
  products: Product[];
}

const RADAR_COLORS = [
  'hsl(262, 70%, 55%)',
  'hsl(172, 70%, 45%)',
  'hsl(32, 90%, 55%)',
  'hsl(340, 70%, 55%)',
  'hsl(200, 70%, 50%)',
];

const DIMENSIONS = [
  'Price Score',
  'Feature Completeness',
  'Customer Sentiment',
  'Market Popularity',
  'Innovation Score',
  'Brand Strength',
] as const;

type DimName = typeof DIMENSIONS[number];

const DEFAULT_WEIGHTS: Record<DimName, number> = {
  'Price Score': 1,
  'Feature Completeness': 1,
  'Customer Sentiment': 1,
  'Market Popularity': 1,
  'Innovation Score': 1,
  'Brand Strength': 1,
};

function clamp(v: number, min = 0, max = 10) {
  return Math.min(max, Math.max(min, Math.round(v * 10) / 10));
}

function computeScores(product: Product) {
  const priceNum = parseFloat((product.price || '0').replace(/[^0-9.]/g, '')) || 0;
  const priceScore = priceNum > 0 ? clamp(10 - Math.log10(priceNum + 1) * 2.5) : 5;
  const featureScore = clamp(Math.min((product.features?.length || 0) * 1.5, 10));
  const sentimentScore = clamp((product.rating || 2.5) * 2);
  const popularityScore = clamp((product.marketShare || 10) / 10);
  const innovationScore = clamp(
    Math.min(((product.advantages?.length || 0) * 1.2) + ((product.features?.length || 0) * 0.5), 10)
  );
  const brandScore = clamp(
    ((product.rating || 2.5) * 1.0) +
    ((product.marketShare || 10) / 20) +
    ((product.advantages?.length || 0) * 0.5)
  );

  return {
    'Price Score': priceScore,
    'Feature Completeness': featureScore,
    'Customer Sentiment': sentimentScore,
    'Market Popularity': popularityScore,
    'Innovation Score': innovationScore,
    'Brand Strength': brandScore,
  } as Record<DimName, number>;
}

export const CompetitorRadarChart = ({ products }: CompetitorRadarChartProps) => {
  const [weights, setWeights] = useState<Record<DimName, number>>({ ...DEFAULT_WEIGHTS });
  const [showWeights, setShowWeights] = useState(false);

  if (products.length === 0) return null;

  const allScores = products.map((p) => ({ name: p.name, scores: computeScores(p) }));

  const radarData = DIMENSIONS.map((dim) => {
    const w = weights[dim];
    const entry: Record<string, string | number> = { dimension: dim };
    allScores.forEach((ps) => {
      entry[ps.name] = clamp(ps.scores[dim] * w);
    });
    return entry;
  });

  const handleWeightChange = (dim: DimName, value: number[]) => {
    setWeights((prev) => ({ ...prev, [dim]: value[0] }));
  };

  const resetWeights = () => setWeights({ ...DEFAULT_WEIGHTS });

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Competitor Radar Analysis
            </CardTitle>
            <CardDescription>
              Multi-dimensional comparison across 6 key metrics (normalized 0–10)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowWeights(!showWeights)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Weights
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Collapsible open={showWeights} onOpenChange={setShowWeights}>
          <CollapsibleContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 p-4 rounded-lg border border-border/50 bg-secondary/20 mb-4">
              {DIMENSIONS.map((dim) => (
                <div key={dim} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{dim}</span>
                    <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                      {weights[dim].toFixed(1)}×
                    </span>
                  </div>
                  <Slider
                    value={[weights[dim]]}
                    onValueChange={(v) => handleWeightChange(dim, v)}
                    min={0.1}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              ))}
              <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-1">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={resetWeights}>
                  Reset to defaults
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 10 }} />
            {products.map((product, i) => (
              <Radar
                key={product.id}
                name={product.name}
                dataKey={product.name}
                stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
                fill={RADAR_COLORS[i % RADAR_COLORS.length]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
