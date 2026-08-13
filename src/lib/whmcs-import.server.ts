import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ImportStats = {
  clients: { created: number; updated: number; failed: number };
  services: { created: number; failed: number };
  invoices: { created: number; failed: number };
  errors: string[];
};

/** Parser de CSV simples otimizado para não concatenar strings excessivamente. */
export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentField: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];

    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          currentField.push('"');
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField.push(char);
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === "," || char === ";") {
        currentLine.push(currentField.join(""));
        currentField = [];
      } else if (char === "\n") {
        currentLine.push(currentField.join(""));
        currentField = [];
        lines.push(currentLine);
        currentLine = [];
      } else {
        currentField.push(char);
      }
    }
  }

  if (currentField.length > 0 || currentLine.length > 0) {
    currentLine.push(currentField.join(""));
    lines.push(currentLine);
  }

  const nonEmpty = lines.filter((l) => l.some((v) => v.trim() !== ""));
  if (nonEmpty.length === 0) return [];

  const headers = nonEmpty[0]!.map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (row[idx] ?? "").trim();
    });
    return obj;
  });
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
    // WHMCS tables usually have 'email' but we search for synonyms
    const email = pick(row, ["email", "e-mail", "email_address", "mail"]).toLowerCase();
    if (!email) {
      // In a "full DB" dump, some rows might not be clients. Skip silently if no email.
      continue;
    }
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
  const { data: existing } = await supabaseAdmin
    .from("products")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const slug =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `whmcs-${Date.now()}`;

  const { data: created, error } = await supabaseAdmin
    .from("products")
    .insert({
      name,
      slug,
      description: "Produto importado do WHMCS",
      is_visible: false,
      auto_provision: false,
    })
    .select("id")
    .single();
  if (error) return null;
  return created.id;
}

/** Importa serviços/hospedagens do WHMCS (tblhosting export). */
async function importServices(rows: Record<string, string>[], stats: ImportStats) {
  for (const row of rows) {
    const email = pick(row, ["email", "client_email", "e-mail", "user_email", "mail"]).toLowerCase();
    if (!email) continue; // Skip rows that aren't services
    try {
      const userId = await resolveUserId(email);
      if (!userId) continue; // Skip if client not yet imported

      const productName = pick(row, ["product", "produto", "packagename", "product_name"]);
      const productId = await resolveProductId(productName || "Plano Importado");
      if (!productId) throw new Error("não foi possível resolver o produto");

      const cycle =
        CYCLE_MAP[pick(row, ["billingcycle", "billing_cycle", "ciclo"]).toLowerCase()] ??
        "monthly";
      const status =
        SERVICE_STATUS_MAP[pick(row, ["status", "domainstatus"]).toLowerCase()] ?? "active";

      const { error } = await supabaseAdmin.from("services").insert({
        user_id: userId,
        product_id: productId,
        domain: pick(row, ["domain", "dominio"]) || null,
        username: pick(row, ["username", "usuario"]) || null,
        billing_cycle: cycle as never,
        status: status as never,
        next_due_date: toDate(pick(row, ["nextduedate", "next_due_date", "vencimento"])),
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
    const email = pick(row, ["email", "client_email", "e-mail", "user_email", "mail"]).toLowerCase();
    if (!email) continue; // Skip rows without email
    try {
      const userId = await resolveUserId(email);
      if (!userId) continue; // Skip if client not found

      const total = toNumber(pick(row, ["total", "valor", "amount"]));
      const subtotal = toNumber(pick(row, ["subtotal"])) || total;
      const status =
        INVOICE_STATUS_MAP[pick(row, ["status"]).toLowerCase()] ?? "unpaid";
      const dueDate =
        toDate(pick(row, ["duedate", "due_date", "vencimento"])) ?? new Date().toISOString();

      const { error } = await supabaseAdmin.from("invoices").insert({
        user_id: userId,
        subtotal,
        total_amount: total,
        tax_amount: toNumber(pick(row, ["tax", "taxa"])),
        discount_amount: toNumber(pick(row, ["credit", "desconto", "discount"])),
        status: status as never,
        due_date: dueDate,
        paid_at: toDate(pick(row, ["datepaid", "paid_at", "data_pagamento"])),
        payment_method: pick(row, ["paymentmethod", "payment_method"]) || null,
        notes: `Importado do WHMCS (fatura #${pick(row, ["id", "invoiceid", "invoicenum"]) || "?"})`,
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

export async function runWhmcsImport(input: {
  clientsCsv?: string | undefined;
  servicesCsv?: string | undefined;
  invoicesCsv?: string | undefined;
}) {
  const stats: ImportStats = {
    clients: { created: 0, updated: 0, failed: 0 },
    services: { created: 0, failed: 0 },
    invoices: { created: 0, failed: 0 },
    errors: [],
  };

  const { data: job } = await supabaseAdmin
    .from("whmcs_imports")
    .insert({ status: "running" })
    .select("id")
    .single();

  try {
    if (input.clientsCsv && input.clientsCsv.trim()) {
      const rows = parseCsv(input.clientsCsv as string);
      input.clientsCsv = ""; // Use empty string to release large memory without violating types
      await importClients(rows, stats);
    }
    if (input.servicesCsv && input.servicesCsv.trim()) {
      const rows = parseCsv(input.servicesCsv as string);
      input.servicesCsv = "";
      await importServices(rows, stats);
    }
    if (input.invoicesCsv && input.invoicesCsv.trim()) {
      const rows = parseCsv(input.invoicesCsv as string);
      input.invoicesCsv = "";
      await importInvoices(rows, stats);
    }

    if (job) {
      await supabaseAdmin
        .from("whmcs_imports")
        .update({ status: "completed", stats: stats as never })
        .eq("id", job.id);
    }
    return stats;
  } catch (e) {
    if (job) {
      await supabaseAdmin
        .from("whmcs_imports")
        .update({
          status: "failed",
          error_message: (e as Error).message,
          stats: stats as never,
        })
        .eq("id", job.id);
    }
    throw e;
  }
}
