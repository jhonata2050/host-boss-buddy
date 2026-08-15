import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History, Mail, Shield, Activity, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getSystemLogs } from "@/lib/logs.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  component: LogsPage,
});

function LogsPage() {
  const [activeTab, setActiveTab] = useState<"email" | "auth" | "system" | "all">("email");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-logs", activeTab, page],
    queryFn: () => getSystemLogs({ data: { type: activeTab, offset: (page - 1) * pageSize, limit: pageSize } }),
  });

  const logs = data?.logs || [];
  const totalItems = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return (
    <AppShell
      area="admin"
      breadcrumb={
        <>
          <span>Admin</span>
          <span>/</span>
          <span className="font-medium text-foreground">Logs do Sistema</span>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs do Sistema</h1>
          <p className="text-sm text-muted-foreground">
            Monitore atividades de e-mail, autenticação e eventos do sistema.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setPage(1); }} className="w-full">
          <TabsList className="bg-muted/50 p-1 rounded-2xl h-12">
            <TabsTrigger value="email" className="rounded-xl flex gap-2">
              <Mail className="size-4" /> E-mails
            </TabsTrigger>
            <TabsTrigger value="auth" className="rounded-xl flex gap-2">
              <Shield className="size-4" /> Autenticação
            </TabsTrigger>
            <TabsTrigger value="system" className="rounded-xl flex gap-2">
              <Activity className="size-4" /> Sistema
            </TabsTrigger>
          </TabsList>

          <div className="mt-6 border border-border rounded-2xl overflow-hidden bg-card">
            {isLoading ? (
              <div className="p-8">
                <Skeleton className="h-40 w-full rounded-xl" />
              </div>
            ) : activeTab === "email" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length > 0 ? (
                    logs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{log.profile?.full_name || "N/A"}</span>
                            <span className="text-xs text-muted-foreground">{log.to_email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {log.subject}
                        </TableCell>
                        <TableCell className="text-xs italic text-muted-foreground">
                          {log.template_name || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status === "sent" ? "default" : "secondary"} className="bg-brand/10 text-brand border-brand/20 hover:bg-brand/20">
                            {log.status === "sent" ? "Enviado" : log.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        Nenhum log de e-mail encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="size-8 opacity-20" />
                        <p>Nenhum log de {activeTab === "auth" ? "autenticação" : "sistema"} encontrado.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </div>

          {activeTab === "email" && !isLoading && logs.length > 0 && (
            <div className="mt-6 flex items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {logs.length} de {totalItems} logs
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4 mr-2" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Próximo <ChevronRight className="size-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </Tabs>
      </div>
    </AppShell>
  );
}
