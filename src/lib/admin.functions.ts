import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface BrandingSettings {
  logo_url: string | null;
  app_name: string;
  primary_color: string;
  brand_color: string;
  favicon_url: string | null;
}

const DEFAULT_BRANDING: BrandingSettings = {
  logo_url: null,
  app_name: "HostPanel",
  primary_color: "oklch(0.88 0.19 128)",
  brand_color: "oklch(0.72 0.19 148)",
  favicon_url: null,
};

export const getBranding = createServerFn({ method: "GET" }).handler(async () => {
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
});

export const updateBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        logo_url: z.string().nullable(),
        app_name: z.string().min(1),
        primary_color: z.string(),
        brand_color: z.string(),
        favicon_url: z.string().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
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
      const { logSessionEvent } = await import("@/lib/audit.functions");
      await logSessionEvent({
        data: {
          action: "branding.update",
          category: "branding",
          description: `Branding atualizado: ${data.app_name}`,
          status: "success",
          metadata: { branding: data },
        },
      });
    } catch (e) {
      console.error("Erro ao logar alteração de branding:", e);
    }

    return { success: true };
  });

export const impersonateClient = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ clientId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    return { success: true, clientId: data.clientId };
  });

export const updateClientProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        full_name: z.string().optional(),
        company_name: z.string().optional(),
        tax_id: z.string().optional(),
        phone: z.string().optional(),
        address_line: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postal_code: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...updates } = data;

    const sanitizedUpdates: Record<string, string | null> = {};
    Object.entries(updates).forEach(([key, value]) => {
      sanitizedUpdates[key] = value === undefined ? null : value;
    });

    const { error } = await context.supabase
      .from("profiles")
      .update(sanitizedUpdates as never)
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  });

export const bulkDeleteClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ clientIds: z.array(z.string().uuid()) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .delete()
      .in("id", data.clientIds);

    if (error) throw error;
    return {
      success: true,
      deletedCount: data.clientIds.length,
      failuresCount: 0,
    };
  });
