CREATE OR REPLACE FUNCTION public.consume_voice_seconds(_seconds integer, _cap integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _used integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _seconds IS NULL OR _seconds < 1 OR _seconds > _cap THEN
    RAISE EXCEPTION 'Invalid seconds';
  END IF;

  INSERT INTO public.voice_credits (user_id, day, seconds_used)
  VALUES (_uid, _today, 0)
  ON CONFLICT (user_id, day) DO NOTHING;

  UPDATE public.voice_credits
  SET seconds_used = seconds_used + _seconds, updated_at = now()
  WHERE user_id = _uid AND day = _today
    AND seconds_used + _seconds <= _cap
  RETURNING seconds_used INTO _used;

  IF _used IS NULL THEN
    RAISE EXCEPTION 'Daily voice limit reached';
  END IF;

  RETURN _used;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_voice_seconds(integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_voice_seconds(integer, integer) TO authenticated;