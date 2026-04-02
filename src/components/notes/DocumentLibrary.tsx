import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Image, File, Trash2, Brain, Loader2, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DocumentPipelineCard } from "./DocumentPipelineCard";
import { toast } from "sonner";

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  category: string;
  tags: string[];
  ai_summary: string | null;
  analysis_status: string | null;
  created_at: string;
}

interface Props {
  userId: string;
  onAnalysisComplete?: () => void;
  onTrainDocument?: (docId: string, fileName: string, textContent: string) => void;
}

export function DocumentLibrary({ userId, onAnalysisComplete, onTrainDocument }: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const loadDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from("research_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setDocuments(data as Document[]);
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const allowed = ["pdf", "docx", "txt", "png", "jpg", "jpeg", "webp"];
      if (!allowed.includes(ext || "")) {
        toast.error(`Unsupported file type: .${ext}`);
        continue;
      }

      const path = `${userId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("research-documents")
        .upload(path, file);

      if (uploadError) {
        toast.error(`Upload failed: ${file.name}`);
        continue;
      }

      const { error: dbError } = await supabase.from("research_documents").insert({
        user_id: userId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        file_type: ext || "unknown",
        category: "research",
        tags: [],
      });

      if (dbError) {
        toast.error(`Failed to save record: ${file.name}`);
      } else {
        toast.success(`Uploaded: ${file.name}`);
      }
    }

    setUploading(false);
    loadDocuments();
    e.target.value = "";
  };

  const deleteDocument = async (doc: Document) => {
    if (!confirm("Delete this document?")) return;
    await supabase.storage.from("research-documents").remove([doc.file_path]);
    await supabase.from("research_documents").delete().eq("id", doc.id);
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
    toast.success("Document deleted");
  };

  const getIcon = (type: string) => {
    if (["png", "jpg", "jpeg", "webp"].includes(type)) return <Image className="h-4 w-4" />;
    if (type === "pdf") return <FileText className="h-4 w-4 text-destructive" />;
    return <File className="h-4 w-4" />;
  };

  const filtered = filterCategory === "all" ? documents : documents.filter(d => d.category === filterCategory);

  const handleTrainAssistant = (docId: string, textContent: string) => {
    const doc = documents.find(d => d.id === docId);
    if (doc && onTrainDocument) {
      onTrainDocument(docId, doc.file_name, textContent);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Research Document Library
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="research">Research</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
              </SelectContent>
            </Select>
            <label>
              <Input
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
              <Button asChild variant="default" size="sm" disabled={uploading}>
                <span className="cursor-pointer gap-2">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload
                </span>
              </Button>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Upload className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No documents yet. Upload PDF, DOCX, TXT, or images.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filtered.map(doc => (
              <div key={doc.id} className="space-y-1">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {getIcon(doc.file_type)}
                    <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                    <span>•</span>
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    <Badge variant="outline" className="text-[10px]">{doc.category}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteDocument(doc)} className="h-6 w-6 p-0">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <DocumentPipelineCard
                  document={doc}
                  onTrainAssistant={handleTrainAssistant}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
