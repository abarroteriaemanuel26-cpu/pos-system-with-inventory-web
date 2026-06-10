import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { invoices } from "@/lib/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { formatCurrency, getLocalDateString } from "@/lib/utils/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, FileText, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Get today's date range (local time)
  const todayStr = getLocalDateString();
  const [y, m, d] = todayStr.split("-").map(Number);
  const nextDate = new Date(y, m - 1, d + 1);
  const nextDay = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
  const extendedEnd = nextDay + " 05:59:59";

  // Get today's sales stats
  let todayStats = {
    totalSales: 0,
    totalInvoices: 0,
    avgTicket: 0,
  };

  try {
    if (isDatabaseConfigured()) {
      const db = getDb();
      const todayInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "activa"),
          gte(invoices.createdAt, todayStr),
          lte(invoices.createdAt, extendedEnd)
        )
      );

    const totalSales = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
      todayStats = {
        totalSales,
        totalInvoices: todayInvoices.length,
        avgTicket: todayInvoices.length > 0 ? totalSales / todayInvoices.length : 0,
      };
    }
  } catch {
    // Database not set up yet - this is fine for initial load
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bienvenido, {session.name}</h1>
        <p className="text-muted-foreground">Resumen de ventas del día</p>
        <p className="text-sm mt-1">
          <span className="text-muted-foreground">Fecha de negocio: </span>
          <span className="font-medium">{todayStr}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(todayStats.totalSales)}</div>
            <p className="text-xs text-muted-foreground">Total de ventas del día</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Facturas Emitidas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayStats.totalInvoices}</div>
            <p className="text-xs text-muted-foreground">Facturas del día</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(todayStats.avgTicket)}</div>
            <p className="text-xs text-muted-foreground">Promedio por venta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Activo</div>
            <p className="text-xs text-muted-foreground">Sistema funcionando</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>Accede rápidamente a las funciones principales</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <a
            href="/dashboard/pos"
            className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <ShoppingCart className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Nueva Venta</p>
              <p className="text-sm text-muted-foreground">Ir al punto de venta</p>
            </div>
          </a>
          <a
            href="/dashboard/products"
            className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Productos</p>
              <p className="text-sm text-muted-foreground">Gestionar inventario</p>
            </div>
          </a>
          <a
            href="/dashboard/invoices"
            className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Facturas</p>
              <p className="text-sm text-muted-foreground">Ver historial</p>
            </div>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
