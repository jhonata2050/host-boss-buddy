import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  CreditCard, 
  Server, 
  LifeBuoy, 
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Send,
  Save
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getClientDossier } from "@/lib/client-dossier.functions";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/clients_/$clientId")({
  head: ({ params }) => ({
    meta: [
      { title: `Detalhes do Cliente — HostPanel` },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(clientDossierQueryOptions(params.clientId)),
  component: ClientDetailPage,
});

const clientDossierQueryOptions = (clientId: string) =>
  queryOptions({
    queryKey: ["admin-client-dossier", clientId],
    queryFn: async () => {
      return getClientDossier({ data: { clientId } });
    },
    staleTime: 1000 * 60 * 2,
  });

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: client } = useSuspenseQuery(clientDossierQueryOptions(clientId));
  const dossier = {
    invoices: client.invoices,
    services: client.services,
    tickets: client.tickets,
    emailLogs: client.email_logs,
  };
  const dossiersQuery = { isLoading: false, data: dossier };

  const updateProfile = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase
        .from("profiles")
        .update(values)
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-client-dossier", clientId] });
      setIsEditing(false);
      toast.success("Perfil atualizado com sucesso");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const values = Object.fromEntries(formData.entries());
    
    // Garantir que não estamos tentando atualizar o email se ele for o mesmo ou estiver bloqueado
    // Em alguns provedores, o email é o identificador único.
    const { email, ...updateValues } = values;
    updateProfile.mutate(updateValues);
  };

  return (
    <AppShell
      area="admin"
      breadcrumb={
        <>
          <span>Admin</span>
          <span>/</span>
          <Link to="/admin/clients" className="hover:underline">Clientes</Link>
          <span>/</span>
          <span className="font-medium text-foreground">{client.full_name || client.email}</span>
        </>
      }
    >
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.full_name || "Sem Nome"}</h1>
            <p className="text-muted-foreground">{client.email}</p>
          </div>
          <Badge className="h-8 px-4 text-sm" variant={client.status === "active" ? "default" : "secondary"}>
            {client.status === "active" ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-12 p-1 bg-muted/50 rounded-2xl">
            <TabsTrigger value="info" className="rounded-xl flex gap-2"><User className="size-4" /> Dados</TabsTrigger>
            <TabsTrigger value="services" className="rounded-xl flex gap-2"><Server className="size-4" /> Serviços</TabsTrigger>
            <TabsTrigger value="finance" className="rounded-xl flex gap-2"><CreditCard className="size-4" /> Financeiro</TabsTrigger>
            <TabsTrigger value="emails" className="rounded-xl flex gap-2"><Mail className="size-4" /> E-mails</TabsTrigger>
            <TabsTrigger value="tickets" className="rounded-xl flex gap-2"><LifeBuoy className="size-4" /> Tickets</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-6">
            <Card className="rounded-3xl border-none bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Informações do Cliente</CardTitle>
                  <CardDescription>Dados pessoais e de contato</CardDescription>
                </div>
                {!isEditing && (
                  <Button variant="outline" onClick={() => setIsEditing(true)} className="rounded-xl">
                    Editar Dados
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nome Completo</Label>
                    <Input id="full_name" name="full_name" defaultValue={client.full_name || ""} disabled={!isEditing} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" name="email" defaultValue={client.email || ""} disabled={true} className="rounded-xl h-11 bg-muted/30" />
                    <p className="text-[10px] text-muted-foreground">O e-mail é gerenciado via autenticação e não pode ser alterado aqui.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Empresa</Label>
                    <Input id="company_name" name="company_name" defaultValue={client.company_name || ""} disabled={!isEditing} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_id">CPF/CNPJ</Label>
                    <Input id="tax_id" name="tax_id" defaultValue={client.tax_id || ""} disabled={!isEditing} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" name="phone" defaultValue={client.phone || ""} disabled={!isEditing} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select 
                      id="status" 
                      name="status" 
                      defaultValue={client.status} 
                      disabled={!isEditing}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </div>
                  
                  <div className="col-span-full border-t pt-4">
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <MapPin className="size-4" /> Endereço
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address_line">Logradouro</Label>
                    <Input id="address_line" name="address_line" defaultValue={client.address_line || ""} disabled={!isEditing} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input id="city" name="city" defaultValue={client.city || ""} disabled={!isEditing} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input id="state" name="state" defaultValue={client.state || ""} disabled={!isEditing} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">CEP</Label>
                    <Input id="postal_code" name="postal_code" defaultValue={client.postal_code || ""} disabled={!isEditing} className="rounded-xl h-11" />
                  </div>

                  {isEditing && (
                    <div className="col-span-full flex justify-end gap-3 mt-4">
                      <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl h-11">
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={updateProfile.isPending} className="rounded-xl h-11 bg-brand text-brand-foreground hover:bg-brand/90 flex gap-2">
                        <Save className="size-4" /> Salvar Alterações
                      </Button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="mt-6">
            <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader>
                <CardTitle>Serviços Contratados</CardTitle>
                <CardDescription>Hospedagem, domínios e outros</CardDescription>
              </CardHeader>
              <CardContent>
                {dossiersQuery.isLoading ? <Skeleton className="h-40" /> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Domínio</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Provisionado</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dossiersQuery.data?.services.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.products?.name || "Produto"}</TableCell>
                          <TableCell className="text-muted-foreground">{s.domain || "—"}</TableCell>
                          <TableCell>
                            {s.next_due_date ? format(new Date(s.next_due_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                          </TableCell>
                          <TableCell>
                            {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={s.status === 'active' ? 'default' : s.status === 'suspended' ? 'secondary' : 'destructive'}>
                              {s.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {dossiersQuery.data?.services.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Nenhum serviço encontrado</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="finance" className="mt-6">
            <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader>
                <CardTitle>Histórico Financeiro</CardTitle>
                <CardDescription>Faturas pagas e pendentes</CardDescription>
              </CardHeader>
              <CardContent>
                {dossiersQuery.isLoading ? <Skeleton className="h-40" /> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fatura</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Pago em</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dossiersQuery.data?.invoices.map((inv: any) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">#{inv.id.slice(0, 8)}</TableCell>
                          <TableCell>R$ {inv.total_amount.toFixed(2)}</TableCell>
                          <TableCell>
                            {format(new Date(inv.due_date), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {inv.paid_at ? format(new Date(inv.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'}>
                              {inv.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {dossiersQuery.data?.invoices.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Nenhuma fatura encontrada</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emails" className="mt-6">
            <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader>
                <CardTitle>Histórico de Comunicação</CardTitle>
                <CardDescription>E-mails enviados pelo sistema</CardDescription>
              </CardHeader>
              <CardContent>
                {dossiersQuery.isLoading ? <Skeleton className="h-40" /> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Assunto</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dossiersQuery.data?.emailLogs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs">
                            {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-medium">{log.subject}</TableCell>
                          <TableCell className="text-muted-foreground">{log.template_name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {log.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {dossiersQuery.data?.emailLogs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Nenhum log de e-mail encontrado</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tickets" className="mt-6">
             <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader>
                <CardTitle>Suporte</CardTitle>
                <CardDescription>Tickets abertos e resolvidos</CardDescription>
              </CardHeader>
              <CardContent>
                {dossiersQuery.isLoading ? <Skeleton className="h-40" /> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Assunto</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dossiersQuery.data?.tickets.map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.subject}</TableCell>
                          <TableCell>
                            {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{t.priority}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={t.status === 'open' ? 'default' : 'secondary'}>
                              {t.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {dossiersQuery.data?.tickets.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Nenhum ticket encontrado</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
