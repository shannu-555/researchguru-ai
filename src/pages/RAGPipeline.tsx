import { useAuth } from "@/hooks/useAuth";
import { DocumentLibrary } from "@/components/notes/DocumentLibrary";
import { RAGPipelineStatus } from "@/components/notes/RAGPipelineStatus";
import { Workflow } from "lucide-react";

export default function RAGPipeline() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Workflow className="h-6 w-6 text-primary" />
          Live RAG Processing Pipeline
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload documents and visualize each step of the RAG pipeline in real time.
        </p>
      </div>

      <DocumentLibrary userId={user.id} />
    </div>
  );
}
