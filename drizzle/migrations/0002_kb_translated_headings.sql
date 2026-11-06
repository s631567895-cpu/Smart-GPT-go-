ALTER TABLE public.kb_headings ADD COLUMN IF NOT EXISTS source_heading_id uuid REFERENCES public.kb_headings(id) ON DELETE CASCADE;
ALTER TABLE public.kb_headings ADD COLUMN IF NOT EXISTS lang text;
ALTER TABLE public.kb_headings ADD COLUMN IF NOT EXISTS translation_status text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS kb_headings_source_lang_uq ON public.kb_headings(source_heading_id, lang) WHERE source_heading_id IS NOT NULL;