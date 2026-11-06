-- Trigger-only functions: not callable via API at all
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Helper functions: signed-in users only (required by RLS policies), never anon
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consume_voice_seconds(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_voice_seconds(integer, integer) TO authenticated;

-- admin_messages: allow admins to write/update their own log entries
GRANT INSERT, UPDATE ON public.admin_messages TO authenticated;

CREATE POLICY "admins insert messages"
ON public.admin_messages FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND sent_by = auth.uid());

CREATE POLICY "admins update messages"
ON public.admin_messages FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));