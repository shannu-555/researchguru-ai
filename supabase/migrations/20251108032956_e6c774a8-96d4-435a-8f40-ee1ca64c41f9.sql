-- Create workspace_collaborators table for team collaboration
CREATE TABLE IF NOT EXISTS public.workspace_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborator_email TEXT NOT NULL,
  collaborator_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(workspace_owner_id, collaborator_email)
);

-- Enable RLS
ALTER TABLE public.workspace_collaborators ENABLE ROW LEVEL SECURITY;

-- Workspace owners can manage their collaborators
CREATE POLICY "Workspace owners can manage collaborators"
ON public.workspace_collaborators
FOR ALL
USING (auth.uid() = workspace_owner_id)
WITH CHECK (auth.uid() = workspace_owner_id);

-- Collaborators can view their invitations
CREATE POLICY "Users can view their invitations"
ON public.workspace_collaborators
FOR SELECT
USING (collaborator_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Collaborators can update their own invitation status
CREATE POLICY "Users can update their invitation status"
ON public.workspace_collaborators
FOR UPDATE
USING (collaborator_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
WITH CHECK (collaborator_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Create workspace_annotations table for collaborative notes
CREATE TABLE IF NOT EXISTS public.workspace_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annotation_text TEXT NOT NULL,
  annotation_type TEXT NOT NULL DEFAULT 'note' CHECK (annotation_type IN ('note', 'highlight', 'comment')),
  position_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workspace_annotations ENABLE ROW LEVEL SECURITY;

-- Users can create annotations on projects they have access to
CREATE POLICY "Users can create annotations on accessible projects"
ON public.workspace_annotations
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  has_project_access(auth.uid(), project_id)
);

-- Users can view annotations on projects they have access to
CREATE POLICY "Users can view annotations on accessible projects"
ON public.workspace_annotations
FOR SELECT
USING (has_project_access(auth.uid(), project_id));

-- Users can update their own annotations
CREATE POLICY "Users can update their own annotations"
ON public.workspace_annotations
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own annotations
CREATE POLICY "Users can delete their own annotations"
ON public.workspace_annotations
FOR DELETE
USING (auth.uid() = user_id);

-- Add updated_at trigger for workspace_annotations
CREATE TRIGGER update_workspace_annotations_updated_at
BEFORE UPDATE ON public.workspace_annotations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();