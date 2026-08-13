import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const importSchema = z.object({
  clientsCsv: z.string().optional(),
  servicesCsv: z.string().optional(),
  invoicesCsv: z.string().optional(),
});

export const importWhmcsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => importSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    const isAdmin = roles?.some((r: { role: string }) => r.role === "admin") ?? false;
    if (!isAdmin) throw new Error("Unauthorized");

    const { runWhmcsImport } = await import("./whmcs-import.server");
    return runWhmcsImport(data);
  });

export const listWhmcsImports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("whmcs_imports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return data;
  });
