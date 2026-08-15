import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSystemLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => 
    z.object({
      type: z.enum(["email", "auth", "system", "all"]).default("all"),
      limit: z.number().default(20),
      offset: z.number().default(0)
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    // Verify admin
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    
    if (!roles?.some(r => r.role === 'admin')) {
      throw new Error("Unauthorized");
    }

    if (data.type === "email") {
      const { data: logs, error } = await context.supabase
        .from("email_logs")
        .select(`
          *,
          profile:profiles(full_name, email)
        `)
        .order("created_at", { ascending: false })
        .range(data.offset, data.offset + data.limit - 1);
      
      const { count } = await context.supabase
        .from("email_logs")
        .select("*", { count: 'exact', head: true });
        
      if (error) throw error;
      return { type: "email", logs, count: count || 0 };
    }

    // Auth and System logs would come from other tables if implemented
    // For now, we return empty if not email logs
    return { type: data.type, logs: [] };
  });
