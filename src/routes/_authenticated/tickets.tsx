import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LifeBuoy, MessageSquare, Plus, Search } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tickets")({
  head: () => ({
    meta: [{ title: "Meus Tickets — HostPanel" }],
  }),
  component: ClientTicketsPage,
});

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "Aberto", color: "bg-success text-success-foreground" },
  answered: { label: "Respondido", color: "bg-brand text-brand-foreground" },
  customer_reply: { label: "Aguardando", color: "bg-warning text-warning-foreground" },
  closed: { label: "Fechado", color: "bg-muted text-muted-foreground" },
};

function ClientTicketsPage() {
  const [term, setTerm] = useState("");

  const tickets = useQuery({
    queryKey: ["client-tickets"],
    queryFn: async () => {
      // Mocking client tickets
      return [
        { 
          id: "1", 
          subject: "Erro ao acessar DirectAdmin", 
          status: "open", 
          last_reply: new Date().toISOString(),
          department: "Suporte Técnico"
        }
      ];
    },
  });

  const filtered = (tickets.data ?? []).filter((t) =>
    t.subject.toLowerCase().includes(term.trim().toLowerCase())
  );

  return (
    <AppShell
      area="client"
      breadcrumb={
        <>
          <span className="flex items-center gap-2">Suporte</span>
          <span>/</span>
          <span className="font-medium text-foreground">Meus Tickets</span>
        </>
      }
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Meus Tickets</h1>
        <Button className="rounded-xl gap-2">
          <Plus className="size-4" />
          Novo Ticket
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Pesquisar por assunto..."
            className="h-11 rounded-xl pl-9"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {tickets.isLoading ? (
          [0].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
            Você não possui tickets abertos
          </div>
        ) : (
          filtered.map((ticket) => {
            const status = STATUS_LABELS[ticket.status] || { label: ticket.status, color: "bg-muted" };
            return (
              <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-4">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <MessageSquare className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{ticket.subject}</h3>
                    <p className="text-xs text-muted-foreground">{ticket.department} • Última resposta: {new Date(ticket.last_reply).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <Badge className={cn("rounded-full border-none px-3 text-[10px] font-bold uppercase", status.color)}>
                    {status.label}
                  </Badge>
                  <Button variant="outline" size="sm" className="rounded-xl">Ver Ticket</Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
