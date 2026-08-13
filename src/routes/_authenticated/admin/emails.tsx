import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSystemSettings, updateSystemSettings } from "@/lib/support.functions";
import { Save, Mail, Globe, CreditCard } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/emails")({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => getSystemSettings(),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (vars: Record<string, any>) => updateSystemSettings({ data: vars }),
    onSuccess: () => {
      toast.success("Configurações salvas!");
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, any> = {
      company_name: formData.get("company_name"),
      support_email: formData.get("support_email"),
      resend_api_key: formData.get("resend_api_key"),
      abacatepay_api_key: formData.get("abacatepay_api_key"),
      auto_suspend: formData.get("auto_suspend") === "on",
    };
    updateSettingsMutation.mutate(data);
  };

  if (isLoading) return <div className="h-96 flex items-center justify-center">Carregando...</div>;

  return (
    <AppShell area="admin" breadcrumb={<span>Sistema / E-mails e SMTP</span>}>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações do Sistema</h1>
          <p className="text-muted-foreground mt-2">
            Personalize a identidade da sua plataforma e configure gateways de comunicação.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <Card className="rounded-3xl border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-brand" />
                <CardTitle>Identidade da Marca</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da Empresa</Label>
                  <Input name="company_name" defaultValue={settings?.["company_name"]} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Cor Principal (OKLCH ou Hex)</Label>
                  <div className="flex gap-2">
                    <Input defaultValue="#A3E635" className="rounded-xl" />
                    <div className="h-10 w-10 rounded-xl bg-brand shrink-0 border" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-brand" />
                <CardTitle>E-mail e SMTP</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-muted">
                <div>
                  <p className="font-medium">Usar Resend para transacionais</p>
                  <p className="text-xs text-muted-foreground">Recomendado para melhor entrega.</p>
                </div>
                <Switch name="use_resend" defaultChecked />
              </div>
              <div className="space-y-2">
                <Label>API Key (Resend)</Label>
                <Input name="resend_api_key" type="password" placeholder="re_..." defaultValue={settings?.["resend_api_key"]} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>E-mail de Remetente Padrão</Label>
                <Input name="support_email" placeholder="no-reply@seu-dominio.com" defaultValue={settings?.["support_email"]} className="rounded-xl" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-brand" />
                <CardTitle>Configurações de Faturamento</CardTitle>
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
                <Label>Moeda Padrão</Label>
                <Input defaultValue="BRL" className="rounded-xl" disabled />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" className="rounded-2xl px-8">Cancelar</Button>
            <Button type="submit" disabled={updateSettingsMutation.isPending} className="bg-brand text-brand-foreground hover:bg-brand/90 rounded-2xl px-12 font-bold shadow-lg shadow-brand/20">
              <Save className="mr-2 h-4 w-4" /> 
              {updateSettingsMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
