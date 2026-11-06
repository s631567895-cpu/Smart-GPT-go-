import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Sparkles, LogOut, MessageSquare, Menu, X, ChevronDown, User, Shield, Bot, LifeBuoy, Layers, Brain, WifiOff, Youtube } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkAdmin } from "@/lib/admin.functions";
import { RouteSplash } from "./brand-loader";


const NAV = [
  { to: "/chat", label: "Smart Chat", icon: MessageSquare },
  { to: "/offline", label: "Offline AI", icon: WifiOff },
  { to: "/build", label: "Build", icon: Layers },
] as const;


const BASE_MORE_NAV = [
  { to: "/profile", label: "Profile", icon: User },
  { to: "/support", label: "Help Assistant", icon: LifeBuoy },
] as const;

const ADMIN_NAV = { to: "/admin", label: "Admin", icon: Shield } as const;
const STUDIO_NAV = { to: "/studio", label: "Training Studio", icon: Brain } as const;


export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const checkAdminFn = useServerFn(checkAdmin);
  const gate = useQuery({ queryKey: ["admin-gate"], queryFn: () => checkAdminFn({}), staleTime: 5 * 60_000 });
  const MORE_NAV = [
    ...(gate.data?.isAdmin ? [STUDIO_NAV] : []),
    ...BASE_MORE_NAV,
    ...(gate.data?.isAdmin ? [ADMIN_NAV] : []),
  ];

  const me = useQuery({
    queryKey: ["me-avatar"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      return {
        avatar: (u?.user_metadata?.["avatar_url"] as string | undefined) ?? null,
        email: u?.email ?? "",
      };
    },
    staleTime: 5 * 60_000,
  });
  const avatarUrl = me.data?.avatar ?? null;
  const initial = (me.data?.email ?? "?").slice(0, 1).toUpperCase();


  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 backdrop-blur-xl" style={{ background: "oklch(0.15 0.03 265 / 0.7)" }}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            <span className="text-gradient">Smart GPT</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = pathname === n.to || pathname.startsWith(`${n.to}/`);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {n.label}
              </Link>
            );
          })}
          <div className="group relative">
            <button className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
              More <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <div className="absolute right-0 top-full hidden min-w-[180px] rounded-xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl group-hover:block">
              {MORE_NAV.map((n) => (
                <Link key={n.to} to={n.to} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground">
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/profile" aria-label="Your profile" className="shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Your profile"
                className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/40"
              />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary ring-2 ring-primary/30">
                {initial}
              </span>
            )}
          </Link>
          <button
            onClick={signOut}
            className="hidden items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>

          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 md:hidden"
            aria-label="Menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {[...NAV, ...MORE_NAV].map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground"
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            ))}
            <button
              onClick={signOut}
              className="mt-1 flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export function AppShell({ children, hideFooter = true }: { children: React.ReactNode; hideFooter?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <RouteSplash />
      <AppHeader />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      {!hideFooter && <SiteFooter />}
      <BottomBar />
    </div>
  );
}

const BOTTOM = [
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/analyzer", label: "YouTube", icon: Youtube },
  { to: "/build", label: "Build", icon: Layers },
  { to: "/offline", label: "Offline", icon: WifiOff },
  { to: "/profile", label: "Profile", icon: User },
] as const;

function BottomBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {BOTTOM.map((n) => {
          const active = pathname === n.to || pathname.startsWith(`${n.to}/`);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition-all duration-200 active:scale-90 ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${active ? "bg-primary/15" : ""}`}>
                <n.icon className="h-4.5 w-4.5" />
              </span>
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Re-export to avoid circular import in info pages
import { Footer as SiteFooter } from "./footer";
