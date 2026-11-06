CREATE TABLE public.kb_languages (
  code text PRIMARY KEY,
  name text NOT NULL,
  native_name text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  is_source boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 100
);
GRANT SELECT ON public.kb_languages TO authenticated;
GRANT ALL ON public.kb_languages TO service_role;
ALTER TABLE public.kb_languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read languages" ON public.kb_languages FOR SELECT TO authenticated USING (true);

INSERT INTO public.kb_languages (code, name, native_name, instructions, is_source, sort) VALUES
('hi','Hindi','हिन्दी','',true,1),
('en','English','English','',false,2),
('hinglish','Hinglish','Hinglish','Write natural Roman Hindi (Hindi words in Latin letters, as Indians type in chat). Do NOT translate into English. Example: "पृथ्वी सूर्य के चारों ओर घूमती है।" -> "Prithvi Surya ke chaaron taraf ghoomti hai."',false,3),
('es','Spanish','Español','',false,4),
('fr','French','Français','',false,5),
('de','German','Deutsch','',false,6),
('pt','Portuguese','Português','',false,7),
('ru','Russian','Русский','',false,8),
('ar','Arabic','العربية','',false,9),
('zh','Chinese','中文','Use Simplified Chinese.',false,10),
('ja','Japanese','日本語','',false,11),
('ko','Korean','한국어','',false,12);

CREATE TABLE public.kb_ml_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  heading_id uuid REFERENCES public.kb_headings(id) ON DELETE SET NULL,
  original_hindi text NOT NULL,
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  statuses jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_ml_items TO authenticated;
GRANT ALL ON public.kb_ml_items TO service_role;
ALTER TABLE public.kb_ml_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage multilang items" ON public.kb_ml_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER kb_ml_items_touch BEFORE UPDATE ON public.kb_ml_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Atomic per-language update so parallel translations never overwrite each other.
CREATE OR REPLACE FUNCTION public.kb_ml_set(_id uuid, _code text, _status text, _text text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  UPDATE public.kb_ml_items SET
    statuses = statuses || jsonb_build_object(_code, _status),
    translations = CASE WHEN _text IS NULL THEN translations ELSE translations || jsonb_build_object(_code, _text) END
  WHERE id = _id AND user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.kb_ml_set(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kb_ml_set(uuid, text, text, text) TO authenticated;