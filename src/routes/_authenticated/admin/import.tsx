import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RefreshCw, AlertCircle, Users, Server, Receipt, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { importWhmcsCsv, listWhmcsImports } from "@/lib/whmcs.functions";

export const Route = createFileRoute("/_authenticated/admin/import")({
  component: AdminWHMCSImportPage,
  head: () => ({
    meta: [
      { title: "Importador WHMCS | HostPanel" },
      {
        name: "description",
        content: "Migre clientes, serviços e faturas do WHMCS para o HostPanel via arquivos CSV.",
      },
      { property: "og:title", content: "Importador WHMCS | HostPanel" },
      {
        property: "og:description",
        content: "Migração de clientes, serviços e faturas do WHMCS para o HostPanel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Slot = "clientsCsv" | "servicesCsv" | "invoicesCsv";

const SLOTS: { key: Slot; title: string; icon: typeof Users; hint: string }[] = [
  {
    key: "clientsCsv",
    title: "Clientes (tblclients)",
    icon: Users,
    hint: "Colunas aceitas: email, firstname, lastname, companyname, phonenumber, address1, city, state, postcode, country",
  },
  {
    key: "servicesCsv",
    title: "Serviços (tblhosting)",
    icon: Server,
    hint: "Colunas aceitas: email, product, domain, username, billingcycle, status, nextduedate",
  },
  {
    key: "invoicesCsv",
    title: "Faturas (tblinvoices)",
    icon: Receipt,
    hint: "Colunas aceitas: email, subtotal, total, tax, status, duedate, datepaid, paymentmethod",
  },
];

function AdminWHMCSImportPage() {
  const [files, setFiles] = useState<Partial<Record<Slot, { name: string; content: string }>>>({});
  const runImport = useServerFn(importWhmcsCsv);
  const fetchImports = useServerFn(listWhmcsImports);
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: ["whmcs-imports"],
    queryFn: () => fetchImports(),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {};
      for (const slot of SLOTS) {
        const file = files[slot.key];
        if (file) payload[slot.key] = file.content;
      }
      return runImport({ data: payload });
    },
    onSuccess: (stats) => {
      toast.success(
        `Importação concluída: ${stats.clients.created} clientes criados, ${stats.services.created} serviços, ${stats.invoices.created} faturas.`,
      );
      if (stats.errors.length > 0) {
        toast.warning(`${stats.errors.length} registro(s) com erro. Veja o histórico.`);
      }
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFile = async (slot: Slot, file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    setFiles((prev) => ({ ...prev, [slot]: { name: file.name, content } }));
  };

  const hasFiles = Object.keys(files).length > 0;

  return (
    <AppShell area="admin" breadcrumb={<span>Sistema / Importador WHMCS</span>}>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Importador WHMCS</h1>
          <p className="text-muted-foreground mt-2">
            Migre clientes, serviços e faturas exportando as tabelas do seu WHMCS em CSV.
          </p>
        </div>

        <Card className="rounded-3xl border border-warning/20 bg-warning/5 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <AlertCircle className="h-6 w-6 text-warning shrink-0" />
              <div className="text-sm space-y-2">
                <p className="font-bold text-warning-foreground">Como exportar do WHMCS</p>
                <p className="text-muted-foreground">
                  No WHMCS acesse <strong>Utilities → SQL Console</strong> (ou phpMyAdmin) e exporte
                  as tabelas <code>tblclients</code>, <code>tblhosting</code> e{" "}
                  <code>tblinvoices</code> em CSV. Importe os clientes primeiro — serviços e faturas
                  são vinculados pelo e-mail do cliente. Os clientes importados recebem uma senha
                  aleatória e devem usar "esqueci minha senha" no primeiro acesso.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {SLOTS.map((slot) => {
            const Icon = slot.icon;
            const file = files[slot.key];
            return (
              <Card key={slot.key} className="rounded-3xl border-none shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-brand" />
                    <CardTitle className="text-base">{slot.title}</CardTitle>
                    {file && <CheckCircle2 className="h-4 w-4 text-brand" />}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Label className="text-xs text-muted-foreground">{slot.hint}</Label>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => void handleFile(slot.key, e.target.files?.[0])}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-xl file:border-0 file:bg-brand/10 file:px-4 file:py-2 file:text-sm file:font-bold file:text-brand"
                  />
                  {file && (
                    <p className="text-xs text-muted-foreground">Arquivo carregado: {file.name}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => mutation.mutate()}
            disabled={!hasFiles || mutation.isPending}
            className="bg-brand text-brand-foreground hover:bg-brand/90 rounded-2xl px-12 font-bold shadow-lg shadow-brand/20"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", mutation.isPending && "animate-spin")} />
            {mutation.isPending ? "Importando..." : "Iniciar Importação"}
          </Button>
        </div>

        <Card className="rounded-3xl border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Histórico de importações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(history.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma importação executada ainda.</p>
            )}
            {(history.data ?? []).map((job) => {
              const stats = job.stats as {
                clients?: { created: number; updated: number; failed: number };
                services?: { created: number; failed: number };
                invoices?: { created: number; failed: number };
                errors?: string[];
              } | null;
              return (
                <div key={job.id} className="rounded-2xl bg-muted/40 p-4 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold capitalize">{job.status}</span>
                    <span className="text-xs text-muted-foreground">
                      {job.created_at ? new Date(job.created_at).toLocaleString("pt-BR") : ""}
                    </span>
                  </div>
                  {stats && (
                    <p className="text-muted-foreground">
                      Clientes: {stats.clients?.created ?? 0} novos / {stats.clients?.updated ?? 0}{" "}
                      atualizados · Serviços: {stats.services?.created ?? 0} · Faturas:{" "}
                      {stats.invoices?.created ?? 0}
                    </p>
                  )}
                  {job.error_message && <p className="text-destructive">{job.error_message}</p>}
                  {stats?.errors && stats.errors.length > 0 && (
                    <ul className="list-disc pl-5 text-xs text-muted-foreground">
                      {stats.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
