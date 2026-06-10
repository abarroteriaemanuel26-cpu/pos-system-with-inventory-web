"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface InvoiceItem {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
}

interface InvoiceData {
  id: number;
  invoiceNumber: string;
  receiptNumber: string | null;
  type: string;
  customerName: string;
  customerRtn: string | null;
  subtotal: number;
  taxExempt: number;
  taxable15: number;
  taxable18: number;
  tax15: number;
  tax18: number;
  total: number;
  paymentMethod: string;
  status: string;
  voidedReason: string | null;
  cashReceived: number | null;
  changeAmount: number | null;
  createdAt: string;
  items: InvoiceItem[];
  cai?: string;
  caiExpiryDate?: string;
  rangeStart?: number;
  rangeEnd?: number;
  rtn?: string;
  businessName?: string;
  businessAddress?: string;
  phone?: string;
  businessEmail?: string;
  cashRegisterNumber?: string;
  cashierName?: string;
  prefix?: string;
}

export function InvoicePreview({
  invoice,
  open,
  onClose,
}: {
  invoice: InvoiceData | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!invoice) return null;

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "efectivo": return "Efectivo";
      case "tarjeta": return "Tarjeta";
      case "transferencia": return "Transferencia";
      default: return method;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {invoice.type === "factura" ? `Factura ${invoice.invoiceNumber}` : `Comprobante C-${invoice.receiptNumber}`}
            {invoice.status === "anulada" ? (
              <Badge variant="destructive">Anulada</Badge>
            ) : (
              <Badge className="bg-green-600">Activa</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Business Info */}
          <div className="text-center border-b pb-3">
            {invoice.businessName && <p className="font-bold text-lg">{invoice.businessName}</p>}
            {invoice.businessAddress && (
              <p className="text-sm text-muted-foreground">{invoice.businessAddress}</p>
            )}
            {invoice.rtn && (
              <p className="text-sm text-muted-foreground">RTN: {invoice.rtn}</p>
            )}
            {invoice.phone && (
              <p className="text-sm text-muted-foreground">Tel: {invoice.phone}</p>
            )}
            {invoice.businessEmail && (
              <p className="text-sm text-muted-foreground">{invoice.businessEmail}</p>
            )}
            {invoice.cashRegisterNumber && (
              <p className="text-sm text-muted-foreground">Caja No. {invoice.cashRegisterNumber}</p>
            )}
          </div>

          {invoice.type === "factura" && invoice.cai && (
            <div className="text-xs text-muted-foreground border-b pb-2 space-y-0.5">
              <p><span className="font-medium">CAI:</span> {invoice.cai}</p>
              {invoice.rangeStart != null && invoice.rangeEnd != null && (
                <p><span className="font-medium">Rango:</span> {invoice.prefix || ""}{invoice.prefix ? "-" : ""}{String(invoice.rangeStart).padStart(8, "0")} al {invoice.prefix || ""}{invoice.prefix ? "-" : ""}{String(invoice.rangeEnd).padStart(8, "0")}</p>
              )}
              {invoice.caiExpiryDate && (
                <p><span className="font-medium">Vence:</span> {format(new Date(invoice.caiExpiryDate + "T23:59:59-06:00"), "dd/MM/yyyy", { locale: es })}</p>
              )}
            </div>
          )}
          {invoice.type === "comprobante" && (
            <p className="text-xs text-muted-foreground text-center border-b pb-2">Comprobante de Venta</p>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Cliente</p>
              <p className="font-medium">{invoice.customerName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">RTN</p>
              <p className="font-medium font-mono">{invoice.customerRtn || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Método de pago</p>
              <p className="font-medium">{getPaymentMethodLabel(invoice.paymentMethod)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha</p>
              <p className="font-medium">
                {(() => {
                  try {
                    if (!invoice.createdAt) return "N/A";
                    const d = new Date(invoice.createdAt.includes("T") ? invoice.createdAt : invoice.createdAt.replace(" ", "T") + "Z");
                    if (isNaN(d.getTime())) return "N/A";
                    return format(d, "dd/MM/yyyy hh:mm a", { locale: es });
                  } catch { return "N/A"; }
                })()}
              </p>
            </div>
            {invoice.cashierName && (
              <div>
                <p className="text-muted-foreground">Cajero</p>
                <p className="font-medium">{invoice.cashierName}</p>
              </div>
            )}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Producto</th>
                <th className="py-2 text-right">Cant.</th>
                <th className="py-2 text-right">Precio</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.productName}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">L.{item.unitPrice.toFixed(2)}</td>
                  <td className="py-2 text-right">L.{item.subtotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex justify-between w-48">
              <span>Subtotal:</span>
              <span>L.{invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.tax15 > 0 && (
              <div className="flex justify-between w-48">
                <span>ISV 15%:</span>
                <span>L.{invoice.tax15.toFixed(2)}</span>
              </div>
            )}
            {invoice.tax18 > 0 && (
              <div className="flex justify-between w-48">
                <span>ISV 18%:</span>
                <span>L.{invoice.tax18.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between w-48 font-bold text-base border-t pt-1">
              <span>Total:</span>
              <span>L.{invoice.total.toFixed(2)}</span>
            </div>
          </div>

          {invoice.paymentMethod === "efectivo" && invoice.cashReceived != null && (
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex justify-between w-48">
                <span>Recibido:</span>
                <span>L.{invoice.cashReceived.toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-48">
                <span>Cambio:</span>
                <span>L.{(invoice.changeAmount ?? 0).toFixed(2)}</span>
              </div>
            </div>
          )}

          {invoice.voidedReason && (
            <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm">
              <p className="font-medium text-destructive">Motivo de anulación</p>
              <p className="text-muted-foreground">{invoice.voidedReason}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => window.open(`/print/${invoice.id}?type=thermal`, "_blank")}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
          <Button onClick={() => window.open(`/print/${invoice.id}`, "_blank")}>
            <FileText className="mr-2 h-4 w-4" />
            Descargar PDF
          </Button>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}