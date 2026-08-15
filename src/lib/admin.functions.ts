import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const bulkDeleteClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ clientIds: z.array(z.string().uuid()) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Verify if the requester is an admin
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (roleError) throw roleError;
    if (!roles?.some(r => r.role === 'admin')) {
      throw new Error("Unauthorized: Admin role required for bulk deletion.");
    }

    // 2. Perform deletion using supabaseAdmin to bypass RLS and handle related records
    // auth.users deletion cascades to profiles, user_roles, services, invoices, etc. 
    // because of the ON DELETE CASCADE set up in migrations.
    
    // 2a. Proteção: nunca excluir a si mesmo nem contas admin/staff
    const { data: privileged } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("user_id", data.clientIds)
      .in("role", ["admin", "staff"]);

    const protectedIds = new Set([
      context.userId,
      ...(privileged ?? []).map((r) => r.user_id),
    ]);

    const deletableIds = data.clientIds.filter((id) => !protectedIds.has(id));
    if (deletableIds.length === 0) {
      throw new Error("Nenhum cliente elegível: contas de admin/staff não podem ser excluídas aqui.");
    }

    const results = await Promise.all(
      deletableIds.map(async (id) => {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
        return { id, success: !error, error };
      })
    );

    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.error("Bulk delete partial failures:", failures);
    }

    return { 
      total: data.clientIds.length, 
      deleted: results.filter(r => r.success).length,
      failures: failures.length
    };
  });

const profileFields = z.object({
  full_name: z.string().nullish(),
  company_name: z.string().nullish(),
  tax_id: z.string().nullish(),
  phone: z.string().nullish(),
  address_line: z.string().nullish(),
  address_line2: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  postal_code: z.string().nullish(),
  country: z.string().nullish(),
  notes: z.string().nullish(),
  status: z.string().nullish(),
});

/** Atualiza o perfil de um cliente específico (somente admin/staff). */
export const updateClientProfile = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ clientId: z.string().uuid(), values: profileFields }).parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (roleError) throw roleError;
    if (!roles?.some((r) => r.role === "admin" || r.role === "staff")) {
      throw new Error("Unauthorized");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Só envia os campos realmente preenchidos no formulário e remove sensíveis
    const payload: Record<string, string | null> = {};
    const allowedFields = [
      "full_name", "company_name", "tax_id", "phone", 
      "address_line", "address_line2", "city", "state", 
      "postal_code", "country", "notes", "status"
    ];

    for (const [key, value] of Object.entries(data.values)) {
      if (!allowedFields.includes(key)) continue;
      if (value === undefined) continue;
      payload[key] = value === "" || value === null ? null : String(value);
    }

    console.log(`[Admin] Updating client profile ${data.clientId} with payload:`, payload);

    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update(payload as never)
      .eq("id", data.clientId)
      .select("id, email")
      .maybeSingle();

    if (error) {
      console.error(`[Admin] Error updating client profile ${data.clientId}:`, error);
      throw new Error(error.message);
    }
    
    if (!updated) {
      console.warn(`[Admin] Client profile ${data.clientId} not found for update.`);
      throw new Error("Perfil do cliente não encontrado para atualização.");
    }

    console.log(`[Admin] Successfully updated client ${updated.id} (${updated.email})`);
    return { id: updated.id };
  });

export const impersonateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ clientId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // 1. Verify admin role
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (roleError) throw roleError;
    if (!roles?.some(r => r.role === 'admin')) {
      throw new Error("Unauthorized");
    }

    // In a real Supabase environment, we can't easily "impersonate" by creating a session for another user
    // without their password or a magic link. 
    // However, we can return a flag or a temporary "admin-as-user" token if the app supports it.
    // For this implementation, we will use a "bridge" approach where the frontend 
    // marks the session as impersonated.
    
    return { success: true, clientId: data.clientId };
  });
