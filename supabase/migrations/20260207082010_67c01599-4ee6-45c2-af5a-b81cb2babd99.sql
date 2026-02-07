-- Add RESTRICTIVE policies requiring authentication on sensitive tables
-- This provides defense-in-depth: even if a permissive policy is added later,
-- anonymous access will still be blocked.

-- user_api_keys: Require authentication for ALL operations
CREATE POLICY "Require authentication for api keys"
ON public.user_api_keys
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- profiles: Require authentication for ALL operations
CREATE POLICY "Require authentication for profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);