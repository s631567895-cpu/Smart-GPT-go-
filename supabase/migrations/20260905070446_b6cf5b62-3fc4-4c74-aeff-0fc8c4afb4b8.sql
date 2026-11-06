
-- HEADINGS
CREATE TABLE public.kb_headings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_headings TO authenticated;
GRANT ALL ON public.kb_headings TO service_role;
ALTER TABLE public.kb_headings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kb headings" ON public.kb_headings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER kb_headings_touch BEFORE UPDATE ON public.kb_headings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- KNOWLEDGE
CREATE TABLE public.kb_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  heading_id uuid NOT NULL REFERENCES public.kb_headings(id) ON DELETE CASCADE,
  subtopic text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  lang text NOT NULL DEFAULT 'auto',
  source text NOT NULL DEFAULT '',
  weight real NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kb_entries_heading_idx ON public.kb_entries (heading_id);
CREATE INDEX kb_entries_user_created_idx ON public.kb_entries (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_entries TO authenticated;
GRANT ALL ON public.kb_entries TO service_role;
ALTER TABLE public.kb_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kb entries" ON public.kb_entries FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER kb_entries_touch BEFORE UPDATE ON public.kb_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- CONVERSATION EXAMPLES
CREATE TABLE public.kb_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  heading_id uuid REFERENCES public.kb_headings(id) ON DELETE SET NULL,
  user_message text NOT NULL,
  ai_message text NOT NULL,
  lang text NOT NULL DEFAULT 'auto',
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kb_conversations_user_idx ON public.kb_conversations (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_conversations TO authenticated;
GRANT ALL ON public.kb_conversations TO service_role;
ALTER TABLE public.kb_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kb conversations" ON public.kb_conversations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER kb_conversations_touch BEFORE UPDATE ON public.kb_conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- IMAGES
CREATE TABLE public.kb_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  heading_id uuid REFERENCES public.kb_headings(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kb_images_user_idx ON public.kb_images (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_images TO authenticated;
GRANT ALL ON public.kb_images TO service_role;
ALTER TABLE public.kb_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kb images" ON public.kb_images FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER kb_images_touch BEFORE UPDATE ON public.kb_images
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- MY LLM
CREATE TABLE public.kb_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  is_active boolean NOT NULL DEFAULT false,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  vocab_size integer NOT NULL DEFAULT 0,
  doc_count integer NOT NULL DEFAULT 0,
  trained_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_models TO authenticated;
GRANT ALL ON public.kb_models TO service_role;
ALTER TABLE public.kb_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kb models" ON public.kb_models FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER kb_models_touch BEFORE UPDATE ON public.kb_models
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- TRAINED INDEX: documents
CREATE TABLE public.kb_model_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  model_id uuid NOT NULL REFERENCES public.kb_models(id) ON DELETE CASCADE,
  source_kind text NOT NULL,
  source_id uuid,
  heading_id uuid,
  heading_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  text text NOT NULL,
  answer text NOT NULL DEFAULT '',
  length integer NOT NULL DEFAULT 0
);
CREATE INDEX kb_model_docs_model_idx ON public.kb_model_docs (model_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_model_docs TO authenticated;
GRANT ALL ON public.kb_model_docs TO service_role;
ALTER TABLE public.kb_model_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kb model docs" ON public.kb_model_docs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TRAINED INDEX: vocabulary / postings
CREATE TABLE public.kb_model_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  model_id uuid NOT NULL REFERENCES public.kb_models(id) ON DELETE CASCADE,
  term text NOT NULL,
  df integer NOT NULL DEFAULT 0,
  idf real NOT NULL DEFAULT 0,
  postings jsonb NOT NULL DEFAULT '[]'::jsonb,
  heading_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (model_id, term)
);
CREATE INDEX kb_model_terms_model_idx ON public.kb_model_terms (model_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_model_terms TO authenticated;
GRANT ALL ON public.kb_model_terms TO service_role;
ALTER TABLE public.kb_model_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kb model terms" ON public.kb_model_terms FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TRAINING RUNS
CREATE TABLE public.kb_training_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  model_id uuid REFERENCES public.kb_models(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  log text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX kb_training_runs_user_idx ON public.kb_training_runs (user_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_training_runs TO authenticated;
GRANT ALL ON public.kb_training_runs TO service_role;
ALTER TABLE public.kb_training_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kb training runs" ON public.kb_training_runs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TESTS
CREATE TABLE public.kb_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question text NOT NULL,
  expected text NOT NULL DEFAULT '',
  last_answer text NOT NULL DEFAULT '',
  last_score real,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kb_tests_user_idx ON public.kb_tests (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_tests TO authenticated;
GRANT ALL ON public.kb_tests TO service_role;
ALTER TABLE public.kb_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kb tests" ON public.kb_tests FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER kb_tests_touch BEFORE UPDATE ON public.kb_tests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
