import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, TrendingUp, DollarSign, Sparkles, Battery, Megaphone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";

interface ScenarioSimulatorProps {
  projectId?: string;
}

interface ScenarioImpact {
  persona: string;
  sentimentChange: number;
  purchaseIntent: number;
  marketShareChange: number;
  description: string;
}

export default function ScenarioSimulator({ projectId }: ScenarioSimulatorProps) {
  const [priceChange, setPriceChange] = useState([0]);
  const [batteryImprovement, setBatteryImprovement] = useState([0]);
  const [newFeature, setNewFeature] = useState(false);
  const [marketingBudget, setMarketingBudget] = useState([0]);
  const [impacts, setImpacts] = useState<ScenarioImpact[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const runSimulation = async () => {
    setIsSimulating(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const p = priceChange[0];
    const b = batteryImprovement[0];
    const f = newFeature ? 1 : 0;
    const m = marketingBudget[0];

    const newImpacts: ScenarioImpact[] = [
      {
        persona: "Budget Buyer",
        sentimentChange: Math.round((p * -1.8) + (b * 0.3) + (f * 4) + (m * 0.1)),
        purchaseIntent: Math.max(0, Math.min(100, Math.round(55 + (p * -1.6) + (b * 0.4) + (f * 6) + (m * 0.15)))),
        marketShareChange: Math.round((p * -0.8) + (b * 0.15) + (f * 2) + (m * 0.12)),
        description: p > 0
          ? "Price increase significantly reduces appeal for budget-conscious buyers"
          : p < 0
          ? "Price reduction makes product highly attractive to this segment"
          : "Neutral pricing maintains current budget buyer interest",
      },
      {
        persona: "Tech Enthusiast",
        sentimentChange: Math.round((p * -0.4) + (b * 1.2) + (f * 12) + (m * 0.2)),
        purchaseIntent: Math.max(0, Math.min(100, Math.round(50 + (p * -0.3) + (b * 1.0) + (f * 15) + (m * 0.25)))),
        marketShareChange: Math.round((p * -0.2) + (b * 0.6) + (f * 5) + (m * 0.15)),
        description: f
          ? "New feature introduction drives strong excitement among tech enthusiasts"
          : b > 20
          ? "Major battery improvement creates strong upgrade motivation"
          : "Incremental changes have moderate effect on tech-savvy users",
      },
      {
        persona: "Quality Focused User",
        sentimentChange: Math.round((p * 0.3) + (b * 1.5) + (f * 6) + (m * 0.05)),
        purchaseIntent: Math.max(0, Math.min(100, Math.round(60 + (p * 0.2) + (b * 1.2) + (f * 8) + (m * 0.08)))),
        marketShareChange: Math.round((p * 0.15) + (b * 0.7) + (f * 3) + (m * 0.05)),
        description: b > 15
          ? "Battery life improvement signals higher build quality and reliability"
          : p > 10
          ? "Higher price may be perceived as premium quality by this segment"
          : "Quality-focused users respond best to tangible product improvements",
      },
      {
        persona: "Early Adopter",
        sentimentChange: Math.round((p * -0.2) + (b * 0.8) + (f * 14) + (m * 0.3)),
        purchaseIntent: Math.max(0, Math.min(100, Math.round(60 + (p * -0.2) + (b * 0.6) + (f * 16) + (m * 0.3)))),
        marketShareChange: Math.round((p * -0.1) + (b * 0.4) + (f * 6) + (m * 0.2)),
        description: "Innovation and new features are the primary drivers for early adopters",
      },
      {
        persona: "Brand Loyalist",
        sentimentChange: Math.round(((p * -0.5) + (b * 0.6) + (f * 5) + (m * 0.4)) * 0.7 + 5),
        purchaseIntent: Math.max(0, Math.min(100, Math.round(72 + ((p * -0.3) + (b * 0.4) + (f * 4) + (m * 0.3)) * 0.5))),
        marketShareChange: Math.round(((p * -0.2) + (b * 0.3) + (f * 2) + (m * 0.25)) * 0.6 + 2),
        description: "Brand affinity provides baseline stability across all market changes",
      },
    ];

    setImpacts(newImpacts);
    setIsSimulating(false);
  };

  const getImpactColor = (value: number) => {
    if (value > 5) return "text-green-600 dark:text-green-400";
    if (value < -5) return "text-destructive";
    return "text-yellow-600 dark:text-yellow-400";
  };

  const getIntentColor = (value: number) => {
    if (value >= 70) return "bg-green-500/20 text-green-600 dark:text-green-400";
    if (value >= 40) return "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400";
    return "bg-destructive/20 text-destructive";
  };

  const getShareColor = (value: number) => {
    if (value > 2) return "text-green-600 dark:text-green-400";
    if (value < -2) return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary animate-pulse" />
          Interactive Market Scenario Simulator
        </CardTitle>
        <CardDescription>
          Adjust product strategy variables and predict consumer behavior impact across personas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scenario Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-lg bg-secondary/10 border border-border/30">
          {/* Price Change */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Price Change
              </label>
              <span className={`text-lg font-bold ${priceChange[0] > 0 ? "text-destructive" : priceChange[0] < 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                {priceChange[0] > 0 ? "+" : ""}{priceChange[0]}%
              </span>
            </div>
            <Slider value={priceChange} onValueChange={setPriceChange} min={-50} max={50} step={5} className="w-full" />
            <p className="text-xs text-muted-foreground">Simulate product price increase or decrease</p>
          </div>

          {/* Battery Life Improvement */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Battery className="h-4 w-4 text-primary" />
                Battery Life Improvement
              </label>
              <span className="text-lg font-bold text-primary">+{batteryImprovement[0]}%</span>
            </div>
            <Slider value={batteryImprovement} onValueChange={setBatteryImprovement} min={0} max={50} step={5} className="w-full" />
            <p className="text-xs text-muted-foreground">Percentage improvement in battery performance</p>
          </div>

          {/* New Feature Introduction */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                New Feature Introduction
              </label>
              <Badge variant={newFeature ? "default" : "outline"} className="text-xs">
                {newFeature ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={newFeature} onCheckedChange={setNewFeature} />
              <span className="text-sm text-muted-foreground">{newFeature ? "New feature will be launched" : "No new feature planned"}</span>
            </div>
            <p className="text-xs text-muted-foreground">Toggle introduction of a major new product feature</p>
          </div>

          {/* Marketing Budget Increase */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                Marketing Budget Increase
              </label>
              <span className="text-lg font-bold text-primary">+{marketingBudget[0]}%</span>
            </div>
            <Slider value={marketingBudget} onValueChange={setMarketingBudget} min={0} max={100} step={10} className="w-full" />
            <p className="text-xs text-muted-foreground">Increase in marketing and awareness spend</p>
          </div>
        </div>

        <Button onClick={runSimulation} disabled={isSimulating} className="w-full gradient-primary hover:opacity-90 transition-opacity" size="lg">
          {isSimulating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2" />
              Simulating…
            </>
          ) : (
            <>
              <Zap className="mr-2 h-5 w-5" />
              Run Simulation
            </>
          )}
        </Button>

        {/* Results */}
        {impacts.length > 0 && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-lg font-semibold">Predicted Consumer Impact by Persona</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {impacts.map((impact, idx) => (
                <Card
                  key={idx}
                  className="border-border/50 hover:border-primary/30 transition-all duration-300 hover:scale-[1.02] animate-slide-up"
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">{impact.persona}</h4>
                      <Badge className={getIntentColor(impact.purchaseIntent)}>
                        Intent: {impact.purchaseIntent}%
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {/* Purchase Intent */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Purchase Intent</span>
                          <span className="font-semibold">{impact.purchaseIntent}%</span>
                        </div>
                        <Progress value={impact.purchaseIntent} className="h-1.5" />
                      </div>

                      {/* Sentiment Change */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sentiment Change</span>
                        <span className={`font-bold ${getImpactColor(impact.sentimentChange)}`}>
                          {impact.sentimentChange > 0 ? "+" : ""}{impact.sentimentChange}
                        </span>
                      </div>

                      {/* Market Share Change */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Market Share Change</span>
                        <span className={`font-bold ${getShareColor(impact.marketShareChange)}`}>
                          {impact.marketShareChange > 0 ? "+" : ""}{impact.marketShareChange}%
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground italic border-t border-border/30 pt-2">
                      {impact.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Summary */}
            <div className="p-4 rounded-lg bg-secondary/10 border border-border/30 space-y-2">
              <h4 className="font-semibold">Simulation Summary</h4>
              <p className="text-sm text-muted-foreground">
                Scenario: {priceChange[0] !== 0 ? `${priceChange[0] > 0 ? "+" : ""}${priceChange[0]}% price change` : "no price change"}
                {batteryImprovement[0] > 0 ? `, +${batteryImprovement[0]}% battery improvement` : ""}
                {newFeature ? ", new feature launch" : ""}
                {marketingBudget[0] > 0 ? `, +${marketingBudget[0]}% marketing budget` : ""}
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Avg sentiment change: {Math.round(impacts.reduce((s, i) => s + i.sentimentChange, 0) / impacts.length)}</li>
                <li>Avg purchase intent: {Math.round(impacts.reduce((s, i) => s + i.purchaseIntent, 0) / impacts.length)}%</li>
                <li>Avg market share change: {Math.round(impacts.reduce((s, i) => s + i.marketShareChange, 0) / impacts.length * 10) / 10}%</li>
                <li>Most affected persona: {impacts.reduce((max, i) => Math.abs(i.sentimentChange) > Math.abs(max.sentimentChange) ? i : max).persona}</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
