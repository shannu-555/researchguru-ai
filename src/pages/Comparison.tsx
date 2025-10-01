import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp, DollarSign } from "lucide-react";

export default function Comparison() {
  const competitors = [
    {
      name: "OnePlus 11R",
      rating: 4.5,
      price: "$499",
      features: ["5G", "120Hz Display", "Fast Charging"],
      sentiment: "Positive",
      trend: "Rising",
    },
    {
      name: "Realme Buds Q2",
      rating: 4.2,
      price: "$29",
      features: ["ANC", "10mm Driver", "20hr Battery"],
      sentiment: "Mixed",
      trend: "Stable",
    },
    {
      name: "Samsung Galaxy Buds",
      rating: 4.7,
      price: "$149",
      features: ["ANC Pro", "Spatial Audio", "IPX7"],
      sentiment: "Positive",
      trend: "Rising",
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Competitor Analysis</h1>
        <p className="text-muted-foreground text-lg">
          Real-time competitor insights and market positioning
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {competitors.map((competitor) => (
          <Card
            key={competitor.name}
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
                <h4 className="text-sm font-semibold text-muted-foreground">Key Features</h4>
                <div className="flex flex-wrap gap-2">
                  {competitor.features.map((feature) => (
                    <Badge key={feature} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Market Metrics</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-secondary/50 border border-border/50">
                    <p className="text-xs text-muted-foreground">Sentiment</p>
                    <p className={`text-sm font-medium ${
                      competitor.sentiment === "Positive" ? "text-green-400" : "text-yellow-400"
                    }`}>
                      {competitor.sentiment}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/50 border border-border/50">
                    <p className="text-xs text-muted-foreground">Trend</p>
                    <div className="flex items-center gap-1">
                      <TrendingUp className={`h-3 w-3 ${
                        competitor.trend === "Rising" ? "text-green-400" : "text-gray-400"
                      }`} />
                      <p className="text-sm font-medium">{competitor.trend}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-effect border-border/50">
        <CardHeader>
          <CardTitle>Competitive Landscape</CardTitle>
          <CardDescription>Market positioning and opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p>Competitive analysis chart will be displayed here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
