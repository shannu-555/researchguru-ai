import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Brain, FileText, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export interface TrainedDocument {
  id: string;
  fileName: string;
  textContent: string;
  enabled: boolean;
  trainedAt: string;
  status: "training_ready" | "connected" | "disabled";
  chunkCount?: number;
}

interface Props {
  documents: TrainedDocument[];
  onToggle: (id: string, enabled: boolean) => void;
  onRemove: (id: string) => void;
  onRetrain: (id: string) => void;
}

export function KnowledgeBasePanel({ documents, onToggle, onRemove, onRetrain }: Props) {
  const connectedCount = documents.filter(d => d.enabled).length;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4 text-primary" />
            Knowledge Base / Trained Data
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {connectedCount} connected
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Documents connected to the AI Assistant for RAG-augmented answering.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {documents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No documents trained yet.</p>
            <p className="text-xs">Process documents in the RAG Pipeline and click "Train Assistant".</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 hover:bg-accent/20 transition-colors">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{doc.fileName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {doc.chunkCount ?? "?"} chunks • Trained {new Date(doc.trainedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={doc.enabled ? "default" : "secondary"} className="text-[9px]">
                    {doc.enabled ? "Active" : "Disabled"}
                  </Badge>
                  <Switch checked={doc.enabled} onCheckedChange={(v) => onToggle(doc.id, v)} className="scale-75" />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRetrain(doc.id)} title="Retrain">
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemove(doc.id)} title="Remove">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
