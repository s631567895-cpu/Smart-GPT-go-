-- 1. Teaching understanding fields on agent_posts
ALTER TABLE public.agent_posts
  ADD COLUMN IF NOT EXISTS understood boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS understanding text NOT NULL DEFAULT '';

-- 2. Clear all previously taught tags/answers
DELETE FROM public.agent_posts;

-- 3. Light: behaviour rules for the agent
CREATE TABLE IF NOT EXISTS public.agent_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'do',
  rule text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_rules TO authenticated;
GRANT ALL ON public.agent_rules TO service_role;
ALTER TABLE public.agent_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent users read rules" ON public.agent_rules FOR SELECT TO authenticated USING (public.is_agent_user(auth.uid()));
CREATE POLICY "agent users insert rules" ON public.agent_rules FOR INSERT TO authenticated WITH CHECK (public.is_agent_user(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "agent users update rules" ON public.agent_rules FOR UPDATE TO authenticated USING (public.is_agent_user(auth.uid())) WITH CHECK (public.is_agent_user(auth.uid()));
CREATE POLICY "agent users delete rules" ON public.agent_rules FOR DELETE TO authenticated USING (public.is_agent_user(auth.uid()));

-- 4. Persistent Agent Mind conversation per user
CREATE TABLE IF NOT EXISTS public.agent_mind_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_mind_messages_user_created_idx ON public.agent_mind_messages (user_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_mind_messages TO authenticated;
GRANT ALL ON public.agent_mind_messages TO service_role;
ALTER TABLE public.agent_mind_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent mind messages" ON public.agent_mind_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);