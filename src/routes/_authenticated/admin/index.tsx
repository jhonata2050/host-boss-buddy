import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CreditCard,
  Gauge,
  Package,
  QrCode,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Painel administrativo — HostPanel" },
      {
        name: "description",
        content: "Visão master da plataforma: vendas, faturas, clientes e serviços de hospedagem.",
      },
      { property: "og:title", content: "Painel administrativo — HostPanel" },
      { property: "og:description", content: "Visão master da plataforma de hospedagem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminDashboardPage,
});

const PERIODS = ["Hoje", "Esse mês", "Últimos 30 dias", "Últimos 90 dias", "Todo o período"];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function AdminDashboardPage() {
  const [period, setPeriod] = useState("Hoje");

  const stats = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      // Use indexed queries and head: true for counts where possible
      const [clients, products, invoices, transactions, services] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("total_amount").eq("status", "pending"),
        supabase.from("transactions").select("amount"),
        supabase.from("services").select("id", { count: "exact", head: true }),
      ]);

      return {
        clients: clients.count ?? 0,
        products: products.count ?? 0,
        services: services.count ?? 0,
        salesTotal: transactions.data?.reduce((acc, t) => acc + Number(t.amount), 0) ?? 0,
        transactionCount: transactions.data?.length ?? 0,
        pendingTotal: invoices.data?.reduce((acc, i) => acc + Number(i.total_amount), 0) ?? 0,
      };
    },
    staleTime: 1000 * 60 * 10, // Dashboard stats can be more stale
  });

  return (
    <AppShell
      area="admin"
      breadcrumb={
        <span className="flex items-center gap-2 text-base font-medium text-foreground">
          <Gauge className="size-4" />
          Painel administrativo
        </span>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral da plataforma</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dados consolidados de todas as contas de clientes.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {PERIODS.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={period === item ? "default" : "outline"}
            className={cn("rounded-xl", period === item && "bg-primary text-primary-foreground hover:bg-primary/90")}
            onClick={() => setPeriod(item)}
          >
            {item}
          </Button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <KpiCard label="Total em vendas" value={stats.isLoading ? undefined : brl.format(stats.data?.salesTotal ?? 0)} />
        <KpiCard label="Transações" value={stats.isLoading ? undefined : String(stats.data?.transactionCount ?? 0)} />
        <KpiCard label="Faturas em aberto" value={stats.isLoading ? undefined : brl.format(stats.data?.pendingTotal ?? 0)} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <KpiCard label="Clientes cadastrados" value={stats.isLoading ? undefined : String(stats.data?.clients ?? 0)} />
        <KpiCard label="Serviços provisionados" value={stats.isLoading ? undefined : String(stats.data?.services ?? 0)} />
        <KpiCard label="Planos no catálogo" value={stats.isLoading ? undefined : String(stats.data?.products ?? 0)} />
      </div>

      <div className="mt-6 rounded-2xl border border-border p-4 lg:p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Wallet className="size-4 text-muted-foreground" />
          Métodos de pagamento
        </h2>
        <div className="mt-4 h-3 w-full rounded-full bg-muted" />
        <div className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
          <MethodRow icon={CreditCard} label="Cartão de crédito" value={brl.format(0)} />
          <MethodRow icon={QrCode} label="Pix" value={brl.format(0)} />
          <MethodRow icon={Receipt} label="Boleto" value={brl.format(0)} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <ShortcutCard to="/admin/clients" icon={Users} title="Clientes" description="Gerencie todas as contas" />
        <ShortcutCard to="/admin/invoices" icon={Receipt} title="Faturas" description="Cobranças de toda a base" />
        <ShortcutCard to="/admin/products" icon={Package} title="Catálogo" description="Planos e preços" />
      </div>
    </AppShell>
  );
}

function KpiCard({ label, value }: { label: string; value?: string | undefined }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      {value === undefined ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      )}
    </div>
  );
}

function MethodRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CreditCard;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-foreground">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

function ShortcutCard({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-2xl border border-border p-5 transition-colors hover:border-brand/50"
    >
      <span className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon className="size-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="block text-xs text-muted-foreground">{description}</span>
        </span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
