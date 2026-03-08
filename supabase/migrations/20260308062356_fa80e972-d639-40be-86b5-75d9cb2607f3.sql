
CREATE TABLE public.recommendation_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.research_projects(id) ON DELETE CASCADE,
  recommendation_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id, recommendation_key)
);

ALTER TABLE public.recommendation_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own recommendation tracking"
  ON public.recommendation_tracking
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
