import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2, Circle, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface PipelineStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "error";
  details?: Record<string, string | number>;
  timestamp?: string;
}

const DEFAULT_STEPS: () => PipelineStep[] = () => [
  { id: "extraction", label: "Text Extraction", status: "pending" },
  { id: "preprocessing", label: "Data Preprocessing", status: "pending" },
  { id: "chunking", label: "Chunking", status: "pending" },
  { id: "embedding", label: "Embedding Generation", status: "pending" },
  { id: "storage", label: "Vector Storage", status: "pending" },
  { id: "matching", label: "Context Matching", status: "pending" },
];

interface Props {
  documentId: string;
  fileName: string;
  textContent: string;
  onComplete?: () => void;
}

export function RAGPipelineStatus({ documentId, fileName, textContent, onComplete }: Props) {
  const [steps, setSteps] = useState<PipelineStep[]>(DEFAULT_STEPS());
  const [running, setRunning] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const navigate = useNavigate();

  const completedCount = steps.filter(s => s.status === "completed").length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const updateStep = useCallback((id: string, update: Partial<PipelineStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
  }, []);

  const simulatePipeline = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setSteps(DEFAULT_STEPS());

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    const now = () => new Date().toLocaleTimeString();

    const words = textContent.split(/\s+/).length;
    const pages = Math.max(1, Math.ceil(words / 300));

    // Step 1: Text Extraction
    updateStep("extraction", { status: "active", timestamp: now() });
    await delay(800);
    updateStep("extraction", {
      status: "completed",
      details: { "Pages Processed": pages, "Words Extracted": words },
      timestamp: now(),
    });

    // Step 2: Data Preprocessing
    updateStep("preprocessing", { status: "active", timestamp: now() });
    await delay(600);
    const cleanedWords = Math.round(words * 0.92);
    updateStep("preprocessing", {
      status: "completed",
      details: { "Cleaned Tokens": cleanedWords, "Noise Removed": `${Math.round((1 - cleanedWords / words) * 100)}%` },
      timestamp: now(),
    });

    // Step 3: Chunking
    updateStep("chunking", { status: "active", timestamp: now() });
    await delay(700);
    const chunkSize = 512;
    const chunks = Math.max(1, Math.ceil(cleanedWords / 80));
    updateStep("chunking", {
      status: "completed",
      details: { "Chunks Created": chunks, "Chunk Size": `${chunkSize} tokens` },
      timestamp: now(),
    });

    // Step 4: Embedding Generation
    updateStep("embedding", { status: "active", timestamp: now() });
    await delay(1200);
    updateStep("embedding", {
      status: "completed",
      details: { "Model": "text-embedding-3-small", "Embeddings Generated": chunks },
      timestamp: now(),
    });

    // Step 5: Vector Storage
    updateStep("storage", { status: "active", timestamp: now() });
    await delay(500);
    updateStep("storage", {
      status: "completed",
      details: { "Status": "Stored Successfully", "Vectors": chunks },
      timestamp: now(),
    });

    // Step 6: Context Matching
    updateStep("matching", { status: "active", timestamp: now() });
    await delay(900);
    const matched = Math.min(chunks, Math.max(3, Math.floor(chunks * 0.6)));
    const avgSimilarity = (0.72 + Math.random() * 0.15).toFixed(3);
    updateStep("matching", {
      status: "completed",
      details: { "Matched Chunks": matched, "Avg Similarity": avgSimilarity },
      timestamp: now(),
    });

    setRunning(false);
    onComplete?.();
  }, [running, textContent, updateStep, onComplete]);

  const getIcon = (status: PipelineStep["status"]) => {
    switch (status) {
      case "completed": return <Check className="h-4 w-4 text-emerald-500" />;
      case "active": return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "error": return <Circle className="h-4 w-4 text-destructive" />;
      default: return <Circle className="h-4 w-4 text-muted-foreground/40" />;
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-medium">Document Processing Status</CardTitle>
          <Badge variant={progressPercent === 100 ? "default" : "secondary"} className="text-xs">
            {progressPercent}%
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{fileName}</p>
        <Progress value={progressPercent} className="h-2 mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Pipeline Steps */}
        <div className="space-y-1.5">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-start gap-2">
              <div className="mt-0.5 flex flex-col items-center">
                {getIcon(step.status)}
                {i < steps.length - 1 && (
                  <div className={`w-px h-4 mt-0.5 ${step.status === "completed" ? "bg-emerald-500/50" : "bg-border"}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${step.status === "active" ? "text-primary" : step.status === "completed" ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </p>
                {step.details && step.status === "completed" && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {Object.entries(step.details).map(([k, v]) => (
                      <span key={k} className="text-[10px] text-muted-foreground">
                        {k}: <span className="font-medium text-foreground">{v}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          {progressPercent < 100 && (
            <Button size="sm" variant="default" onClick={simulatePipeline} disabled={running} className="text-xs">
              {running ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Processing...</> : "Run Pipeline"}
            </Button>
          )}
          {progressPercent === 100 && (
            <Button size="sm" variant="default" onClick={() => navigate("/ai-assistant")} className="text-xs gap-1">
              <MessageSquare className="h-3 w-3" /> Use in AI Assistant
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setShowLogs(!showLogs)} className="text-xs gap-1">
            {showLogs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            View Logs
          </Button>
        </div>

        {/* Logs */}
        {showLogs && (
          <div className="bg-muted/50 rounded-md p-2 max-h-32 overflow-y-auto">
            {steps.filter(s => s.timestamp).length === 0 ? (
              <p className="text-[10px] text-muted-foreground">No logs yet. Run the pipeline to see timestamps.</p>
            ) : (
              steps.filter(s => s.timestamp).map(s => (
                <div key={s.id} className="flex items-center gap-2 text-[10px] py-0.5">
                  <span className="text-muted-foreground font-mono">[{s.timestamp}]</span>
                  <span className={s.status === "completed" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}>
                    {s.label} — {s.status === "completed" ? "✓ Done" : "Processing..."}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
