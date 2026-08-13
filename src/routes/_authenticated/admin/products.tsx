import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, Plus, Search, Store } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/products")({
  head: () => ({
    meta: [
      { title: "Produtos e planos — HostPanel" },
      {
        name: "description",
        content: "Gerencie os planos de hospedagem, pacotes do DirectAdmin e preços por ciclo de cobrança.",
      },
      { property: "og:title", content: "Produtos e planos — HostPanel" },
      { property: "og:description", content: "Gerencie planos de hospedagem, pacotes e preços." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsPage,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const CYCLE_LABELS: Record<string, string> = {
  monthly: "mês",
  quarterly: "trimestre",
  semiannually: "semestre",
  annually: "ano",
  biennially: "2 anos",
};

function ProductsPage() {
  const [term, setTerm] = useState("");

  const products = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, slug, description, directadmin_package, disk_quota_mb, is_visible, sort_order, product_groups(name), product_prices(cycle, price)",
        )
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const filtered = (products.data ?? []).filter((p) =>
    p.name.toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <AppShell
      breadcrumb={
        <>
          <span className="flex items-center gap-2">
            <Store className="size-4" />
            Sua Loja
          </span>
          <span>/</span>
          <span className="flex items-center gap-2 font-medium text-foreground">
            <Package className="size-4" />
            Produtos
          </span>
        </>
      }
    >
      <h1 className="text-2xl font-semibold tracking-tight">Seus produtos</h1>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Pesquisar"
            className="h-11 rounded-xl pl-9"
          />
        </div>
        <Button className="h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-1 size-4" />
          Novo
        </Button>
      </div>

      {products.isLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-24 text-center text-sm text-muted-foreground">Nenhum produto encontrado</p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => {
            const monthly = product.product_prices?.find((p) => p.cycle === "monthly");
            return (
              <article key={product.id} className="rounded-2xl border border-border p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{product.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {product.product_groups?.name ?? "Sem grupo"}
                    </p>
                  </div>
                  <Badge variant={product.is_visible ? "default" : "secondary"}>
                    {product.is_visible ? "Visível" : "Oculto"}
                  </Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                <dl className="mt-4 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <dt>Pacote DirectAdmin</dt>
                    <dd className="text-foreground">{product.directadmin_package ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Disco</dt>
                    <dd className="text-foreground">
                      {product.disk_quota_mb ? `${Math.round(product.disk_quota_mb / 1024)} GB` : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Ciclos configurados</dt>
                    <dd className="text-foreground">{product.product_prices?.length ?? 0}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-lg font-semibold">
                  {monthly ? brl.format(Number(monthly.price)) : "Sem preço"}
                  <span className="text-sm font-normal text-muted-foreground">
                    {monthly ? ` /${CYCLE_LABELS[monthly.cycle]}` : ""}
                  </span>
                </p>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        Precisa ver a loja pública? <Link to="/" className="text-brand underline">Abrir catálogo</Link>
      </p>
    </AppShell>
  );
}
