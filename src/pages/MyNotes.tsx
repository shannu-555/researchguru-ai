import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus, Trash2, BookOpen, Upload, Bookmark, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { DocumentLibrary } from "@/components/notes/DocumentLibrary";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { InsightBookmarks } from "@/components/notes/InsightBookmarks";
import { AINotesGenerator } from "@/components/notes/AINotesGenerator";
import { TagManager, TagItem } from "@/components/notes/TagManager";

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function MyNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [linkedTagIds, setLinkedTagIds] = useState<string[]>([]);
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [filteredNoteIds, setFilteredNoteIds] = useState<string[] | null>(null);

  const loadNotes = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("research_notes")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!error) setNotes(data || []);
  }, [user]);

  const loadTags = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("note_tags").select("*").order("tag_name");
    if (data) setTags(data as TagItem[]);
  }, [user]);

  useEffect(() => { loadNotes(); loadTags(); }, [loadNotes, loadTags]);

  // Load linked tags for selected note
  useEffect(() => {
    if (!selectedNote) { setLinkedTagIds([]); return; }
    supabase.from("note_tag_links").select("tag_id").eq("note_id", selectedNote.id)
      .then(({ data }) => setLinkedTagIds(data?.map(d => d.tag_id) || []));
  }, [selectedNote?.id]);

  // Filter notes by tag
  useEffect(() => {
    if (!filterTagId) { setFilteredNoteIds(null); return; }
    supabase.from("note_tag_links").select("note_id").eq("tag_id", filterTagId)
      .then(({ data }) => setFilteredNoteIds(data?.map(d => d.note_id) || []));
  }, [filterTagId]);

  const createNewNote = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("research_notes")
      .insert({ user_id: user.id, title: "Untitled Note", content: "" })
      .select()
      .single();
    if (error) { toast.error("Failed to create note"); return; }
    setNotes([data, ...notes]);
    setSelectedNote(data);
    toast.success("Note created");
  };

  const saveNote = async (title: string, content: string) => {
    if (!selectedNote) return;
    const { error } = await supabase
      .from("research_notes")
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq("id", selectedNote.id);
    if (error) { toast.error("Save failed"); return; }
    const updated = { ...selectedNote, title, content, updated_at: new Date().toISOString() };
    setSelectedNote(updated);
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    await supabase.from("research_notes").delete().eq("id", id);
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNote?.id === id) setSelectedNote(null);
    toast.success("Note deleted");
  };

  const toggleTag = async (tagId: string) => {
    if (!selectedNote) return;
    if (linkedTagIds.includes(tagId)) {
      await supabase.from("note_tag_links").delete().eq("note_id", selectedNote.id).eq("tag_id", tagId);
      setLinkedTagIds(prev => prev.filter(id => id !== tagId));
    } else {
      await supabase.from("note_tag_links").insert({ note_id: selectedNote.id, tag_id: tagId });
      setLinkedTagIds(prev => [...prev, tagId]);
    }
  };

  const handleAINoteGenerated = async (title: string, content: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("research_notes")
      .insert({ user_id: user.id, title, content })
      .select()
      .single();
    if (error) { toast.error("Failed to save generated note"); return; }
    setNotes(prev => [data, ...prev]);
    setSelectedNote(data);
  };

  const handleSaveInsightToNote = async (content: string) => {
    if (selectedNote) {
      const newContent = selectedNote.content + "\n\n---\n📌 Saved Insight:\n" + content;
      await saveNote(selectedNote.title, newContent);
      toast.success("Insight added to current note");
    } else {
      await handleAINoteGenerated("Insight Note", content);
    }
  };

  const displayNotes = filteredNoteIds ? notes.filter(n => filteredNoteIds.includes(n.id)) : notes;

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Research Knowledge Hub
        </h1>
        <p className="text-muted-foreground text-lg">
          Notes, documents, bookmarks & AI-powered research management
        </p>
      </div>

      <Tabs defaultValue="notes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-lg mx-auto">
          <TabsTrigger value="notes" className="gap-1.5"><FileText className="h-4 w-4" /> Notes</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5"><Upload className="h-4 w-4" /> Docs</TabsTrigger>
          <TabsTrigger value="bookmarks" className="gap-1.5"><Bookmark className="h-4 w-4" /> Bookmarks</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5"><Sparkles className="h-4 w-4" /> AI</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-4">
          {user && (
            <TagManager
              userId={user.id}
              tags={tags}
              onTagsChange={setTags}
              filterTagId={filterTagId}
              onFilterChange={setFilterTagId}
            />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Notes List */}
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    All Notes
                  </CardTitle>
                  <CardDescription>{displayNotes.length} notes</CardDescription>
                </div>
                <Button onClick={createNewNote} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> New
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                {displayNotes.map(note => (
                  <div
                    key={note.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] ${
                      selectedNote?.id === note.id
                        ? "bg-primary/10 border-primary"
                        : "bg-card border-border/50 hover:bg-accent/50"
                    }`}
                    onClick={() => setSelectedNote(note)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate text-sm">{note.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {new Date(note.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); deleteNote(note.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {displayNotes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {filterTagId ? "No notes with this tag" : "No notes yet. Create your first!"}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Note Editor */}
            {user && (
              <NoteEditor
                note={selectedNote}
                userId={user.id}
                tags={tags}
                linkedTagIds={linkedTagIds}
                onSave={saveNote}
                onTagToggle={toggleTag}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents">
          {user && <DocumentLibrary userId={user.id} />}
        </TabsContent>

        <TabsContent value="bookmarks">
          {user && <InsightBookmarks userId={user.id} onSaveToNote={handleSaveInsightToNote} />}
        </TabsContent>

        <TabsContent value="ai">
          {user && <AINotesGenerator userId={user.id} onNoteGenerated={handleAINoteGenerated} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
