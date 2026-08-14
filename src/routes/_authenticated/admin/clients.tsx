import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Store, Users, ExternalLink } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/clients")({
  head: () => ({
    meta: [
      { title: "Clientes — HostPanel" },
      {
        name: "description",
        content: "Lista de clientes da hospedagem com contato, documento e situação da conta.",
      },
      { property: "og:title", content: "Clientes — HostPanel" },
      { property: "og:description", content: "Lista de clientes com contato, documento e situação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const [term, setTerm] = useState("");

  const clients = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, company_name, tax_id, phone, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100); // Reduced limit for faster initial load
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const needle = term.trim().toLowerCase();
  const filtered = (clients.data ?? []).filter((c) =>
    [c.full_name, c.email, c.company_name, c.tax_id]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)),
  );

  return (
    <AppShell
      area="admin"
      breadcrumb={
        <>
          <span className="flex items-center gap-2">
            <Store className="size-4" />
            Sua Loja
          </span>
          <span>/</span>
          <span className="flex items-center gap-2 font-medium text-foreground">
            <Users className="size-4" />
            Clientes
          </span>
        </>
      }
    >
      <h1 className="text-2xl font-semibold tracking-tight">Seus clientes</h1>

      <div className="relative mt-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Pesquisar por nome, e-mail ou documento"
          className="h-11 rounded-xl pl-9"
        />
      </div>

      {clients.isLoading ? (
        <Skeleton className="mt-6 h-56 rounded-2xl" />
      ) : filtered.length === 0 ? (
        <p className="py-24 text-center text-sm text-muted-foreground">Nenhum cliente encontrado</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    {client.full_name ?? "Sem nome"}
                    {client.company_name && (
                      <span className="block text-xs text-muted-foreground">{client.company_name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{client.tax_id ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{client.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={client.status === "active" ? "default" : "secondary"}>
                      {client.status === "active" ? "Ativo" : client.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <Link to="/admin/clients/$clientId" params={{ clientId: client.id }}>
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
