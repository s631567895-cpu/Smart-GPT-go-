CREATE TABLE public.kb_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_folders TO authenticated;
GRANT ALL ON public.kb_folders TO service_role;
ALTER TABLE public.kb_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage folders" ON public.kb_folders FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX kb_folders_user_idx ON public.kb_folders(user_id);
CREATE TRIGGER kb_folders_touch BEFORE UPDATE ON public.kb_folders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();