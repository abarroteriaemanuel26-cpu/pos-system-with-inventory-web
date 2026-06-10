"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import {
  BarChart3,
  Calendar,
  Loader2,
  DollarSign,
  CreditCard,
  Banknote,
  Building2,
  FileText,
  Ban,
  Printer,
  HelpCircle,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  TrendingUp,
  Percent,
  Package,
} from "lucide-react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al obtener datos");
  }
  return res.json();
};

type DailyReport = {
  date: string;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalTax: number;
  totalExempt: number;
  totalInvoices: number;
  totalVoided: number;
};

type DailyClosing = {
  id: number;
  closingDate: string;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalInvoices: number;
  totalVoided: number;
  notes: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cashRegisterId: number | null;
  cashierName: string | null;
  createdAt: string;
};

export default function ReportsPage() {
  const today = new Date().getFullYear() + '-' +
    String(new Date().getMonth() + 1).padStart(2, '0') + '-' +
    String(new Date().getDate()).padStart(2, '0');
  const [selectedDate, setSelectedDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [useRange, setUseRange] = useState(false);
  const [previewClosing, setPreviewClosing] = useState<DailyClosing | null>(null);
  const [productStartDate, setProductStartDate] = useState(today);
  const [productEndDate, setProductEndDate] = useState(today);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const reportUrl = useRange
    ? `/api/reports?startDate=${startDate}&endDate=${endDate}`
    : `/api/reports?date=${selectedDate}`;

  const { data: report, isLoading: reportLoading } = useSWR<DailyReport>(
    reportUrl,
    fetcher
  );

  const { data: closings, isLoading: closingsLoading } = useSWR<DailyClosing[]>(
    "/api/reports/closings",
    fetcher
  );

  const { data: productReport, isLoading: productLoading } = useSWR(
    `/api/reports/products?startDate=${productStartDate}&endDate=${productEndDate}`,
    fetcher
  );

  const handleDeleteClosing = async () => {
    if (!previewClosing || deleteReason.trim().length < 5) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/reports/closings/${previewClosing.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason }),
      });
      if (response.ok) {
        mutate("/api/reports/closings");
        setDeleteDialog(false);
        setDeleteReason("");
        setPreviewClosing(null);
      } else {
        const error = await response.json();
        alert(error.error || "Error al cancelar cierre");
      }
    } finally {
      setDeleting(false);
    }
  };

  const activeClosings = closings?.filter((c) => !c.cancelledAt) || [];
  const cancelledClosings = closings?.filter((c) => c.cancelledAt) || [];

  const isClosingDone = closings?.some((c) => c.closingDate === (useRange ? today : selectedDate) && !c.cancelledAt);

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Reportes
            </h1>
            <p className="text-muted-foreground">
              Consulta las ventas del día y realiza cierres de caja
            </p>
          </div>
          {isClosingDone && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 gap-1 text-sm px-3 py-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Caja cerrada
            </Badge>
          )}
        </div>

        <Tabs defaultValue="daily" className="space-y-6">
          <TabsList>
            <TabsTrigger value="daily">Reporte Diario</TabsTrigger>
            <TabsTrigger value="products">Rentabilidad por Producto</TabsTrigger>
            <TabsTrigger value="closings">Historial de Cierres</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-6">
            {/* Date Selector */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{useRange ? "Rango de Fechas" : "Seleccionar Fecha"}</CardTitle>
                    <CardDescription>
                      {useRange
                        ? "Consulta las ventas en un rango de fechas"
                        : "Consulta las ventas de una fecha específica"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUseRange(!useRange)}
                    >
                      {useRange ? "Ver por Día" : "Ver por Rango"}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2">
                  {useRange ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          max={endDate}
                          className="w-auto"
                        />
                        <span className="text-muted-foreground">a</span>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          max={today}
                          className="w-auto"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        max={today}
                        className="w-auto"
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Report Stats */}
            {reportLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : report ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium">
                        Ventas Totales
                      </CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(report.totalSales)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {report.totalInvoices} facturas emitidas
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium">
                        Efectivo
                      </CardTitle>
                      <Banknote className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(report.totalCash)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Pagos en efectivo
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium">
                        Tarjeta
                      </CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(report.totalCard)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Pagos con tarjeta
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium">
                        Transferencias
                      </CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(report.totalTransfer)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Transferencias bancarias
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium">
                        ISV Recaudado
                      </CardTitle>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Impuesto Sobre Ventas recaudado
                        </TooltipContent>
                      </Tooltip>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(report.totalTax)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium">
                        Facturas Emitidas
                      </CardTitle>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {report.totalInvoices}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium">
                        Facturas Anuladas
                      </CardTitle>
                      <Ban className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">
                        {report.totalVoided}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Rentabilidad por Producto
                    </CardTitle>
                    <CardDescription>
                      Ganancia y margen por producto en un rango de fechas
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={productStartDate}
                      onChange={(e) => setProductStartDate(e.target.value)}
                      max={productEndDate}
                      className="w-auto"
                    />
                    <span className="text-muted-foreground">a</span>
                    <Input
                      type="date"
                      value={productEndDate}
                      onChange={(e) => setProductEndDate(e.target.value)}
                      max={today}
                      className="w-auto"
                    />
                  </div>
                </div>
              </CardHeader>
            </Card>

            {productLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : productReport ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium">
                        Ingresos Totales
                      </CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(productReport.totalRevenue)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium">
                        Ganancia Total
                      </CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(productReport.totalProfit)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {productReport.totalRevenue > 0
                          ? `Margen: ${((productReport.totalProfit / productReport.totalRevenue) * 100).toFixed(1)}%`
                          : "Sin ventas en el período"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {productReport.products?.length > 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right">Precio Compra</TableHead>
                            <TableHead className="text-right">Precio Venta</TableHead>
                            <TableHead className="text-right">Cant. Vendida</TableHead>
                            <TableHead className="text-right">Ganancia Total</TableHead>
                            <TableHead className="text-right">Margen %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productReport.products.map((p: any) => (
                            <TableRow key={p.productId}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                  {p.productName}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(p.purchasePrice)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(p.avgSalePrice)}
                              </TableCell>
                              <TableCell className="text-right">
                                {p.qtySold}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                <span className={p.profit >= 0 ? "text-green-600" : "text-destructive"}>
                                  {formatCurrency(p.profit)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={p.margin >= 0 ? "text-green-600" : "text-destructive"}>
                                  {p.margin.toFixed(1)}%
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay ventas en el período seleccionado</p>
                  </div>
                )}
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="closings" className="space-y-6">
            <Card>
              <CardHeader>
                  <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Historial de Cierres de Caja</CardTitle>
                    <CardDescription>
                      Últimos 50 cierres de caja registrados
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {closingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !closings || closings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay cierres de caja registrados</p>
                  </div>
                ) : (
                  <>
                    {activeClosings.length > 0 && (
                      <>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">
                          Cierres Activos ({activeClosings.length})
                        </h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Caja</TableHead>
                              <TableHead>Cajero</TableHead>
                              <TableHead className="text-right">Ventas</TableHead>
                              <TableHead className="text-right">Efectivo</TableHead>
                              <TableHead className="text-right">Tarjeta</TableHead>
                              <TableHead className="text-right">Transfer.</TableHead>
                              <TableHead className="text-center">Facturas</TableHead>
                              <TableHead className="text-center">Anuladas</TableHead>
                              <TableHead>Notas</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeClosings.map((closing) => (
                              <TableRow
                                key={closing.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => setPreviewClosing(closing)}
                              >
                                <TableCell className="font-medium">
                                  {formatDate(closing.closingDate)}
                                </TableCell>
                                <TableCell>
                                  {closing.cashRegisterId ? `Caja #${closing.cashRegisterId}` : "-"}
                                </TableCell>
                                <TableCell>
                                  {closing.cashierName || "-"}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(closing.totalSales)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(closing.totalCash)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(closing.totalCard)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(closing.totalTransfer)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {closing.totalInvoices}
                                </TableCell>
                                <TableCell className="text-center">
                                  {closing.totalVoided > 0 && (
                                    <span className="text-destructive">{closing.totalVoided}</span>
                                  )}
                                  {closing.totalVoided === 0 && "-"}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm truncate max-w-[150px]">
                                  {closing.notes || "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </>
                    )}
                    {cancelledClosings.length > 0 && (
                      <>
                        <h3 className="text-sm font-medium text-destructive mt-6 mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Cierres Eliminados ({cancelledClosings.length})
                        </h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Caja</TableHead>
                              <TableHead>Cajero</TableHead>
                              <TableHead className="text-right">Ventas</TableHead>
                              <TableHead className="text-right">Efectivo</TableHead>
                              <TableHead className="text-right">Tarjeta</TableHead>
                              <TableHead className="text-right">Transfer.</TableHead>
                              <TableHead className="text-center">Facturas</TableHead>
                              <TableHead>Motivo Cancelación</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cancelledClosings.map((closing) => (
                              <TableRow
                                key={closing.id}
                                className="cursor-pointer hover:bg-muted/50 opacity-70"
                                onClick={() => setPreviewClosing(closing)}
                              >
                                <TableCell className="font-medium">
                                  {formatDate(closing.closingDate)}
                                </TableCell>
                                <TableCell>
                                  {closing.cashRegisterId ? `Caja #${closing.cashRegisterId}` : "-"}
                                </TableCell>
                                <TableCell>
                                  {closing.cashierName || "-"}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(closing.totalSales)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(closing.totalCash)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(closing.totalCard)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(closing.totalTransfer)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {closing.totalInvoices}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                                  {closing.cancellationReason || "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Closing Preview Dialog */}
        <Dialog open={!!previewClosing} onOpenChange={(open) => { if (!open) setPreviewClosing(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {previewClosing?.cancelledAt ? (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
                Cierre de {previewClosing ? formatDate(previewClosing.closingDate) : ""}
              </DialogTitle>
            </DialogHeader>
            {previewClosing && (
              <div className="space-y-4">
                {previewClosing.cancelledAt && (
                  <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/10">
                    <p className="text-sm font-medium text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Cierre Cancelado
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Motivo: {previewClosing.cancellationReason}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {previewClosing.cancelledAt ? formatDateTime(previewClosing.cancelledAt) : ""}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Ventas</p>
                    <p className="text-xl font-bold">{formatCurrency(previewClosing.totalSales)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Facturas</p>
                    <p className="text-xl font-bold">{previewClosing.totalInvoices}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Efectivo</p>
                    <p className="font-medium">{formatCurrency(previewClosing.totalCash)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tarjeta</p>
                    <p className="font-medium">{formatCurrency(previewClosing.totalCard)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Transferencias</p>
                    <p className="font-medium">{formatCurrency(previewClosing.totalTransfer)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Anuladas</p>
                    <p className="font-medium text-destructive">{previewClosing.totalVoided}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div>
                    <p>Caja</p>
                    <p className="font-medium text-foreground">
                      {previewClosing.cashRegisterId ? `Caja #${previewClosing.cashRegisterId}` : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p>Cajero</p>
                    <p className="font-medium text-foreground">
                      {previewClosing.cashierName || "N/A"}
                    </p>
                  </div>
                </div>
                {previewClosing.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notas</p>
                    <p className="text-sm">{previewClosing.notes}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2">
              {previewClosing && !previewClosing.cancelledAt && (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar Cierre
                </Button>
              )}
              <Button variant="outline" onClick={() => setPreviewClosing(null)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Closing Dialog */}
        <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Cancelar Cierre de Caja
              </DialogTitle>
              <DialogDescription>
                Esta acción no se puede deshacer. El cierre quedará registrado como cancelado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium">
                  Cierre del {previewClosing ? formatDate(previewClosing.closingDate) : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Total: {previewClosing ? formatCurrency(previewClosing.totalSales) : ""}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deleteReason" className="flex items-center gap-1">
                  Motivo de cancelación <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="deleteReason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Indique el motivo de la cancelación..."
                  rows={3}
                />
                {deleteReason.length > 0 && deleteReason.length < 5 && (
                  <p className="text-xs text-destructive">Mínimo 5 caracteres</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDeleteDialog(false); setDeleteReason(""); }}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteClosing}
                disabled={deleting || deleteReason.trim().length < 5}
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Cancelación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
