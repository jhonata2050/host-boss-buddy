import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getServers, createServerDA, testDAConnection, getDAPackagesList } from "@/lib/support.functions";

import { Plus, Server, Globe, Shield, Activity, Trash2, RefreshCw, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/servers")({
  component: AdminServersPage,
});

function AdminServersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncResults, setSyncResults] = useState<Record<string, { packages: string[]; syncedAt: string }>>({});
  const queryClient = useQueryClient();

  const { data: servers, isLoading } = useQuery({
    queryKey: ["admin-servers"],
    queryFn: () => getServers(),
  });

  const createServerMutation = useMutation({
    mutationFn: (newServer: any) => createServerDA({ data: newServer }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-servers"] });
      toast.success("Servidor adicionado com sucesso!");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao adicionar servidor: " + err.message);
    },
  });

  const testMutation = useMutation({
    mutationFn: (serverId: string) => testDAConnection({ data: serverId }),
    onSuccess: (result) => {
      setSyncResults((current) => ({
        ...current,
        [testMutation.variables ?? ""]: { packages: result.packages, syncedAt: new Date().toISOString() },
      }));
      toast.success(`Conexão validada: ${result.packageCount} pacotes encontrados.`);
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const syncMutation = useMutation({
    mutationFn: (serverId: string) => getDAPackagesList({ data: serverId }),
    onSuccess: (packages, serverId) => {
      setSyncResults((current) => ({
        ...current,
        [serverId]: { packages, syncedAt: new Date().toISOString() },
      }));
      queryClient.setQueryData(["da-packages", serverId], packages);
      toast.success(`${packages.length} pacotes sincronizados com sucesso.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });


  const handleAddServer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      hostname: formData.get("hostname") as string,
      ip_address: formData.get("ip_address") as string,
      api_user: formData.get("api_user") as string,
      api_token: formData.get("api_token") as string,
      max_accounts: Number(formData.get("max_accounts")) || 100,
    };
    createServerMutation.mutate(data);
  };

  return (
    <AppShell area="admin" breadcrumb={<span>Sistema / Servidores</span>}>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Servidores DirectAdmin</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie a infraestrutura de hospedagem e provisionamento automático.
            </p>
          </div>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-brand text-brand-foreground hover:bg-brand/90 rounded-2xl px-6">
                <Plus className="mr-2 h-4 w-4" /> Novo Servidor
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl border-none shadow-2xl max-w-md">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Adicionar Servidor</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddServer} className="space-y-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome Amigável</Label>
                  <Input id="name" name="name" placeholder="Ex: BR-SERVER-01" required className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hostname">Hostname/IP da API</Label>
                  <Input id="hostname" name="hostname" placeholder="https://da.provedor.com:2222" required className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="api_user">Usuário API</Label>
                  <Input id="api_user" name="api_user" placeholder="admin" required className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="api_token">Chave de API / Senha</Label>
                  <Input id="api_token" name="api_token" type="password" required className="rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="ip_address">IP Público</Label>
                    <Input id="ip_address" name="ip_address" placeholder="1.2.3.4" className="rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="max_accounts">Limite de Contas</Label>
                    <Input id="max_accounts" name="max_accounts" type="number" defaultValue="100" className="rounded-xl" />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createServerMutation.isPending} className="bg-brand text-brand-foreground w-full rounded-2xl">
                    {createServerMutation.isPending ? "Salvando..." : "Salvar Servidor"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-3xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : servers && servers.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => (
              <Card key={server.id} className="rounded-3xl border-none shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                <CardHeader className="bg-brand/5 border-b border-brand/10 p-6">
                  <div className="flex items-center justify-between">
                    <div className="h-10 w-10 rounded-2xl bg-brand/20 flex items-center justify-center">
                      <Server className="h-5 w-5 text-brand" />
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-brand px-2 py-1 rounded-full bg-brand/10">
                      <Activity className="h-3 w-3" /> Configurado
                    </div>
                  </div>
                  <CardTitle className="mt-4 text-xl font-bold">{server.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <Globe className="h-3 w-3" /> {server.hostname}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Shield className="h-4 w-4" /> IP: {server.ip_address || "N/A"}
                    </span>
                    <span className="font-medium">0 / {server.max_accounts} contas</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-brand h-2 rounded-full w-[2%]" />
                  </div>
                  {syncResults[server.id] && (
                    <div className="rounded-2xl border border-brand/20 bg-brand/5 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-brand" />
                        {syncResults[server.id].packages.length} pacotes sincronizados
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground break-words">
                        {syncResults[server.id].packages.join(", ")}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      className="rounded-2xl border-brand/20 text-brand hover:bg-brand/5"
                      onClick={() => testMutation.mutate(server.id)}
                      disabled={testMutation.isPending && testMutation.variables === server.id}
                    >
                      {testMutation.isPending && testMutation.variables === server.id ? "Testando..." : "Testar Conexão"}
                    </Button>
                    <Button
                      className="rounded-2xl bg-brand text-brand-foreground hover:bg-brand/90"
                      onClick={() => syncMutation.mutate(server.id)}
                      disabled={syncMutation.isPending && syncMutation.variables === server.id}
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending && syncMutation.variables === server.id ? "animate-spin" : ""}`} />
                      {syncMutation.isPending && syncMutation.variables === server.id ? "Sincronizando..." : "Sincronizar pacotes"}
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl text-destructive hover:bg-destructive/5"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/30 rounded-3xl border-2 border-dashed border-muted">
            <Server className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground font-medium">Nenhum servidor configurado ainda.</p>
            <Button variant="link" className="text-brand font-bold mt-2" onClick={() => setIsModalOpen(true)}>Adicionar o primeiro servidor</Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
