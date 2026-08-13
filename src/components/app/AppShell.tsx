import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  Code2,
  CreditCard,
  LayoutPanelLeft,
  LifeBuoy,
  LogOut,
  MoreVertical,
  Package,
  PanelsTopLeft,
  Plug,
  Receipt,
  Store,
  Ticket,
  User as UserIcon,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useAuth, useIsStaff, useProfile } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type NavLink = { label: string; to: string; icon?: any };
type NavSection = { label: string; icon: any; links: NavLink[] };

function useNav() {
  const { isStaff } = useIsStaff();

  const sections: NavSection[] = isStaff
    ? [
        {
          label: "Sua Loja",
          icon: Store,
          links: [
            { label: "Produtos", to: "/admin/products", icon: Package },
            { label: "Cupons", to: "/admin/coupons", icon: Ticket },
            { label: "Clientes", to: "/admin/clients", icon: Users },
            { label: "Faturas", to: "/admin/invoices", icon: Receipt },
          ],
        },
        {
          label: "Integração",
          icon: Plug,
          links: [
            { label: "Tickets", to: "/admin/tickets", icon: LifeBuoy },
          ]
        },
      ]
    : [
        {
          label: "Meus serviços",
          icon: LayoutPanelLeft,
          links: [
            { label: "Gerenciar", to: "/services", icon: LayoutPanelLeft },
          ],
        },
        {
          label: "Minha conta",
          icon: UserIcon,
          links: [
            { label: "Meus dados", to: "/profile", icon: UserIcon },
            { label: "Minhas faturas", to: "/invoices", icon: Receipt },
            { label: "Suporte", to: "/tickets", icon: LifeBuoy },
          ],
        },
      ];

  return { sections };
}

function SidebarSection({ section, pathname }: { section: NavSection; pathname: string }) {
  const hasActive = section.links.some((l) => pathname.startsWith(l.to));
  const [open, setOpen] = useState(hasActive);
  const Icon = section.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
      >
        <span className="flex items-center gap-3">
          <Icon className="size-4 text-muted-foreground" />
          {section.label}
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && section.links.length > 0 && (
        <div className="ml-3 mt-1 space-y-1 border-l border-sidebar-border pl-3">
          {section.links.map((link) => {
            const LinkIcon = link.icon ?? Package;
            const active = pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <LinkIcon className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppShell({
  breadcrumb,
  children,
  sandbox = true,
}: {
  breadcrumb: ReactNode;
  children: ReactNode;
  sandbox?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { sections } = useNav();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [devMode, setDevMode] = useState(true);

  const name = profile?.full_name ?? user?.email ?? "Conta";
  const initials = name.slice(0, 2).toUpperCase();

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      {sandbox && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-warning px-4 py-2.5 text-sm text-warning-foreground">
          <span className="font-medium">Modo Sandbox</span>
          <span className="hidden sm:block">Você está em um ambiente de teste</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-full border-warning-foreground/30 bg-transparent text-xs text-warning-foreground hover:bg-warning-foreground/10"
          >
            Ir para produção
          </Button>
        </div>
      )}

      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 lg:flex">
          <div className="flex items-center justify-between px-2 pb-4">
            <Link to="/" className="flex size-8 items-center justify-center rounded-full bg-brand">
              <span className="text-sm font-bold text-brand-foreground">H</span>
            </Link>
            <PanelsTopLeft className="size-4 text-muted-foreground" />
          </div>

          <div className="border-y border-sidebar-border py-3">
            <div className="rounded-xl px-2 py-1">
              <p className="text-sm font-semibold text-sidebar-foreground">
                {profile?.company_name ?? "Minha empresa"}
              </p>
              <p className="text-xs text-muted-foreground">{profile?.tax_id ?? "Sem CNPJ cadastrado"}</p>
            </div>
          </div>

          <nav className="mt-3 flex-1 space-y-1 overflow-y-auto">
            <Link
              to="/dashboard"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                pathname === "/dashboard"
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <LayoutPanelLeft className="size-4" />
              Painel
            </Link>
            {sections.map((section) => (
              <SidebarSection key={section.label} section={section} pathname={pathname} />
            ))}
          </nav>

          <div className="space-y-1 border-t border-sidebar-border pt-3">
            <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm">
              <span className="flex items-center gap-3 text-sidebar-foreground">
                <Code2 className="size-4 text-muted-foreground" />
                Modo de desenvolvedor
              </span>
              <Switch checked={devMode} onCheckedChange={setDevMode} aria-label="Modo de desenvolvedor" />
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LifeBuoy className="size-4 text-muted-foreground" />
              Suporte
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-accent text-xs text-accent-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-left">{name}</span>
                  <MoreVertical className="size-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <UserIcon className="mr-2 size-4" />
                    Meus dados
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 lg:px-6">
          <header className="flex items-center justify-between gap-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">{breadcrumb}</div>
            <Bell className="size-5 text-muted-foreground" />
          </header>
          <div className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)] lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
