import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import MarketPulseIndex from "@/components/MarketPulseIndex";
import ProjectSelector from "@/components/ProjectSelector";

export default function MarketPulse() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <h1 className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          AI-Driven Market Pulse Index
        </h1>
        <p className="text-muted-foreground text-lg">
          Real-time market momentum and trend analysis
        </p>
      </div>

      <div className="flex items-center justify-between p-4 glass-effect rounded-lg border border-border/50">
        <ProjectSelector onProjectSelect={setSelectedProjectId} />
        <Button onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Insights
        </Button>
      </div>

      <MarketPulseIndex key={`pulse-${refreshKey}`} projectId={selectedProjectId} />
    </div>
  );
}
