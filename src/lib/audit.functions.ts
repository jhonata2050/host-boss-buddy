import { getRequestHeader } from "@tanstack/react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const publicAuthEventSchema = z.object({
  action: z.enum(["login.failed", "signup.failed", "password_reset.requested", "password_reset.failed"]),
  email: z.string().trim().email().max(255).optional(),
  description: z.string().trim().min(1).max(300),
});

const sessionEventSchema = z.object({
  action: z.enum([
    "login.succeeded",
    "logout",
    "signup.succeeded",
    "password.changed",
    "impersonation.started",
    "impersonation.ended",
  ]),
  description: z.string().trim().min(1).max(300),
  entityType: z.string().trim().max(80).optional(),
  entityId: z.string().trim().max(120).optional(),
});

function requestContext() {
  const forwarded = getRequestHeader("x-forwarded-for");
  return {
    ipAddress: forwarded?.split(",")[0]?.trim() || getRequestHeader("cf-connecting-ip") || null,
    userAgent: getRequestHeader("user-agent")?.slice(0, 500) || null,
  };
}

export const logPublicAuthEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => publicAuthEventSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const request = requestContext();
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      category: "auth",
      action: data.action,
      status: data.action.endsWith("failed") ? "failure" : "success",
      actor_email: data.email ?? null,
      description: data.description,
      ip_address: request.ipAddress,
      user_agent: request.userAgent,
    });
    if (error) console.error("[Audit] Falha ao registrar evento público:", error.message);
    return { success: !error };
  });

export const logSessionEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sessionEventSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const request = requestContext();
    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      category: data.action.startsWith("impersonation") ? "security" : "auth",
      action: data.action,
      status: "success",
      actor_id: context.userId,
      actor_email: email,
      entity_type: data.entityType ?? null,
      entity_id: data.entityId ?? null,
      description: data.description,
      ip_address: request.ipAddress,
      user_agent: request.userAgent,
    });
    if (error) console.error("[Audit] Falha ao registrar evento de sessão:", error.message);
    return { success: !error };
  });