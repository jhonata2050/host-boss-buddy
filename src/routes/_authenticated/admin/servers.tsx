import { createFileRoute } from "@tanstack/react-router";
import { Cog, Server } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/admin/servers")({
  head: () => ({
    meta: [
      { title: "Servidores DirectAdmin — HostPanel" },
      { name: "description", content: "Cadastre e monitore os servidores DirectAdmin usados no provisionamento." },
      { property: "og:title", content: "Servidores DirectAdmin — HostPanel" },
      { property: "og:description", content: "Servidores usados no provisionamento automático." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminServersPage,
});

function AdminServersPage() {
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
            <Server className="size-4" />
            Servidores
          </span>
        </>
      }
    >
      <h1 className="text-2xl font-semibold tracking-tight">Servidores DirectAdmin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Área exclusiva da administração para cadastrar hostname, usuário e chave de API dos servidores.
      </p>
      <div className="mt-6 rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        Nenhum servidor cadastrado. A integração com a API do DirectAdmin será conectada nesta tela.
      </div>
    </AppShell>
  );
}
