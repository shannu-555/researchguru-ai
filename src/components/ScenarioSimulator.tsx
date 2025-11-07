import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, TrendingUp, DollarSign, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

interface ScenarioSimulatorProps {
  projectId?: string;
}

interface ScenarioImpact {
  persona: string;
  sentimentChange: number;
  purchaseIntent: number;
  description: string;
}

export default function ScenarioSimulator({ projectId }: ScenarioSimulatorProps) {
  const [priceChange, setPriceChange] = useState([0]);
  const [featureCount, setFeatureCount] = useState([5]);
  const [qualityRating, setQualityRating] = useState([7]);
  const [impacts, setImpacts] = useState<ScenarioImpact[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const runSimulation = async () => {
    setIsSimulating(true);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Calculate impacts for different personas
    const baseImpact = (priceChange[0] * -0.3) + (featureCount[0] * 2) + (qualityRating[0] * 1.5);
    
    const newImpacts: ScenarioImpact[] = [
      {
        persona: "Budget-Conscious Buyer",
        sentimentChange: Math.round(baseImpact - (priceChange[0] * 1.5)),
        purchaseIntent: Math.max(0, Math.min(100, 50 + baseImpact - (priceChange[0] * 2))),
        description: priceChange[0] > 0 
          ? "Price increase significantly reduces appeal" 
          : "Price reduction makes product very attractive"
      },
      {
        persona: "Feature Enthusiast",
        sentimentChange: Math.round(baseImpact + (featureCount[0] * 1.5)),
        purchaseIntent: Math.max(0, Math.min(100, 50 + baseImpact + (featureCount[0] * 2))),
        description: featureCount[0] > 5 
          ? "Additional features drive strong interest" 
          : "Limited features may disappoint power users"
      },
      {
        persona: "Quality-First Consumer",
        sentimentChange: Math.round(baseImpact + (qualityRating[0] * 2)),
        purchaseIntent: Math.max(0, Math.min(100, 50 + baseImpact + (qualityRating[0] * 3))),
        description: qualityRating[0] > 7 
          ? "High quality rating builds strong trust" 
          : "Quality concerns may lead to competitor consideration"
      },
      {
        persona: "Early Adopter",
        sentimentChange: Math.round(baseImpact + 10),
        purchaseIntent: Math.max(0, Math.min(100, 65 + baseImpact)),
        description: "Innovation and new features drive purchase decisions"
      },
      {
        persona: "Brand Loyalist",
        sentimentChange: Math.round(baseImpact * 0.7 + 15),
        purchaseIntent: Math.max(0, Math.min(100, 70 + (baseImpact * 0.5))),
        description: "Brand affinity provides stability across changes"
      }
    ];
    
    setImpacts(newImpacts);
    setIsSimulating(false);
  };

  const getImpactColor = (value: number) => {
    if (value > 10) return 'text-green-500';
    if (value < -10) return 'text-red-500';
    return 'text-yellow-500';
  };

  const getIntentColor = (value: number) => {
    if (value >= 70) return 'bg-green-500/20 text-green-500';
    if (value >= 40) return 'bg-yellow-500/20 text-yellow-500';
    return 'bg-red-500/20 text-red-500';
  };

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary animate-pulse" />
          Interactive Market Scenario Simulator
        </CardTitle>
        <CardDescription>
          Simulate market changes and predict consumer behavior impact in real-time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scenario Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-lg bg-secondary/10 border border-border/30">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Price Change
              </label>
              <span className={`text-lg font-bold ${priceChange[0] > 0 ? 'text-red-500' : priceChange[0] < 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                {priceChange[0] > 0 ? '+' : ''}{priceChange[0]}%
              </span>
            </div>
            <Slider
              value={priceChange}
              onValueChange={setPriceChange}
              min={-50}
              max={50}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Simulate price increase or decrease
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Feature Count
              </label>
              <span className="text-lg font-bold text-primary">
                {featureCount[0]}
              </span>
            </div>
            <Slider
              value={featureCount}
              onValueChange={setFeatureCount}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Adjust number of product features
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Quality Rating
              </label>
              <span className="text-lg font-bold text-primary">
                {qualityRating[0]}/10
              </span>
            </div>
            <Slider
              value={qualityRating}
              onValueChange={setQualityRating}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Set perceived quality level
            </p>
          </div>
        </div>

        <Button 
          onClick={runSimulation}
          disabled={isSimulating}
          className="w-full gradient-primary hover:opacity-90 transition-opacity"
          size="lg"
        >
          {isSimulating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
              Simulating...
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
            <h3 className="text-lg font-semibold">Predicted Consumer Impact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {impacts.map((impact, idx) => (
                <Card 
                  key={idx} 
                  className="border-border/50 hover:border-primary/30 transition-all duration-300 hover:scale-105 animate-slide-up"
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">{impact.persona}</h4>
                      <Badge className={getIntentColor(impact.purchaseIntent)}>
                        {impact.purchaseIntent}%
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sentiment Change:</span>
                        <span className={`font-bold ${getImpactColor(impact.sentimentChange)}`}>
                          {impact.sentimentChange > 0 ? '+' : ''}{impact.sentimentChange}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Purchase Intent:</span>
                        <span className="font-bold">{impact.purchaseIntent}%</span>
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
            <div className="p-4 rounded-lg bg-secondary/10 border border-border/30">
              <h4 className="font-semibold mb-2">Simulation Summary</h4>
              <p className="text-sm text-muted-foreground">
                Based on your scenario ({priceChange[0] > 0 ? `${priceChange[0]}% price increase` : priceChange[0] < 0 ? `${Math.abs(priceChange[0])}% price decrease` : 'no price change'}, {featureCount[0]} features, {qualityRating[0]}/10 quality):
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>Average sentiment change: {Math.round(impacts.reduce((sum, i) => sum + i.sentimentChange, 0) / impacts.length)}</li>
                <li>Average purchase intent: {Math.round(impacts.reduce((sum, i) => sum + i.purchaseIntent, 0) / impacts.length)}%</li>
                <li>Most affected: {impacts.reduce((max, i) => Math.abs(i.sentimentChange) > Math.abs(max.sentimentChange) ? i : max).persona}</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
