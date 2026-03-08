import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Save, Download, History, Tag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface NoteVersion {
  id: string;
  version_number: number;
  title: string;
  content: string;
  created_at: string;
}

interface Props {
  note: Note | null;
  userId: string;
  tags: { id: string; tag_name: string; color: string }[];
  linkedTagIds: string[];
  onSave: (title: string, content: string) => void;
  onTagToggle: (tagId: string) => void;
}

export function NoteEditor({ note, userId, tags, linkedTagIds, onSave, onTagToggle }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setShowVersions(false);
    } else {
      setTitle("");
      setContent("");
    }
  }, [note?.id]);

  useEffect(() => {
    if (note && (title !== note.title || content !== note.content)) {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      const timeout = setTimeout(() => handleSave(), 2000);
      setAutoSaveTimeout(timeout);
    }
    return () => { if (autoSaveTimeout) clearTimeout(autoSaveTimeout); };
  }, [title, content]);

  const handleSave = async () => {
    if (!note) return;
    setIsSaving(true);

    // Save version before updating
    const { data: existingVersions } = await supabase
      .from("note_versions")
      .select("version_number")
      .eq("note_id", note.id)
      .order("version_number", { ascending: false })
      .limit(1);

    const nextVersion = (existingVersions?.[0]?.version_number || 0) + 1;

    await supabase.from("note_versions").insert({
      note_id: note.id,
      title: note.title,
      content: note.content,
      version_number: nextVersion,
    });

    onSave(title, content);
    setIsSaving(false);
  };

  const loadVersions = async () => {
    if (!note) return;
    const { data } = await supabase
      .from("note_versions")
      .select("*")
      .eq("note_id", note.id)
      .order("version_number", { ascending: false })
      .limit(20);
    setVersions((data as NoteVersion[]) || []);
    setShowVersions(true);
  };

  const revertToVersion = (v: NoteVersion) => {
    setTitle(v.title);
    setContent(v.content);
    setShowVersions(false);
    toast.success(`Reverted to version ${v.version_number}`);
  };

  const exportAsText = () => {
    if (!note) return;
    const blob = new Blob([`${title}\n\n${content}`], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^a-z0-9]/gi, "_")}.txt`;
    a.click();
  };

  const exportAsPDF = () => {
    if (!note) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 20, 20);
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(content, 170);
    doc.text(lines, 20, 35);
    doc.save(`${title.replace(/[^a-z0-9]/gi, "_")}.pdf`);
  };

  const exportAsMarkdown = () => {
    if (!note) return;
    const md = `# ${title}\n\n${content}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^a-z0-9]/gi, "_")}.md`;
    a.click();
  };

  const exportAsDocx = () => {
    if (!note) return;
    // Simple DOCX-like export as HTML wrapped in Word format
    const docContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'></head><body><h1>${title}</h1><pre>${content}</pre></body></html>`;
    const blob = new Blob([docContent], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^a-z0-9]/gi, "_")}.docx`;
    a.click();
  };

  if (!note) {
    return (
      <Card className="lg:col-span-2 border-border/50">
        <CardContent className="py-20 text-center text-muted-foreground">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>Select a note or create a new one to start editing</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2 border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{showVersions ? "Version History" : "Edit Note"}</CardTitle>
          <div className="flex items-center gap-2">
            {isSaving && <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>}
            <Button variant="ghost" size="sm" onClick={loadVersions}>
              <History className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showVersions ? (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            <Button variant="outline" size="sm" onClick={() => setShowVersions(false)} className="mb-2">
              ← Back to Editor
            </Button>
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No versions saved yet</p>
            ) : versions.map(v => (
              <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg border-border/50">
                <div>
                  <p className="text-sm font-medium">v{v.version_number}: {v.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => revertToVersion(v)}>Revert</Button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <Input placeholder="Note title" value={title} onChange={e => setTitle(e.target.value)} className="text-lg font-semibold" />

            {/* Tags */}
            <div className="flex flex-wrap items-center gap-1">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {tags.map(tag => (
                <Badge
                  key={tag.id}
                  variant={linkedTagIds.includes(tag.id) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => onTagToggle(tag.id)}
                >
                  {tag.tag_name}
                  {linkedTagIds.includes(tag.id) && <X className="h-3 w-3 ml-1" />}
                </Badge>
              ))}
            </div>

            <Textarea
              placeholder="Start writing your research notes here..."
              value={content}
              onChange={e => setContent(e.target.value)}
              className="min-h-[350px] font-mono text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} size="sm" className="gap-2"><Save className="h-4 w-4" /> Save</Button>
              <Button onClick={exportAsText} variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> .txt</Button>
              <Button onClick={exportAsPDF} variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> PDF</Button>
              <Button onClick={exportAsMarkdown} variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> .md</Button>
              <Button onClick={exportAsDocx} variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> DOCX</Button>
            </div>
            <p className="text-xs text-muted-foreground">Auto-saves every 2s • Versions tracked automatically</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
