CREATE TABLE public.offline_packs (
  id text PRIMARY KEY DEFAULT 'main',
  docs jsonb NOT NULL DEFAULT '[]'::jsonb,
  doc_count integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.offline_packs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offline_packs TO authenticated;
GRANT ALL ON public.offline_packs TO service_role;
ALTER TABLE public.offline_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published pack" ON public.offline_packs FOR SELECT TO anon, authenticated USING (published = true);
CREATE POLICY "Admin reads pack" ON public.offline_packs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin inserts pack" ON public.offline_packs FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admin updates pack" ON public.offline_packs FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admin deletes pack" ON public.offline_packs FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));