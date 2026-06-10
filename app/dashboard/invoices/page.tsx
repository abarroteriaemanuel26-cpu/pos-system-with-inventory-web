"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import {
  Search,
  FileText,
  Loader2,
  Printer,
  Ban,
  Eye,
  HelpCircle,
  Calendar,
} from "lucide-react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al obtener datos");
  }
  return res.json();
};

type Invoice = {
  id: number;
  invoiceNumber: string;
  receiptNumber: string | null;
  type: string;
  customerName: string;
  customerRtn: string | null;
  subtotal: number;
  tax15: number;
  tax18: number;
  total: number;
  paymentMethod: string;
  status: string;
  voidedReason: string | null;
  createdAt: string;
};

export default function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const todayStr = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (status !== "all") queryParams.set("status", status);
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  else if (startDate) queryParams.set("endDate", startDate);

  const { data: invoices, isLoading, mutate } = useSWR<Invoice[]>(
    `/api/invoices?${queryParams.toString()}`,
    fetcher
  );

  const { data: currentUser } = useSWR("/api/me", fetcher);

  const [voidDialog, setVoidDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const openPreview = async (invoice: Invoice) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const openVoidDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setVoidReason("");
    setVoidDialog(true);
  };

  const handleVoid = async () => {
    if (!selectedInvoice || !voidReason.trim()) return;
    
    setProcessing(true);
    try {
      const response = await fetch(`/api/invoices/${selectedInvoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void", reason: voidReason }),
      });

      if (response.ok) {
        mutate();
        setVoidDialog(false);
      }
    } finally {
      setProcessing(false);
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "efectivo": return "Efectivo";
      case "tarjeta": return "Tarjeta";
      case "transferencia": return "Transferencia";
      default: return method;
    }
  };

  // Set default date to today
  const today = new Date().toISOString().split("T")[0];

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Historial de Facturas
            </h1>
            <p className="text-muted-foreground">
              Consulta, reimprime o anula facturas emitidas
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros de Búsqueda</CardTitle>
            <CardDescription>Filtra las facturas por fecha, estado o número</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Número o cliente..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="activa">Activas</SelectItem>
                    <SelectItem value="anulada">Anuladas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Fecha Desde
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>Fecha inicial del rango de búsqueda</TooltipContent>
                  </Tooltip>
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fecha Hasta</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !invoices || invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay facturas que coincidan con los filtros</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-[120px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id} className={invoice.status === "anulada" ? "opacity-60" : ""}>
                        <TableCell className="font-mono text-sm">
                          <span>{invoice.type === "factura" ? invoice.invoiceNumber : `C-${invoice.receiptNumber}`}</span>
                          {invoice.type === "comprobante" && (
                            <Badge variant="outline" className="ml-1 text-[10px] bg-blue-50 text-blue-700 border-blue-200">C</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDateTime(invoice.createdAt)}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{invoice.customerName}</span>
                          {invoice.customerRtn && (
                            <span className="block text-xs text-muted-foreground font-mono">
                              RTN: {invoice.customerRtn}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getPaymentMethodLabel(invoice.paymentMethod)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(invoice.total)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openPreview(invoice)}
                                  disabled={previewLoading}
                                >
                                  {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver detalle</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => window.open(`/print/${invoice.id}`, "_blank")}
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Reimprimir factura</TooltipContent>
                            </Tooltip>
                            {invoice.status === "activa" && currentUser?.role === "admin" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => openVoidDialog(invoice)}
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Anular factura</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Void Invoice Dialog */}
        <Dialog open={voidDialog} onOpenChange={setVoidDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <Ban className="h-5 w-5" />
                Anular Factura
              </DialogTitle>
              <DialogDescription>
                Esta acción no se puede deshacer. El inventario será restaurado.
              </DialogDescription>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-mono font-medium">{selectedInvoice.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedInvoice.customerName} - {formatCurrency(selectedInvoice.total)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="voidReason">Razón de Anulación *</Label>
                  <Textarea
                    id="voidReason"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder="Ingrese el motivo de la anulación..."
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setVoidDialog(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleVoid}
                disabled={!voidReason.trim() || processing}
              >
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Anular Factura
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <InvoicePreview
        invoice={previewData}
        open={!!previewData}
        onClose={() => setPreviewData(null)}
      />
    </TooltipProvider>
  );
}
