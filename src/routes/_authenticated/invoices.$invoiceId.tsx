import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  Check, 
  CreditCard, 
  Download, 
  FileText, 
  Info, 
  QrCode, 
  Receipt, 
  Store 
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getInvoiceDetails } from "@/lib/finance.functions";
import { initializePayment } from "@/lib/payments.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  head: ({ params }) => ({
    meta: [
      { title: `Fatura #${params.invoiceId.slice(0, 8)} — HostPanel` },
    ],
  }),
  component: InvoiceDetailsPage,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-warning text-warning-foreground" },
  paid: { label: "Paga", color: "bg-success text-success-foreground" },
  cancelled: { label: "Cancelada", color: "bg-muted text-muted-foreground" },
  refunded: { label: "Estornada", color: "bg-destructive text-destructive-foreground" },
  overdue: { label: "Atrasada", color: "bg-destructive text-destructive-foreground" },
};

function InvoiceDetailsPage() {
  const { invoiceId } = Route.useParams();
  const fetchInvoice = useServerFn(getInvoiceDetails);
  const startPayment = useServerFn(initializePayment);
  
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card" | "boleto">("pix");
  const [pixResult, setPixResult] = useState<any>(null);

  const invoice = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => fetchInvoice({ data: { id: invoiceId } }),
  });

  const paymentMutation = useMutation({
    mutationFn: (method: "pix" | "credit_card" | "boleto") => 
      startPayment({ data: { invoiceId, method } }),
    onSuccess: (data) => {
      if (data.method === "pix") {
        setPixResult(data);
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error: any) => {
      toast.error("Erro ao processar pagamento: " + error.message);
    }
  });

  if (invoice.isLoading) return <AppShell breadcrumb={<span>Carregando fatura...</span>}><Skeleton className="h-96 rounded-3xl" /></AppShell>;
  if (!invoice.data) return <AppShell breadcrumb={<span>Fatura não encontrada</span>}>Fatura não encontrada</AppShell>;

  const inv = invoice.data;
  const status = STATUS_LABELS[inv.status] || { label: inv.status, color: "bg-muted" };

  return (
    <AppShell
      breadcrumb={
        <>
          <Link to="/invoices" className="flex items-center gap-2 hover:text-foreground">
            <Receipt className="size-4" />
            Minhas faturas
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">#{inv.id.slice(0, 8)}</span>
        </>
      }
    >
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">Fatura #{inv.id.slice(0, 8)}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Emitida em {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Badge className={cn("rounded-full border-none px-4 py-1 text-xs font-bold uppercase", status.color)}>
                {status.label}
              </Badge>
            </div>

            <div className="mt-8 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/30 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inv.invoice_items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 font-medium">{item.description}</td>
                      <td className="px-4 py-4 text-right font-semibold">{brl.format(Number(item.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-col items-end gap-2 text-sm">
              <div className="flex w-full max-w-[200px] justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{brl.format(Number(inv.subtotal))}</span>
              </div>
              {Number(inv.discount_amount) > 0 && (
                <div className="flex w-full max-w-[200px] justify-between text-success">
                  <span>Desconto</span>
                  <span className="font-medium">-{brl.format(Number(inv.discount_amount))}</span>
                </div>
              )}
              <div className="mt-2 flex w-full max-w-[200px] justify-between border-t border-border pt-2 text-lg font-bold">
                <span>Total</span>
                <span className="text-brand">{brl.format(Number(inv.total_amount))}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-sidebar p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Info className="size-5 text-brand" />
              Observações
            </h2>
            <p className="mt-2 text-sm text-muted-foreground italic">
              {inv.notes || "Nenhuma observação disponível para esta fatura."}
            </p>
          </div>
        </div>

        <div className="w-full shrink-0 lg:w-80">
          <div className="sticky top-6 space-y-6">
            {inv.status !== 'paid' ? (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Pagar Fatura</h2>
                
                {pixResult ? (
                  <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="mx-auto flex aspect-square w-full max-w-[200px] items-center justify-center rounded-xl bg-white p-2 border border-border">
                      <img src={pixResult.qrCodeUrl} alt="PIX QR Code" className="w-full" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-center text-xs text-muted-foreground">
                        Escaneie o código acima ou copie a chave PIX abaixo:
                      </p>
                      <div className="rounded-lg bg-secondary/50 p-2 font-mono text-[10px] break-all border border-border">
                        {pixResult.pixCode}
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full rounded-xl"
                        onClick={() => {
                          navigator.clipboard.writeText(pixResult.pixCode);
                          toast.success("Código PIX copiado!");
                        }}
                      >
                        Copiar Chave PIX
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full text-xs text-muted-foreground"
                        onClick={() => setPixResult(null)}
                      >
                        Alterar forma de pagamento
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    <button
                      onClick={() => setPaymentMethod("pix")}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all",
                        paymentMethod === "pix" ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-border hover:border-brand/50"
                      )}
                    >
                      <QrCode className="size-5 text-brand" />
                      <div>
                        <p className="font-semibold text-sm">Pix</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Aprovação imediata</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setPaymentMethod("credit_card")}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all opacity-60 cursor-not-allowed",
                        paymentMethod === "credit_card" ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-border"
                      )}
                      disabled
                    >
                      <CreditCard className="size-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-sm">Cartão de Crédito</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Em breve</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setPaymentMethod("boleto")}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all opacity-60 cursor-not-allowed",
                        paymentMethod === "boleto" ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-border"
                      )}
                      disabled
                    >
                      <FileText className="size-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-sm">Boleto Bancário</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Em breve</p>
                      </div>
                    </button>

                    <Button 
                      className="mt-4 w-full h-12 rounded-xl text-lg font-semibold"
                      onClick={() => paymentMutation.mutate(paymentMethod)}
                      disabled={paymentMutation.isPending}
                    >
                      {paymentMutation.isPending ? "Processando..." : "Pagar agora"}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-success/5 p-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/20 text-success">
                  <Check className="size-6" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-success">Fatura Paga</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Esta fatura foi liquidada em {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("pt-BR") : "data desconhecida"}.
                </p>
                <Button variant="outline" className="mt-6 w-full rounded-xl gap-2">
                  <Download className="size-4" />
                  Baixar Recibo
                </Button>
              </div>
            )}
            
            <Link to="/invoices">
              <Button variant="ghost" className="w-full rounded-xl gap-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" />
                Voltar para faturas
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
