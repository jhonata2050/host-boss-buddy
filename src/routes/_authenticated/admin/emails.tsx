import { createFileRoute } from "@tanstack/react-router";
import { Cog, Mail } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/admin/emails")({
  head: () => ({
    meta: [
      { title: "E-mails e SMTP — HostPanel" },
      { name: "description", content: "Configure o SMTP externo e os modelos de e-mail transacional da plataforma." },
      { property: "og:title", content: "E-mails e SMTP — HostPanel" },
      { property: "og:description", content: "SMTP externo e modelos de e-mail transacional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminEmailsPage,
});

const TEMPLATES = [
  { name: "Boas-vindas", trigger: "Cadastro de cliente" },
  { name: "Fatura gerada", trigger: "Nova fatura criada" },
  { name: "Fatura paga", trigger: "Pagamento confirmado" },
  { name: "Aviso de vencimento", trigger: "3 dias antes do vencimento" },
  { name: "Serviço ativado", trigger: "Provisionamento no DirectAdmin" },
  { name: "Serviço suspenso", trigger: "Fatura em atraso" },
];

function AdminEmailsPage() {
  return (
    <AppShell
      area="admin"
      breadcrumb={
        <>
          <span className="flex items-center gap-2">
            <Cog className="size-4" />
            Sistema
          </span>
          <span>/</span>
          <span className="flex items-center gap-2 font-medium text-foreground">
            <Mail className="size-4" />
            E-mails
          </span>
        </>
      }
    >
      <h1 className="text-2xl font-semibold tracking-tight">E-mails e SMTP</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Modelos de e-mail transacional enviados automaticamente aos clientes.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((template) => (
          <div key={template.name} className="rounded-2xl border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground">{template.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">Disparo: {template.trigger}</p>
            <p className="mt-4 text-xs font-medium text-muted-foreground">Aguardando configuração de SMTP</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
