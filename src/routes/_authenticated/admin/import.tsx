import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Database, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/import")({
  component: AdminWHMCSImportPage,
});

function AdminWHMCSImportPage() {
  const [isImporting, setIsImporting] = useState(false);

  const handleStartImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsImporting(true);
    
    // Simulação de início de importação
    // Em um cenário real, isso dispararia uma Server Function que conecta ao MySQL do WHMCS
    setTimeout(() => {
      setIsImporting(false);
      toast.info("Funcionalidade de importação em desenvolvimento. Requer conexão direta ao banco MySQL do WHMCS.");
    }, 2000);
  };

  return (
    <AppShell area="admin" breadcrumb={<span>Sistema / Importador WHMCS</span>}>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Importador WHMCS</h1>
          <p className="text-muted-foreground mt-2">Migre seus clientes, faturas e serviços de uma instalação WHMCS existente.</p>
        </div>

        <Card className="rounded-3xl border-none shadow-sm bg-warning/5 border border-warning/20">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <AlertCircle className="h-6 w-6 text-warning shrink-0" />
              <div className="text-sm space-y-2">
                <p className="font-bold text-warning-foreground">Aviso de Segurança</p>
                <p className="text-muted-foreground">
                  A importação requer que este servidor tenha acesso ao banco de dados MySQL do seu WHMCS. 
                  Certifique-se de liberar o IP do HostPanel no firewall do seu servidor WHMCS.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleStartImport} className="space-y-6">
          <Card className="rounded-3xl border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-brand" />
                <CardTitle>Conexão com Banco WHMCS</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Host do MySQL</Label>
                  <Input name="whmcs_db_host" placeholder="1.2.3.4" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Porta</Label>
                  <Input name="whmcs_db_port" defaultValue="3306" className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input name="whmcs_db_user" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input name="whmcs_db_pass" type="password" className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nome do Banco (WHMCS)</Label>
                <Input name="whmcs_db_name" defaultValue="whmcs_db" className="rounded-xl" />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="submit" disabled={isImporting} className="bg-brand text-brand-foreground hover:bg-brand/90 rounded-2xl px-12 font-bold shadow-lg shadow-brand/20">
              <RefreshCw className={cn("mr-2 h-4 w-4", isImporting && "animate-spin")} /> 
              {isImporting ? "Processando..." : "Iniciar Importação"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
