import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ProjectSelector from "@/components/ProjectSelector";

interface Props {
  userId: string;
  onNoteGenerated: (title: string, content: string) => void;
}

export function AINotesGenerator({ userId, onNoteGenerated }: Props) {
  const [topic, setTopic] = useState("");
  const [projectId, setProjectId] = useState<string | undefined>();
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!topic.trim()) {
      toast.error("Enter a topic");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-note", {
        body: { projectId, topic: topic.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      onNoteGenerated(data.title, data.content);
      setTopic("");
      toast.success("Research note generated!");
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    }
    setGenerating(false);
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Note Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Enter research topic..."
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === "Enter" && generate()}
        />
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ProjectSelector
              onProjectSelect={setProjectId}
            />
          </div>
          <Button onClick={generate} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Optionally select a project to include its research data as context.
        </p>
      </CardContent>
    </Card>
  );
}
