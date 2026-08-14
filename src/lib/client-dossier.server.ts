import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export async function fetchClientDossier(
  supabase: SupabaseClient<Database>,
  userId: string,
  clientId: string,
) {
  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (roleError) throw roleError;
  if (!roles?.some(({ role }) => role === "admin" || role === "staff")) {
    throw new Error("Acesso restrito à equipe administrativa.");
  }

  const [profile, invoices, services, tickets, emailLogs] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", clientId).single(),
    supabase.from("invoices").select("*").eq("user_id", clientId).order("created_at", { ascending: false }),
    supabase.from("services").select("*, products(name)").eq("user_id", clientId).order("created_at", { ascending: false }),
    supabase.from("tickets").select("*").eq("user_id", clientId).order("created_at", { ascending: false }),
    supabase.from("email_logs").select("*").eq("user_id", clientId).order("created_at", { ascending: false }),
  ]);

  const error = profile.error || invoices.error || services.error || tickets.error || emailLogs.error;
  if (error) throw error;

  return {
    ...profile.data,
    invoices: invoices.data ?? [],
    services: services.data ?? [],
    tickets: tickets.data ?? [],
    email_logs: emailLogs.data ?? [],
  };
}