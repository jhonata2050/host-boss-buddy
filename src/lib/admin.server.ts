import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULT_BRANDING, type BrandingSettings } from "./branding";
import { getRequestHeader } from "@tanstack/react-start/server";

export async function getBrandingImplementation() {
  const supabasePublic = createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabasePublic
    .from("system_settings")
    .select("value")
    .eq("key", "branding")
    .maybeSingle();

  if (error || !data) return DEFAULT_BRANDING;
  return { ...DEFAULT_BRANDING, ...(data.value as unknown as BrandingSettings) };
}

export async function updateBrandingImplementation(
  data: BrandingSettings,
  context: { supabase: any; userId: string; claims: any },
) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Acesso restrito a administradores.");

  const { error } = await context.supabase.from("system_settings").upsert({
    key: "branding",
    value: data as never,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const forwarded = getRequestHeader("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() || getRequestHeader("cf-connecting-ip") || null;
    const userAgent = getRequestHeader("user-agent")?.slice(0, 500) || null;
    const email = typeof context.claims.email === "string" ? context.claims.email : null;

    await supabaseAdmin.from("audit_logs").insert({
      category: "branding",
      action: "branding.update",
      status: "success",
      actor_id: context.userId,
      actor_email: email,
      description: `Branding atualizado: ${data.app_name}`,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: { branding: data } as any,
    });
  } catch (e) {
    console.error("Erro ao logar alteração de branding:", e);
  }

  return { success: true };
}

export async function updateClientProfileImplementation(
  data: any,
  context: { supabase: any },
) {
  const { id, ...updates } = data;

  const sanitizedUpdates: Record<string, string | null> = {};
  Object.entries(updates).forEach(([key, value]) => {
    sanitizedUpdates[key] = value === undefined ? null : value as any;
  });

  const { error } = await context.supabase
    .from("profiles")
    .update(sanitizedUpdates as never)
    .eq("id", id);

  if (error) throw error;
  return { success: true };
}

export async function bulkDeleteClientsImplementation(
  clientIds: string[],
  context: { supabase: any },
) {
  const { error } = await context.supabase
    .from("profiles")
    .delete()
    .in("id", clientIds);

  if (error) throw error;
  return {
    success: true,
    deletedCount: clientIds.length,
    failuresCount: 0,
  };
}
