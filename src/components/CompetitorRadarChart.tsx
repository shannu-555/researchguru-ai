import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';
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

function clamp(v: number, min = 0, max = 10) {
  return Math.min(max, Math.max(min, Math.round(v * 10) / 10));
}

function computeScores(product: Product) {
  // Price Score: derive from price string — lower price → higher score (heuristic)
  const priceNum = parseFloat((product.price || '0').replace(/[^0-9.]/g, '')) || 0;
  const priceScore = priceNum > 0 ? clamp(10 - Math.log10(priceNum + 1) * 2.5) : 5;

  // Feature Completeness: based on feature count (0-10 mapped to 0-10)
  const featureScore = clamp(Math.min((product.features?.length || 0) * 1.5, 10));

  // Customer Sentiment: based on rating (1-5 → 0-10)
  const sentimentScore = clamp((product.rating || 2.5) * 2);

  // Market Popularity: from market share (0-100 → 0-10)
  const popularityScore = clamp((product.marketShare || 10) / 10);

  // Innovation Score: heuristic from advantages count + feature diversity
  const innovationScore = clamp(
    Math.min(((product.advantages?.length || 0) * 1.2) + ((product.features?.length || 0) * 0.5), 10)
  );

  // Brand Strength: composite of rating, market share, and advantages
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
  };
}

export const CompetitorRadarChart = ({ products }: CompetitorRadarChartProps) => {
  if (products.length === 0) return null;

  const allScores = products.map((p) => ({ name: p.name, scores: computeScores(p) }));

  const radarData = DIMENSIONS.map((dim) => {
    const entry: Record<string, string | number> = { dimension: dim };
    allScores.forEach((ps) => {
      entry[ps.name] = ps.scores[dim];
    });
    return entry;
  });

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Competitor Radar Analysis
        </CardTitle>
        <CardDescription>
          Multi-dimensional comparison across 6 key metrics (normalized 0–10)
        </CardDescription>
      </CardHeader>
      <CardContent>
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
