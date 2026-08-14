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
    
    const results = await Promise.all(
      data.clientIds.map(async (id) => {
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
