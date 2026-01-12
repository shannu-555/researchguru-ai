-- Fix 1: Restrict workspace_collaborators SELECT to only owner or invited collaborator
DROP POLICY IF EXISTS "Users can view invitations to their email" ON public.workspace_collaborators;
DROP POLICY IF EXISTS "Workspace owners can manage collaborators" ON public.workspace_collaborators;

-- Create proper SELECT policy that restricts to owner or collaborator
CREATE POLICY "Users can view their own collaborations" 
ON public.workspace_collaborators 
FOR SELECT 
USING (
  auth.uid() = workspace_owner_id OR 
  auth.uid() = collaborator_user_id OR
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = workspace_collaborators.collaborator_email
  )
);

-- Allow workspace owners to insert collaborators
CREATE POLICY "Workspace owners can invite collaborators" 
ON public.workspace_collaborators 
FOR INSERT 
WITH CHECK (auth.uid() = workspace_owner_id);

-- Allow workspace owners to update collaborators
CREATE POLICY "Workspace owners can update collaborators" 
ON public.workspace_collaborators 
FOR UPDATE 
USING (auth.uid() = workspace_owner_id);

-- Allow workspace owners to delete collaborators
CREATE POLICY "Workspace owners can delete collaborators" 
ON public.workspace_collaborators 
FOR DELETE 
USING (auth.uid() = workspace_owner_id);

-- Fix 2: Restrict user_activity policies to only allow users to manage their own activity
DROP POLICY IF EXISTS "System can manage activity" ON public.user_activity;
DROP POLICY IF EXISTS "Users can view their own activity" ON public.user_activity;

-- Users can only view their own activity
CREATE POLICY "Users can view their own activity" 
ON public.user_activity 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can only insert their own activity
CREATE POLICY "Users can insert their own activity" 
ON public.user_activity 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own activity
CREATE POLICY "Users can update their own activity" 
ON public.user_activity 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can only delete their own activity
CREATE POLICY "Users can delete their own activity" 
ON public.user_activity 
FOR DELETE 
USING (auth.uid() = user_id);