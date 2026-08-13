import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CreditCard, QrCode, Wallet } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsStaff, useProfile } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — HostPanel" },
      {
        name: "description",
        content: "Visão geral de vendas, faturas e serviços de hospedagem da sua conta.",
      },
      { property: "og:title", content: "Painel — HostPanel" },
      { property: "og:description", content: "Visão geral de vendas, faturas e serviços de hospedagem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const PERIODS = ["Hoje", "Esse mês", "Últimos 30 dias", "Últimos 90 dias", "Todo o período", "Personalizado"];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function DashboardPage() {
  const [period, setPeriod] = useState("Hoje");
  const { isStaff } = useIsStaff();
  const { data: profile } = useProfile();

  const stats = useQuery({
    queryKey: ["dashboard-stats", isStaff],
    queryFn: async () => {
      const [clients, products, invoices, transactions] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("total_amount").eq("status", "pending"),
        supabase.from("transactions").select("amount"),
      ]);

      const salesTotal = transactions.data?.reduce((acc, curr) => acc + curr.amount, 0) ?? 0;
      const pendingTotal = invoices.data?.reduce((acc, curr) => acc + curr.total_amount, 0) ?? 0;

      return {
        clients: clients.count ?? 0,
        products: products.count ?? 0,
        salesTotal,
        transactionCount: transactions.data?.length ?? 0,
        pendingTotal,
      };
    },
  });

  return (
    <AppShell
      breadcrumb={
        <span className="flex items-center gap-2 text-base font-medium text-foreground">
          <BarChart3 className="size-4" />
          Painel
        </span>
      }
    >
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={period === item ? "default" : "outline"}
            className={cn(
              "rounded-xl",
              period === item && "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            onClick={() => setPeriod(item)}
          >
            {item}
          </Button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <KpiCard label="Total em vendas" value={brl.format(0)} />
        <KpiCard label="Total de transações" value="0" />
        <KpiCard label="Faturas em aberto" value={brl.format(0)} />
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
          <MethodRow icon={QrCode} label="Boleto" value={brl.format(0)} />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm font-medium">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-brand" />
            Total
          </span>
          <span>{brl.format(0)}</span>
        </div>
      </div>

      {isStaff ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <KpiCard
            label="Clientes cadastrados"
            value={stats.isLoading ? undefined : String(stats.data?.clients ?? 0)}
          />
          <KpiCard
            label="Planos no catálogo"
            value={stats.isLoading ? undefined : String(stats.data?.products ?? 0)}
          />
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-border p-6">
          <h2 className="text-sm font-medium">Seus serviços</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {profile?.full_name ? `${profile.full_name}, você` : "Você"} ainda não tem serviços de hospedagem
            contratados. Quando um plano for ativado, ele aparecerá aqui com uso de disco, banda e vencimento.
          </p>
        </div>
      )}
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
