import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("banned, onboarded")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.banned) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    if (profile && !profile.onboarded && location.pathname !== "/setup") {
      throw redirect({ to: "/setup" });
    }
    return { user: data.user };
  },

  component: () => <Outlet />,
});
