-- Create user profiles table for multi-profile support
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can view their own profiles"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profiles"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profiles"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profiles"
  ON public.user_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Create profile history table
CREATE TABLE IF NOT EXISTS public.profile_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profile_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view history of their profiles"
  ON public.profile_history FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create history for their profiles"
  ON public.profile_history FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

-- Create profile downloads table
CREATE TABLE IF NOT EXISTS public.profile_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT,
  download_date TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profile_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view downloads of their profiles"
  ON public.profile_downloads FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create downloads for their profiles"
  ON public.profile_downloads FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their profile downloads"
  ON public.profile_downloads FOR DELETE
  USING (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at on user_profiles
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();