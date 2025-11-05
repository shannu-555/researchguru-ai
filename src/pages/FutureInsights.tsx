import MarketPulseIndex from "@/components/MarketPulseIndex";
import CrossMarketCorrelation from "@/components/CrossMarketCorrelation";
import ConsumerPersonaPredictor from "@/components/ConsumerPersonaPredictor";

export default function FutureInsights() {
  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <h1 className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Future Insights & Predictive Analytics
        </h1>
        <p className="text-muted-foreground text-lg">
          Next-level market intelligence powered by AI
        </p>
      </div>

      <MarketPulseIndex />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CrossMarketCorrelation />
        <ConsumerPersonaPredictor />
      </div>
    </div>
  );
}
