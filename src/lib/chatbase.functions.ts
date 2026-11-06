import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mints a short-lived JWT so Chatbase can verify the signed-in user's identity.
 * The signing secret never leaves the server.
 */
export const getChatbaseToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const secret = process.env["CHATBOT_IDENTITY_SECRET"];
    if (!secret) return { token: null as string | null, configured: false };

    const { SignJWT } = await import("jose");
    const email = (context.claims as { email?: string } | null)?.email ?? null;

    const token = await new SignJWT({
      user_id: context.userId,
      ...(email ? { email } : {}),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(secret));

    return { token, configured: true };
  });
