"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Store,
  ShoppingCart,
  Package,
  FolderOpen,
  FileText,
  BarChart3,
  Settings,
  Receipt,
  LogOut,
  User,
  HelpCircle,
  ClipboardList,
} from "lucide-react";
import type { User as UserType } from "@/lib/auth";

interface DashboardNavProps {
  user: UserType;
}

const navItems = [
  {
    href: "/dashboard",
    label: "Inicio",
    icon: Store,
    tooltip: "Panel principal con resumen de ventas del día",
  },
  {
    href: "/dashboard/pos",
    label: "Punto de Venta",
    icon: ShoppingCart,
    tooltip: "Crear nuevas ventas y facturas",
  },
  {
    href: "/dashboard/invoices",
    label: "Facturas",
    icon: FileText,
    tooltip: "Ver historial de facturas emitidas",
  },
  {
    href: "/dashboard/products",
    label: "Productos",
    icon: Package,
    tooltip: "Gestionar inventario de productos",
    adminOnly: true,
  },
  {
    href: "/dashboard/categories",
    label: "Categorías",
    icon: FolderOpen,
    tooltip: "Administrar categorías y tasas de impuesto",
    adminOnly: true,
  },
  {
    href: "/dashboard/purchases",
    label: "Compras",
    icon: ClipboardList,
    tooltip: "Registrar compras a proveedores y entrada de inventario",
    adminOnly: true,
  },
  {
    href: "/dashboard/reports",
    label: "Reportes",
    icon: BarChart3,
    tooltip: "Reportes de ventas y cierres de caja",
    adminOnly: true,
  },
  {
    href: "/dashboard/cai",
    label: "CAI",
    icon: Receipt,
    tooltip: "Configurar CAI y datos fiscales",
    adminOnly: true,
  },
  {
    href: "/dashboard/settings",
    label: "Configuración",
    icon: Settings,
    tooltip: "Ajustes del sistema y usuarios",
    adminOnly: true,
  },
];

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const filteredNavItems = navItems.filter(
    (item) => !item.adminOnly || user.role === "admin"
  );

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="w-64 border-r bg-sidebar flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Store className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold truncate">Sistema POS</h1>
              <p className="text-xs text-muted-foreground truncate">Bodega</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    <HelpCircle className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[200px]">
                  {item.tooltip}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div className="p-2 border-t space-y-1">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Cerrar Sesión
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Salir del sistema de forma segura
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
