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
  .input(z.object({
    logo_url: z.string().nullable(),
    app_name: z.string().min(1),
    primary_color: z.string(),
    brand_color: z.string(),
    favicon_url: z.string().nullable(),
  }))
  .handler(async ({ data }) => {
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
