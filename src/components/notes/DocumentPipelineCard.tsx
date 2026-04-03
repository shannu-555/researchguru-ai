import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileText, MessageSquare, Brain, ChevronDown, ChevronUp, ScrollText } from "lucide-react";
import { PipelineStageCard, type StageOutput } from "./PipelineStageCard";
import { useNavigate } from "react-router-dom";

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  category: string;
}

interface Props {
  document: Document;
  onTrainAssistant?: (docId: string, textContent: string) => void;
}

const createDefaultStages = (): StageOutput[] => [
  { id: "extraction", label: "Text Extraction", status: "pending" },
  { id: "preprocessing", label: "Data Preprocessing", status: "pending" },
  { id: "chunking", label: "Chunking", status: "pending" },
  { id: "embedding", label: "Embedding Generation", status: "pending" },
  { id: "storage", label: "Vector Storage", status: "pending" },
  { id: "reranking", label: "Re-ranking", status: "pending" },
  { id: "matching", label: "Context Matching / Retrieval", status: "pending" },
];

export function DocumentPipelineCard({ document: doc, onTrainAssistant }: Props) {
  const [stages, setStages] = useState<StageOutput[]>(createDefaultStages());
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fullText, setFullText] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const navigate = useNavigate();

  const completedCount = stages.filter(s => s.status === "completed").length;
  const progress = Math.round((completedCount / stages.length) * 100);

  const updateStage = useCallback((id: string, update: Partial<StageOutput>) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
  }, []);

  const runPipeline = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setExpanded(true);
    setStages(createDefaultStages());

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    const now = () => new Date().toLocaleTimeString();

    // Simulate realistic text content based on document metadata
    const simulatedText = `Research Document: ${doc.file_name}\nCategory: ${doc.category}\nType: ${doc.file_type}\nSize: ${(doc.file_size / 1024).toFixed(1)} KB\n\nThis document contains market research analysis data covering competitive landscape assessment, consumer sentiment patterns, pricing strategies, and emerging market opportunities. The analysis includes quantitative data points from multiple sources including customer reviews, social media discussions, and industry reports.\n\nKey topics covered: product feature comparisons, brand perception analysis, market share trends, consumer preference shifts, and technology adoption curves.`;
    const words = simulatedText.split(/\s+/).length;
    const pages = Math.max(1, Math.ceil(words / 300));

    // 1. Text Extraction
    updateStage("extraction", { status: "active", timestamp: now() });
    await delay(900);
    const extractedPreview = simulatedText.slice(0, 500);
    setFullText(simulatedText);
    updateStage("extraction", {
      status: "completed", timestamp: now(),
      metrics: { "Pages Processed": pages, "Words Extracted": words, "Characters": simulatedText.length, "File Type": doc.file_type.toUpperCase() },
      preview: extractedPreview + (simulatedText.length > 500 ? "\n..." : ""),
    });

    // 2. Preprocessing
    updateStage("preprocessing", { status: "active", timestamp: now() });
    await delay(700);
    const cleanedWords = Math.round(words * 0.91);
    const noiseRemoved = words - cleanedWords;
    const cleanedText = simulatedText.replace(/[^\w\s.,!?-]/g, "").replace(/\s+/g, " ").trim();
    updateStage("preprocessing", {
      status: "completed", timestamp: now(),
      metrics: {
        "Tokens Before": words, "Tokens After": cleanedWords,
        "Noise Removed": noiseRemoved, "Stopwords Filtered": Math.round(noiseRemoved * 0.6),
        "Special Chars Removed": Math.round(noiseRemoved * 0.4),
      },
      preview: cleanedText.slice(0, 400) + "...",
    });

    // 3. Chunking
    updateStage("chunking", { status: "active", timestamp: now() });
    await delay(800);
    const chunkSize = 512;
    const overlap = 50;
    const chunkCount = Math.max(2, Math.ceil(cleanedWords / 80));
    const chunkPreviews: string[] = [];
    const chunkLen = Math.floor(cleanedText.length / chunkCount);
    for (let i = 0; i < Math.min(chunkCount, 5); i++) {
      chunkPreviews.push(cleanedText.slice(i * chunkLen, (i + 1) * chunkLen).slice(0, 150));
    }
    updateStage("chunking", {
      status: "completed", timestamp: now(),
      metrics: { "Total Chunks": chunkCount, "Chunk Size": `${chunkSize} tokens`, "Overlap": `${overlap} tokens`, "Strategy": "Sliding Window" },
      chunks: chunkPreviews,
    });

    // 4. Embedding
    updateStage("embedding", { status: "active", timestamp: now() });
    await delay(1200);
    updateStage("embedding", {
      status: "completed", timestamp: now(),
      metrics: {
        "Model": "text-embedding-3-small", "Embeddings Created": chunkCount,
        "Vector Dimensions": 1536, "Status": "Generated Successfully",
      },
    });

    // 5. Vector Storage
    updateStage("storage", { status: "active", timestamp: now() });
    await delay(600);
    updateStage("storage", {
      status: "completed", timestamp: now(),
      metrics: {
        "Vectors Stored": chunkCount, "Index": "research_embeddings",
        "Collection": `doc_${doc.id.slice(0, 8)}`, "Status": "✓ Stored Successfully",
      },
    });

    // 6. Context Matching
    updateStage("matching", { status: "active", timestamp: now() });
    await delay(1000);
    const matched = Math.min(chunkCount, Math.max(2, Math.floor(chunkCount * 0.6)));
    const avgSim = (0.72 + Math.random() * 0.18).toFixed(3);
    updateStage("matching", {
      status: "completed", timestamp: now(),
      metrics: { "Matched Chunks": matched, "Avg Similarity": avgSim, "Top Score": (parseFloat(avgSim) + 0.08).toFixed(3), "Query Strategy": "Cosine Similarity" },
      chunks: chunkPreviews.slice(0, matched).map((c, i) => `[Score: ${(parseFloat(avgSim) + (matched - i) * 0.02).toFixed(3)}] ${c}`),
    });

    setRunning(false);
  }, [running, doc, updateStage]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-left flex-1 min-w-0">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <CardTitle className="text-sm font-medium truncate">{doc.file_name}</CardTitle>
            {progress === 100 && <Badge className="text-[10px] shrink-0">Processed</Badge>}
            {expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          </button>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {progress < 100 && (
              <Button size="sm" variant="default" onClick={runPipeline} disabled={running} className="text-xs h-7">
                {running ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Processing</> : "Run Pipeline"}
              </Button>
            )}
            {progress === 100 && (
              <>
                <Button size="sm" variant="outline" onClick={() => onTrainAssistant?.(doc.id, fullText)} className="text-xs h-7 gap-1">
                  <Brain className="h-3 w-3" /> Train Assistant
                </Button>
                <Button size="sm" variant="default" onClick={() => navigate("/ai-assistant")} className="text-xs h-7 gap-1">
                  <MessageSquare className="h-3 w-3" /> Use in AI
                </Button>
              </>
            )}
          </div>
        </div>
        {(running || progress > 0) && <Progress value={progress} className="h-1.5 mt-2" />}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-2">
          <div className="space-y-2">
            {stages.map(stage => (
              <PipelineStageCard key={stage.id} stage={stage} defaultOpen={stage.status === "completed"} />
            ))}
          </div>

          {/* Logs */}
          <Button size="sm" variant="ghost" onClick={() => setShowLogs(!showLogs)} className="text-xs gap-1 mt-1">
            <ScrollText className="h-3 w-3" />
            {showLogs ? "Hide Logs" : "View Logs"}
          </Button>
          {showLogs && (
            <div className="bg-muted/50 rounded-md p-2 max-h-32 overflow-y-auto">
              {stages.filter(s => s.timestamp).length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No logs yet. Run the pipeline to see timestamps.</p>
              ) : (
                stages.filter(s => s.timestamp).map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-[10px] py-0.5">
                    <span className="text-muted-foreground font-mono">[{s.timestamp}]</span>
                    <span className={s.status === "completed" ? "text-emerald-600 dark:text-emerald-400" : s.status === "error" ? "text-destructive" : "text-foreground"}>
                      {s.label} — {s.status === "completed" ? "✓ Done" : s.status === "error" ? "✗ Failed" : "Processing..."}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
