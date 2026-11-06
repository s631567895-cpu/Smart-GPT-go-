
CREATE OR REPLACE FUNCTION public.is_agent_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce((SELECT email FROM auth.users WHERE id = _user_id), '')) IN
    ('s631567895@gmail.com','hitesmarothiya84@gmail.com');
$$;

REVOKE ALL ON FUNCTION public.is_agent_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_agent_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_agent_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_agent_user(uuid) TO service_role;

CREATE TABLE public.agent_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  images text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_posts TO authenticated;
GRANT ALL ON public.agent_posts TO service_role;

ALTER TABLE public.agent_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent users read agent posts" ON public.agent_posts
FOR SELECT TO authenticated USING (public.is_agent_user(auth.uid()));

CREATE POLICY "agent users insert agent posts" ON public.agent_posts
FOR INSERT TO authenticated WITH CHECK (public.is_agent_user(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "agent users update agent posts" ON public.agent_posts
FOR UPDATE TO authenticated USING (public.is_agent_user(auth.uid())) WITH CHECK (public.is_agent_user(auth.uid()));

CREATE POLICY "agent users delete agent posts" ON public.agent_posts
FOR DELETE TO authenticated USING (public.is_agent_user(auth.uid()));

CREATE TRIGGER agent_posts_touch BEFORE UPDATE ON public.agent_posts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "agent users upload agent images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'agent-images' AND public.is_agent_user(auth.uid()));

CREATE POLICY "agent users read agent images" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'agent-images' AND public.is_agent_user(auth.uid()));

CREATE POLICY "agent users delete agent images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'agent-images' AND public.is_agent_user(auth.uid()));
