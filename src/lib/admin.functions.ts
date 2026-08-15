import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export interface BrandingSettings {
  logo_url: string | null;
  app_name: string;
  primary_color: string;
  brand_color: string;
  favicon_url: string | null;
}

export const getBranding = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "branding")
      .single();
    
    if (error || !data) {
      return {
        logo_url: null,
        app_name: "HostPanel",
        primary_color: "oklch(0.88 0.19 128)",
        brand_color: "oklch(0.72 0.19 148)",
        favicon_url: null
      } as BrandingSettings;
    }
    
    return data.value as unknown as BrandingSettings;
  });

export const updateBranding = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    logo_url: z.string().nullable(),
    app_name: z.string().min(1),
    primary_color: z.string(),
    brand_color: z.string(),
    favicon_url: z.string().nullable(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    // Log do evento de branding
    try {
      const { logSessionEvent } = await import("@/lib/audit.functions");
      await logSessionEvent({ data: {
        action: "branding.update",
        category: "branding",
        description: `Branding atualizado: ${data.app_name}`,
        status: "success",
        metadata: { branding: data }
      }});
    } catch (e) {
      console.error("Erro ao logar alteração de branding:", e);
    }

    const { error } = await supabase
      .from("system_settings")
      .upsert({
        key: "branding",
        value: data as any,
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
    return { success: true };
  });

export const impersonateClient = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    clientId: z.string().uuid(),
  }).parse(data))
  .handler(async ({ data }) => {
    return { success: true, clientId: data.clientId };
  });

export const updateClientProfile = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    id: z.string().uuid(),
    full_name: z.string().optional(),
    company_name: z.string().optional(),
    tax_id: z.string().optional(),
    phone: z.string().optional(),
    address_line: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { id, ...updates } = data;
    
    // Converte undefined para null explicitamente para satisfazer o Supabase types
    const sanitizedUpdates: any = {};
    Object.entries(updates).forEach(([key, value]) => {
      sanitizedUpdates[key] = value === undefined ? null : value;
    });

    const { error } = await supabase
      .from("profiles")
      .update(sanitizedUpdates)
      .eq("id", id);
    
    if (error) throw error;
    return { success: true };
  });

export const bulkDeleteClients = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    clientIds: z.array(z.string().uuid()),
  }).parse(data))
  .handler(async ({ data }) => {
    // Busca informações para os logs antes de deletar
    const { data: profiles } = await supabase
      .from("profiles")
      .select("email")
      .in("id", data.clientIds);

    const { error } = await supabase
      .from("profiles")
      .delete()
      .in("id", data.clientIds);
    
    if (error) throw error;
    return { 
      success: true, 
      deletedCount: data.clientIds.length,
      failuresCount: 0 
    };
  });
