
-- 1. Add RESTRICTIVE policy to user_notifications to block anonymous access
CREATE POLICY "Require authentication for notifications"
ON public.user_notifications
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Fix overly permissive INSERT on user_notifications: replace WITH CHECK (true)
-- System inserts use service_role which bypasses RLS, so we can restrict this
DROP POLICY IF EXISTS "System can create notifications" ON public.user_notifications;
CREATE POLICY "System can create notifications"
ON public.user_notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Fix overly permissive INSERT on user_achievements: replace WITH CHECK (true)
-- System inserts use service_role which bypasses RLS, so we can restrict this
DROP POLICY IF EXISTS "System can create achievements" ON public.user_achievements;
CREATE POLICY "System can create achievements"
ON public.user_achievements
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Add RESTRICTIVE policy to user_achievements for defense-in-depth
CREATE POLICY "Require authentication for achievements"
ON public.user_achievements
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Version-control the has_project_access function (already exists in DB)
CREATE OR REPLACE FUNCTION public.has_project_access(
  _user_id uuid,
  _project_id uuid,
  _min_role project_role DEFAULT 'viewer'::project_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.research_projects WHERE id = _project_id AND user_id = _user_id
    UNION
    SELECT 1 FROM public.project_shares 
    WHERE project_id = _project_id 
      AND shared_with_user_id = _user_id
      AND (
        (_min_role = 'viewer') OR
        (_min_role = 'editor' AND role IN ('editor', 'owner')) OR
        (_min_role = 'owner' AND role = 'owner')
      )
  )
$$;
