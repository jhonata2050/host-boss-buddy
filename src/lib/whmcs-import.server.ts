import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ImportStats = {
  clients: { created: number; updated: number; failed: number };
  services: { created: number; failed: number };
  invoices: { created: number; failed: number };
  errors: string[];
};

export function emptyStats(): ImportStats {
  return {
    clients: { created: 0, updated: 0, failed: 0 },
    services: { created: 0, failed: 0 },
    invoices: { created: 0, failed: 0 },
    errors: [],
  };
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v) return v;
  }
  return "";
}

function toDate(value: string): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v === "0000-00-00" || v === "0000-00-00 00:00:00") return null;
  const d = new Date(v.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toNumber(value: string): number {
  if (!value) return 0;
  const n = Number(value.replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}

const CYCLE_MAP: Record<string, string> = {
  monthly: "monthly",
  mensal: "monthly",
  quarterly: "quarterly",
  trimestral: "quarterly",
  semiannually: "semiannually",
  semestral: "semiannually",
  annually: "annually",
  anual: "annually",
  biennially: "biennially",
  bienal: "biennially",
};

const SERVICE_STATUS_MAP: Record<string, string> = {
  active: "active",
  pending: "pending",
  suspended: "suspended",
  terminated: "terminated",
  cancelled: "cancelled",
  canceled: "cancelled",
};

const INVOICE_STATUS_MAP: Record<string, string> = {
  paid: "paid",
  unpaid: "unpaid",
  cancelled: "cancelled",
  canceled: "cancelled",
  refunded: "refunded",
  draft: "draft",
  collections: "unpaid",
};

async function resolveUserId(email: string): Promise<string | null> {
  if (!email) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

/** Importa clientes do WHMCS (tbclients export). */
async function importClients(rows: Record<string, string>[], stats: ImportStats) {
  for (const row of rows) {
    const email = pick(row, ["email", "e-mail", "email_address", "mail", "client_email", "clientemail"]).toLowerCase();
    if (!email) continue;

    const fullName =
      pick(row, ["full_name", "name", "nome"]) ||
      `${pick(row, ["firstname", "first_name"])} ${pick(row, ["lastname", "last_name"])}`.trim();

    const profile = {
      full_name: fullName || null,
      email,
      company_name: pick(row, ["companyname", "company_name", "empresa"]) || null,
      tax_id: pick(row, ["tax_id", "taxid", "cpf", "cnpj", "documento"]) || null,
      phone: pick(row, ["phonenumber", "phone", "telefone"]) || null,
      address_line: pick(row, ["address1", "address_line", "endereco"]) || null,
      address_line2: pick(row, ["address2", "address_line2"]) || null,
      city: pick(row, ["city", "cidade"]) || null,
      state: pick(row, ["state", "estado"]) || null,
      postal_code: pick(row, ["postcode", "postal_code", "cep"]) || null,
      country: pick(row, ["country", "pais"]) || "BR",
      notes: "Importado do WHMCS",
    };

    try {
      const existing = await resolveUserId(email);
      if (existing) {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update(profile)
          .eq("id", existing);
        if (error) throw new Error(error.message);
        stats.clients.updated++;
        continue;
      }

      const { data: created, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          password: crypto.randomUUID() + "Aa1!",
          user_metadata: { full_name: fullName, imported_from: "whmcs" },
        });

      if (authError || !created.user) {
        throw new Error(authError?.message ?? "Falha ao criar usuário");
      }

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: created.user.id, ...profile }, { onConflict: "id" });
      if (profileError) throw new Error(profileError.message);

      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: created.user.id, role: "client" }, { onConflict: "user_id,role" });

      stats.clients.created++;
    } catch (e) {
      stats.clients.failed++;
      if (stats.errors.length < 50) {
        stats.errors.push(`Cliente ${email}: ${(e as Error).message}`);
      }
    }
  }
}

async function resolveProductId(name: string): Promise<string | null> {
  if (!name) return null;
  // Normaliza o nome para busca
  const cleanName = name.trim();
  
  const { data: existing } = await supabaseAdmin
    .from("products")
    .select("id")
    .ilike("name", cleanName)
    .maybeSingle();
  if (existing) return existing.id;

  const slug =
    cleanName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `whmcs-${Date.now()}`;

  // Se não existe, cria um produto "rascunho" invisível
  const { data: created, error } = await supabaseAdmin
    .from("products")
    .insert({
      name: cleanName,
      slug,
      description: "Produto importado automaticamente do WHMCS",
      is_visible: false,
      auto_provision: false,
      // Assume um preço 0 para não quebrar, o admin deve configurar depois
    })
    .select("id")
    .single();

  if (error) {
    console.error("Erro ao criar produto na importação:", error);
    return null;
  }
  return created.id;
}

