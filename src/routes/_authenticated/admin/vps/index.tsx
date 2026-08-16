import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVPSAdminData, updateVPSInstance } from '@/lib/vps-admin.functions';
import { AppShell } from '@/components/app/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useState } from 'react';
import { Monitor, Save, User } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/admin/vps/')({
  component: AdminVPSPage,
});

function AdminVPSPage() {
  const { data: instances } = useSuspenseQuery({
    queryKey: ['admin-vps-instances'],
    queryFn: () => getVPSAdminData(),
  });

  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  const updateMutation = useMutation({
    mutationFn: (vars: any) => updateVPSInstance({ data: vars }),
    onSuccess: () => {
      toast.success('VPS atualizada com sucesso!');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-vps-instances'] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  const handleEdit = (vps: any) => {
    setEditingId(vps.id);
    setEditValues({
      id: vps.id,
      external_id: vps.external_id,
      ip_address: vps.ip_address,
      status: vps.status
    });
  };

  return (
    <AppShell breadcrumb="Admin VPS">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de VPS</h1>
            <p className="text-muted-foreground">Monitore e gerencie todas as instâncias VPS dos clientes.</p>
          </div>
        </div>

        <Card className="rounded-3xl border-2">
          <CardHeader>
            <CardTitle>Instâncias Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances?.map((vps: any) => (
                  <TableRow key={vps.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{vps.service?.profile?.full_name}</span>
                        <span className="text-xs text-muted-foreground">{vps.service?.profile?.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingId === vps.id ? (
                        <Input 
                          value={editValues.external_id} 
                          onChange={e => setEditValues({...editValues, external_id: e.target.value})}
                          className="h-8 w-32 rounded-lg"
                        />
                      ) : (
                        <code className="text-xs bg-muted px-1 rounded">{vps.external_id}</code>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === vps.id ? (
                        <Input 
                          value={editValues.ip_address} 
                          onChange={e => setEditValues({...editValues, ip_address: e.target.value})}
                          className="h-8 w-32 rounded-lg"
                        />
                      ) : (
                        vps.ip_address || 'Pendente'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={vps.status === 'active' ? 'outline' : 'secondary'} className={vps.status === 'active' ? 'border-lime-500 text-lime-600' : ''}>
                        {vps.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === vps.id ? (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-lime-600"
                          onClick={() => updateMutation.mutate(editValues)}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(vps)}>
                          Editar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
