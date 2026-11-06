-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own roles read" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admin check: role table OR the hardcoded owner email (verified via JWT)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  ) OR lower(coalesce(auth.jwt() ->> 'email','')) = 's631567895@gmail.com';
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- Ban flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;

-- Admin read/write policies
CREATE POLICY "admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins read all chat threads" ON public.chat_threads
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins read all chat messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins read all saved items" ON public.saved_items
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins read all image history" ON public.image_history
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins read all badges" ON public.user_badges
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins read all voice credits" ON public.voice_credits
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Admin message log
CREATE TABLE public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid NOT NULL,
  to_user_id uuid,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_messages TO authenticated;
GRANT ALL ON public.admin_messages TO service_role;
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read messages" ON public.admin_messages
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));