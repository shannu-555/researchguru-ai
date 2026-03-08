
-- Research documents table
CREATE TABLE public.research_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  file_type text NOT NULL,
  category text NOT NULL DEFAULT 'research',
  tags text[] DEFAULT '{}',
  ai_summary text,
  ai_key_insights jsonb,
  ai_competitor_mentions jsonb,
  ai_market_trends jsonb,
  analysis_status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.research_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own documents" ON public.research_documents
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Note tags table
CREATE TABLE public.note_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tag_name text NOT NULL,
  color text DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tag_name)
);

ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tags" ON public.note_tags
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Note-to-tag junction
CREATE TABLE public.note_tag_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.research_notes(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.note_tags(id) ON DELETE CASCADE,
  UNIQUE(note_id, tag_id)
);

ALTER TABLE public.note_tag_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their note tag links" ON public.note_tag_links
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.research_notes WHERE id = note_tag_links.note_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.research_notes WHERE id = note_tag_links.note_id AND user_id = auth.uid()));

-- Note versions for version history
CREATE TABLE public.note_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.research_notes(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their note versions" ON public.note_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.research_notes WHERE id = note_versions.note_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.research_notes WHERE id = note_versions.note_id AND user_id = auth.uid()));

-- Insight bookmarks
CREATE TABLE public.insight_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  note_id uuid REFERENCES public.research_notes(id) ON DELETE SET NULL,
  insight_type text NOT NULL,
  insight_content text NOT NULL,
  source_project_id uuid REFERENCES public.research_projects(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insight_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own bookmarks" ON public.insight_bookmarks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Storage bucket for research documents
INSERT INTO storage.buckets (id, name, public) VALUES ('research-documents', 'research-documents', false);

CREATE POLICY "Users can upload their own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'research-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'research-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'research-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
