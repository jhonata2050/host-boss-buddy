import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Plus, Search, User } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/tickets")({
  head: () => ({
    meta: [{ title: "Tickets de Suporte — Admin HostPanel" }],
  }),
  component: AdminTicketsPage,
});

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "Aberto", color: "bg-success text-success-foreground" },
  answered: { label: "Respondido", color: "bg-brand text-brand-foreground" },
  customer_reply: { label: "Replica", color: "bg-warning text-warning-foreground" },
  closed: { label: "Fechado", color: "bg-muted text-muted-foreground" },
};

function AdminTicketsPage() {
  const [term, setTerm] = useState("");

  const tickets = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      // In a real app, we'd have a tickets table. 
      // Mocking data for now since we focus on UI/UX flow.
      return [
        { 
          id: "1", 
          subject: "Erro ao acessar DirectAdmin", 
          status: "open", 
          last_reply: new Date().toISOString(),
          user: { full_name: "João Silva", email: "joao@exemplo.com" }
        },
        { 
          id: "2", 
          subject: "Dúvida sobre upgrade de plano", 
          status: "answered", 
          last_reply: new Date().toISOString(),
          user: { full_name: "Maria Oliveira", email: "maria@exemplo.com" }
        }
      ];
    },
  });

  const filtered = (tickets.data ?? []).filter((t) =>
    t.subject.toLowerCase().includes(term.trim().toLowerCase()) ||
    t.user.full_name.toLowerCase().includes(term.trim().toLowerCase())
  );

  return (
    <AppShell
      breadcrumb={
        <>
          <span className="flex items-center gap-2">Suporte</span>
          <span>/</span>
          <span className="font-medium text-foreground">Tickets</span>
        </>
      }
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tickets de Suporte</h1>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Pesquisar por assunto ou cliente..."
            className="h-11 rounded-xl pl-9"
          />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-secondary/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Ticket</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Assunto</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Última Resp.</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.isLoading ? (
                [0, 1].map((i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 py-4"><Skeleton className="h-4 w-full" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum ticket encontrado</td>
                </tr>
              ) : (
                filtered.map((ticket) => {
                  const status = STATUS_LABELS[ticket.status] || { label: ticket.status, color: "bg-muted" };
                  return (
                    <tr key={ticket.id} className="hover:bg-sidebar-accent/50">
                      <td className="px-4 py-4 font-medium">#{ticket.id}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{ticket.user.full_name}</span>
                          <span className="text-xs text-muted-foreground">{ticket.user.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-foreground">{ticket.subject}</td>
                      <td className="px-4 py-4">
                        <Badge className={cn("rounded-full border-none px-3 font-medium", status.color)}>
                          {status.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {new Date(ticket.last_reply).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button className="text-brand hover:underline font-medium">Responder</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
