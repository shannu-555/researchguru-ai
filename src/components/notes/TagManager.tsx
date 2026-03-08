import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TagItem {
  id: string;
  tag_name: string;
  color: string;
}

interface Props {
  userId: string;
  tags: TagItem[];
  onTagsChange: (tags: TagItem[]) => void;
  filterTagId: string | null;
  onFilterChange: (tagId: string | null) => void;
}

export function TagManager({ userId, tags, onTagsChange, filterTagId, onFilterChange }: Props) {
  const [newTag, setNewTag] = useState("");

  const addTag = async () => {
    if (!newTag.trim()) return;
    const colors = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444"];
    const color = colors[tags.length % colors.length];

    const { data, error } = await supabase
      .from("note_tags")
      .insert({ user_id: userId, tag_name: newTag.trim(), color })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") toast.error("Tag already exists");
      else toast.error("Failed to create tag");
      return;
    }
    onTagsChange([...tags, data as TagItem]);
    setNewTag("");
  };

  const deleteTag = async (id: string) => {
    await supabase.from("note_tags").delete().eq("id", id);
    onTagsChange(tags.filter(t => t.id !== id));
    if (filterTagId === id) onFilterChange(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 border rounded-lg border-border/50 bg-card">
      <Badge
        variant={filterTagId === null ? "default" : "outline"}
        className="cursor-pointer text-xs"
        onClick={() => onFilterChange(null)}
      >
        All
      </Badge>
      {tags.map(tag => (
        <Badge
          key={tag.id}
          variant={filterTagId === tag.id ? "default" : "outline"}
          className="cursor-pointer text-xs group"
          style={filterTagId === tag.id ? { backgroundColor: tag.color } : {}}
          onClick={() => onFilterChange(filterTagId === tag.id ? null : tag.id)}
        >
          {tag.tag_name}
          <X
            className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => { e.stopPropagation(); deleteTag(tag.id); }}
          />
        </Badge>
      ))}
      <div className="flex items-center gap-1">
        <Input
          placeholder="New tag"
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTag()}
          className="h-7 w-24 text-xs"
        />
        <Button variant="ghost" size="sm" onClick={addTag} className="h-7 w-7 p-0">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
