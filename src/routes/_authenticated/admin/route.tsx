import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsStaff, useRoles } from "@/hooks/use-auth";


export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { data: roles, error } = useRoles();
  const { isStaff, isLoading: loading } = useIsStaff();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen space-y-4 p-6">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    );
  }


  if (!isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div className="max-w-sm">
          <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">Área restrita</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Você está logado como: {roles?.join(", ") || "cliente"}
            <br />
            Esta área é exclusiva da administração da plataforma.
          </p>
          <Button onClick={() => navigate({ to: "/dashboard" })} className="mt-4 rounded-xl">
            Voltar para o Painel
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
