import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getVPSAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    if (!userId) throw new Error("Unauthorized");

    // Verificar se é admin
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (!role) throw new Error("Forbidden");

    const { data: instances, error } = await supabaseAdmin
      .from('vps_instances')
      .select('*, service:services(*, profile:profiles(email, full_name))');

    if (error) throw error;
    return instances;
  });

export const updateVPSInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    id: z.string(),
    external_id: z.string().optional(),
    ip_address: z.string().optional(),
    status: z.string().optional(),
    notes: z.string().optional()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    if (!userId) throw new Error("Unauthorized");

    // Verificar se é admin
    const { data: role } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (!role) throw new Error("Forbidden");

    const { error } = await supabaseAdmin
      .from('vps_instances')
      .update(data as any)
      .eq('id', data.id);

    if (error) throw error;
    return { success: true };
  });