/** Importa serviços/hospedagens do WHMCS (tblhosting export). */
async function importServices(rows: Record<string, string>[], stats: ImportStats) {
  for (const row of rows) {
    // Tenta encontrar o e-mail do cliente em diversas colunas possíveis
    const email = pick(row, [
      "email",
      "client_email",
      "e-mail",
      "user_email",
      "mail",
      "clientemail",
      "userid_email",
    ]).toLowerCase();

    // Se não tiver e-mail na linha, tenta o userid (WHMCS usa IDs numéricos internamente)
    // Se o dump for de uma tabela relacional, o e-mail pode estar em outra tabela,
    // mas o usuário pode ter incluído o e-mail no CSV via JOIN ou export customizado.
    if (!email) {
      const userIdWhmcs = pick(row, ["userid", "clientid", "user_id", "client_id"]);
      if (!userIdWhmcs) continue;
      // Nota: Não temos o mapeamento ID WHMCS -> ID HostPanel aqui se o dump for parcial.
      // O ideal é que o CSV de serviços contenha o e-mail para correlação.
      continue;
    }

    try {
      const userId = await resolveUserId(email);
      if (!userId) {
        // Tenta buscar pelo nome do cliente se o e-mail falhar (fallback arriscado mas útil em dumps manuais)
        continue;
      }

      const productName = pick(row, ["product", "produto", "packagename", "product_name", "package"]);
      const productId = await resolveProductId(productName || "Plano Importado");
      if (!productId) throw new Error("não foi possível resolver o produto");

      const cycleRaw = pick(row, ["billingcycle", "billing_cycle", "ciclo"]).toLowerCase();
      const cycle = CYCLE_MAP[cycleRaw] ?? "monthly";
      
      const statusRaw = pick(row, ["status", "domainstatus", "state"]).toLowerCase();
      const status = SERVICE_STATUS_MAP[statusRaw] ?? "active";

      const domain = pick(row, ["domain", "dominio", "host", "hostname"]);
      const username = pick(row, ["username", "usuario", "login", "user"]);
      const nextDue = toDate(pick(row, ["nextduedate", "next_due_date", "vencimento", "next_due"]));

      const { error } = await supabaseAdmin.from("services").insert({
        user_id: userId,
        product_id: productId,
        domain: domain || null,
        username: username || null,
        billing_cycle: cycle as any,
        status: status as any,
        next_due_date: nextDue,
      });

      if (error) throw new Error(error.message);
      stats.services.created++;
    } catch (e) {
      stats.services.failed++;
      if (stats.errors.length < 50) {
        stats.errors.push(`Serviço ${email}: ${(e as Error).message}`);
      }
    }
  }
}

/** Importa faturas do WHMCS (tblinvoices export). */
async function importInvoices(rows: Record<string, string>[], stats: ImportStats) {
  for (const row of rows) {
    const email = pick(row, [
      "email",
      "client_email",
      "e-mail",
      "user_email",
      "mail",
      "clientemail",
    ]).toLowerCase();
    
    if (!email) continue;
    
    try {
      const userId = await resolveUserId(email);
      if (!userId) continue;

      const total = toNumber(pick(row, ["total", "valor", "amount", "total_amount"]));
      const subtotal = toNumber(pick(row, ["subtotal"])) || total;
      const statusRaw = pick(row, ["status", "invoice_status"]).toLowerCase();
      const status = INVOICE_STATUS_MAP[statusRaw] ?? "unpaid";
      
      const dueDate = toDate(pick(row, ["duedate", "due_date", "vencimento", "date"])) ?? new Date().toISOString();
      const paidAt = toDate(pick(row, ["datepaid", "paid_at", "data_pagamento", "date_paid"]));
      const method = pick(row, ["paymentmethod", "payment_method", "metodo", "gateway"]);
      const externalId = pick(row, ["id", "invoiceid", "invoicenum", "number"]);

      const { error } = await supabaseAdmin.from("invoices").insert({
        user_id: userId,
        subtotal,
        total_amount: total,
        tax_amount: toNumber(pick(row, ["tax", "taxa", "taxamount"])),
        discount_amount: toNumber(pick(row, ["credit", "desconto", "discount", "discountamount"])),
        status: status as any,
        due_date: dueDate,
        paid_at: paidAt,
        payment_method: method || null,
        notes: `Importado do WHMCS (fatura #${externalId || "?"})`,
      });

      if (error) throw new Error(error.message);
      stats.invoices.created++;
    } catch (e) {
      stats.invoices.failed++;
      if (stats.errors.length < 50) {
        stats.errors.push(`Fatura ${email}: ${(e as Error).message}`);
      }
    }
  }
}

/** Cria um job de importação e retorna seu id. */
export async function startImportJob(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("whmcs_imports")
    .insert({ status: "running" })
    .select("id")
    .single();
  return data?.id ?? null;
}

/** Processa um lote de linhas já convertidas no navegador. */
export async function importBatch(
  kind: "clients" | "services" | "invoices",
  rows: Record<string, string>[],
): Promise<ImportStats> {
  const stats = emptyStats();
  if (kind === "clients") await importClients(rows, stats);
  else if (kind === "services") await importServices(rows, stats);
  else await importInvoices(rows, stats);
  return stats;
}

/** Finaliza o job registrando as estatísticas agregadas. */
export async function finishImportJob(
  jobId: string,
  stats: ImportStats,
  errorMessage?: string,
) {
  await supabaseAdmin
    .from("whmcs_imports")
    .update({
      status: errorMessage ? "failed" : "completed",
      error_message: errorMessage ?? null,
      stats: stats as never,
    })
    .eq("id", jobId);
}
