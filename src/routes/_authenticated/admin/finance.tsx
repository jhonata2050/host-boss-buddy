import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSystemSettings, updateSystemSettings } from "@/lib/support.functions";
import { Save, CreditCard, Wallet, Landmark, Zap, Gift, Coins } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance")({
  component: AdminFinanceSettingsPage,
});

function AdminFinanceSettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => getSystemSettings(),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (vars: Record<string, any>) => updateSystemSettings({ data: vars }),
    onSuccess: () => {
      toast.success("Configurações financeiras salvas!");
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, any> = {
      auto_suspend: formData.get("auto_suspend") === "on",
      auto_delete_days: Number(formData.get("auto_delete_days")) || 30,
      abacatepay_api_key: formData.get("abacatepay_api_key"),
      stripe_secret_key: formData.get("stripe_secret_key"),
      mercadopago_access_token: formData.get("mercadopago_access_token"),
      woovi_api_key: formData.get("woovi_api_key"),
      paghiper_api_key: formData.get("paghiper_api_key"),
      cajupay_api_key: formData.get("cajupay_api_key"),
    };
    updateSettingsMutation.mutate(data);
  };

  if (isLoading) return <div className="h-96 flex items-center justify-center">Carregando...</div>;

  return (
    <AppShell area="admin" breadcrumb={<span>Sistema / Financeiro e Gateways</span>}>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações Financeiras</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie seus gateways de pagamento e regras de faturamento automático.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <Card className="rounded-3xl border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Gift className="h-5 w-5 text-brand" />
                <CardTitle>Automação de Faturamento</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-muted">
                <div>
                  <p className="font-medium">Suspensão Automática</p>
                  <p className="text-xs text-muted-foreground">Suspender serviços com faturas vencidas há mais de 3 dias.</p>
                </div>
                <Switch name="auto_suspend" defaultChecked={settings?.["auto_suspend"] === true} />
              </div>
              <div className="space-y-2">
                <Label>Prazo para Deleção (dias)</Label>
                <Input name="auto_delete_days" type="number" defaultValue={settings?.["auto_delete_days"] || 30} className="rounded-xl" />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AbacatePay */}
            <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <Zap className="h-5 w-5 text-[#A3E635]" />
                <CardTitle className="text-lg">AbacatePay</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input name="abacatepay_api_key" type="password" placeholder="abacatepay_..." defaultValue={settings?.["abacatepay_api_key"]} className="rounded-xl" />
                </div>
              </CardContent>
            </Card>

            {/* Stripe */}
            <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <CreditCard className="h-5 w-5 text-[#6366f1]" />
                <CardTitle className="text-lg">Stripe</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Secret Key</Label>
                  <Input name="stripe_secret_key" type="password" placeholder="sk_..." defaultValue={settings?.["stripe_secret_key"]} className="rounded-xl" />
                </div>
              </CardContent>
            </Card>

            {/* Mercado Pago */}
            <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <Landmark className="h-5 w-5 text-[#009ee3]" />
                <CardTitle className="text-lg">Mercado Pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Access Token</Label>
                  <Input name="mercadopago_access_token" type="password" placeholder="APP_USR-..." defaultValue={settings?.["mercadopago_access_token"]} className="rounded-xl" />
                </div>
              </CardContent>
            </Card>

            {/* Woovi */}
            <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <Zap className="h-5 w-5 text-[#03d69d]" />
                <CardTitle className="text-lg">Woovi (OpenPix)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input name="woovi_api_key" type="password" defaultValue={settings?.["woovi_api_key"]} className="rounded-xl" />
                </div>
              </CardContent>
            </Card>

            {/* PagHiper */}
            <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <Coins className="h-5 w-5 text-[#f58220]" />
                <CardTitle className="text-lg">PagHiper</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>API Key / Token</Label>
                  <Input name="paghiper_api_key" type="password" defaultValue={settings?.["paghiper_api_key"]} className="rounded-xl" />
                </div>
              </CardContent>
            </Card>

            {/* CajuPay */}
            <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <Wallet className="h-5 w-5 text-[#e52e5e]" />
                <CardTitle className="text-lg">CajuPay</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input name="cajupay_api_key" type="password" defaultValue={settings?.["cajupay_api_key"]} className="rounded-xl" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" className="rounded-2xl px-8">Cancelar</Button>
            <Button type="submit" disabled={updateSettingsMutation.isPending} className="bg-brand text-brand-foreground hover:bg-brand/90 rounded-2xl px-12 font-bold shadow-lg shadow-brand/20">
              <Save className="mr-2 h-4 w-4" /> 
              {updateSettingsMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
