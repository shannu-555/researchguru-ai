import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BookmarkItem {
  id: string;
  insight_type: string;
  insight_content: string;
  note_id: string | null;
  created_at: string;
}

interface Props {
  userId: string;
  onSaveToNote: (content: string) => void;
}

export function InsightBookmarks({ userId, onSaveToNote }: Props) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);

  useEffect(() => {
    loadBookmarks();
  }, [userId]);

  const loadBookmarks = async () => {
    const { data } = await supabase
      .from("insight_bookmarks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setBookmarks(data as BookmarkItem[]);
  };

  const deleteBookmark = async (id: string) => {
    await supabase.from("insight_bookmarks").delete().eq("id", id);
    setBookmarks(prev => prev.filter(b => b.id !== id));
    toast.success("Bookmark removed");
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary" />
          Insight Bookmarks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bookmarks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No bookmarked insights yet. Save insights from your research to reference later.
          </p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {bookmarks.map(b => (
              <div key={b.id} className="p-3 border rounded-lg border-border/50 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">{b.insight_type}</Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onSaveToNote(b.insight_content)}>
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteBookmark(b.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm line-clamp-3">{b.insight_content}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
