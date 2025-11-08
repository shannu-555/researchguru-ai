import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import CrossMarketCorrelation from "@/components/CrossMarketCorrelation";
import ProjectSelector from "@/components/ProjectSelector";

export default function CrossMarket() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <h1 className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Cross-Market Correlation Explorer
        </h1>
        <p className="text-muted-foreground text-lg">
          Discover connections and patterns across different markets
        </p>
      </div>

      <div className="flex items-center justify-between p-4 glass-effect rounded-lg border border-border/50">
        <ProjectSelector onProjectSelect={setSelectedProjectId} />
        <Button onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Analysis
        </Button>
      </div>

      <CrossMarketCorrelation key={`correlation-${refreshKey}`} projectId={selectedProjectId} />
    </div>
  );
}
