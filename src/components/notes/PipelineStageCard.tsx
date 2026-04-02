import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Circle, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface StageOutput {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "error";
  timestamp?: string;
  metrics?: Record<string, string | number>;
  preview?: string;
  chunks?: string[];
  errorMessage?: string;
}

interface Props {
  stage: StageOutput;
  defaultOpen?: boolean;
}

export function PipelineStageCard({ stage, defaultOpen = false }: Props) {
  const [expanded, setExpanded] = useState(defaultOpen && stage.status === "completed");

  const icon = (() => {
    switch (stage.status) {
      case "completed": return <Check className="h-4 w-4 text-emerald-500" />;
      case "active": return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "error": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default: return <Circle className="h-4 w-4 text-muted-foreground/40" />;
    }
  })();

  const statusColor = stage.status === "completed" ? "default" : stage.status === "error" ? "destructive" : "secondary";

  return (
    <Card className="border-border/40">
      <button
        className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/20 transition-colors rounded-t-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{stage.label}</span>
          <Badge variant={statusColor} className="text-[10px]">{stage.status}</Badge>
          {stage.timestamp && <span className="text-[10px] text-muted-foreground font-mono">{stage.timestamp}</span>}
        </div>
        {stage.status === "completed" && (expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
      </button>

      {expanded && stage.status === "completed" && (
        <CardContent className="pt-0 pb-3 space-y-2">
          {stage.metrics && Object.keys(stage.metrics).length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(stage.metrics).map(([k, v]) => (
                <div key={k} className="bg-muted/40 rounded-md px-3 py-1.5">
                  <p className="text-[10px] text-muted-foreground">{k}</p>
                  <p className="text-xs font-semibold">{v}</p>
                </div>
              ))}
            </div>
          )}

          {stage.preview && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Preview</p>
              <ScrollArea className="max-h-40">
                <pre className="text-[11px] bg-muted/30 rounded-md p-2 whitespace-pre-wrap break-words font-mono leading-relaxed">
                  {stage.preview}
                </pre>
              </ScrollArea>
            </div>
          )}

          {stage.chunks && stage.chunks.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Chunk Previews</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {stage.chunks.map((chunk, i) => (
                  <div key={i} className="bg-muted/30 rounded-md p-2">
                    <Badge variant="outline" className="text-[9px] mb-1">Chunk {i + 1}</Badge>
                    <p className="text-[11px] font-mono whitespace-pre-wrap break-words line-clamp-3">{chunk}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stage.errorMessage && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2">
              <p className="text-xs text-destructive">{stage.errorMessage}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
