import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BrandingSettings } from "./branding";

export type { BrandingSettings };

export const getBranding = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getBrandingImplementation } = await import("./admin.server");
    return await getBrandingImplementation();
  } catch (error) {
    console.error("Error in getBranding server function:", error);
    // Fallback import directly to avoid recursive issues if the server file has errors
    const { DEFAULT_BRANDING } = await import("./branding");
    return DEFAULT_BRANDING;
  }
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
    const { updateBrandingImplementation } = await import("./admin.server");
    return updateBrandingImplementation(data as BrandingSettings, context);
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
    const { updateClientProfileImplementation } = await import("./admin.server");
    return updateClientProfileImplementation(data, context);
  });

export const bulkDeleteClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ clientIds: z.array(z.string().uuid()) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { bulkDeleteClientsImplementation } = await import("./admin.server");
    return bulkDeleteClientsImplementation(data.clientIds, context);
  });
