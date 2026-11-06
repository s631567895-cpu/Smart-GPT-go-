
CREATE TABLE public.voice_credits (
  user_id uuid NOT NULL,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  seconds_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

GRANT SELECT, INSERT, UPDATE ON public.voice_credits TO authenticated;
GRANT ALL ON public.voice_credits TO service_role;

ALTER TABLE public.voice_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own voice credits"
ON public.voice_credits
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER touch_voice_credits
BEFORE UPDATE ON public.voice_credits
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
