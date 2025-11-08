import { useState } from "react";
import ScenarioSimulatorComponent from "@/components/ScenarioSimulator";
import ProjectSelector from "@/components/ProjectSelector";

export default function ScenarioSimulator() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <h1 className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Scenario Simulator
        </h1>
        <p className="text-muted-foreground text-lg">
          Test market scenarios and predict outcomes
        </p>
      </div>

      <div className="p-4 glass-effect rounded-lg border border-border/50">
        <ProjectSelector onProjectSelect={setSelectedProjectId} />
      </div>

      <ScenarioSimulatorComponent projectId={selectedProjectId} />
    </div>
  );
}
