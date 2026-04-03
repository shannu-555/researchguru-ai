
-- Fix user_achievements: restrict INSERT to own user_id only
DROP POLICY IF EXISTS "System can create achievements" ON public.user_achievements;
CREATE POLICY "Users can create their own achievements"
  ON public.user_achievements
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

-- Fix user_notifications: restrict INSERT to own user_id only
DROP POLICY IF EXISTS "System can create notifications" ON public.user_notifications;
CREATE POLICY "Users can create their own notifications"
  ON public.user_notifications
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);
