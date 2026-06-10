"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime, formatDate, formatRTN, formatInvoiceNumber } from "@/lib/utils/format";
import {
  Printer,
  FileText,
  Receipt,
  Loader2,
  ShoppingCart,
} from "lucide-react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al obtener datos");
  }
  return res.json();
};

type InvoiceItem = {
  id: number;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
};

type Props = {
  invoiceId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  simpleMode?: boolean;
};

export function InvoicePreview({ invoiceId, open, onOpenChange, simpleMode = false }: Props) {
  const { data: invoice, isLoading } = useSWR(
    open ? `/api/invoices/${invoiceId}` : null,
    fetcher
  );

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <ShoppingCart className="h-5 w-5" />
            {invoice?.type === "factura" ? "Factura Generada" : "Comprobante Generado"}
          </DialogTitle>
          <DialogDescription>
            {invoice?.type === "factura" ? "Vista previa de la factura" : "Vista previa del comprobante"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : invoice ? (
          <div className="space-y-4">
            {/* Business Info */}
            <div className="text-center border-b pb-4">
              {invoice.businessName && <p className="font-bold text-lg">{invoice.businessName}</p>}
              {invoice.businessAddress && (
                <p className="text-sm text-muted-foreground">{invoice.businessAddress}</p>
              )}
              {invoice.phone && (
                <p className="text-sm text-muted-foreground">Tel: {invoice.phone}</p>
              )}
              {invoice.rtn && (
                <p className="text-sm text-muted-foreground">RTN: {formatRTN(invoice.rtn)}</p>
              )}
              {invoice.businessEmail && (
                <p className="text-sm text-muted-foreground">{invoice.businessEmail}</p>
              )}
              {invoice.cashRegisterNumber && (
                <p className="text-sm text-muted-foreground">Caja No. {invoice.cashRegisterNumber}</p>
              )}
            </div>

            {/* Invoice Info */}
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground">
                  {invoice.type === "factura" ? "Factura" : "Comprobante No."}
                </p>
                <p className="text-xl font-bold font-mono">
                  {invoice.type === "factura" ? invoice.invoiceNumber : `C-${invoice.receiptNumber}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Fecha</p>
                <p className="text-sm">{formatDateTime(invoice.createdAt)}</p>
              </div>
            </div>
            {invoice.cashierName && (
              <p className="text-xs text-muted-foreground text-right">Cajero: {invoice.cashierName}</p>
            )}

            {/* Customer */}
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-medium">{invoice.customerName}</p>
              {invoice.customerRtn && (
                <p className="text-sm text-muted-foreground">RTN: {formatRTN(invoice.customerRtn)}</p>
              )}
            </div>

            {/* Items */}
            <div>
              <p className="text-sm font-medium mb-2">Detalle de Productos</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1">Descripción</th>
                    <th className="text-center py-1">Cant</th>
                    <th className="text-right py-1">P. Unit</th>
                    <th className="text-right py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.items || []).map((item: InvoiceItem) => (
                    <tr key={item.id} className="border-b border-dashed">
                      <td className="py-2">{item.productName}</td>
                      <td className="text-center py-2">{item.quantity}</td>
                      <td className="text-right py-2">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-right py-2 font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex flex-col items-end space-y-1">
              {!simpleMode && (
                <>
                  {invoice.taxExempt > 0 && (
                    <div className="flex justify-between w-64 text-sm">
                      <span className="text-muted-foreground">Exento:</span>
                      <span>{formatCurrency(invoice.taxExempt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between w-64 text-sm">
                    <span className="text-muted-foreground">Gravado 15%:</span>
                    <span>{formatCurrency(invoice.taxable15)}</span>
                  </div>
                  <div className="flex justify-between w-64 text-sm">
                    <span className="text-muted-foreground">ISV 15%:</span>
                    <span>{formatCurrency(invoice.tax15)}</span>
                  </div>
                  {invoice.taxable18 > 0 && (
                    <>
                      <div className="flex justify-between w-64 text-sm">
                        <span className="text-muted-foreground">Gravado 18%:</span>
                        <span>{formatCurrency(invoice.taxable18)}</span>
                      </div>
                      <div className="flex justify-between w-64 text-sm">
                        <span className="text-muted-foreground">ISV 18%:</span>
                        <span>{formatCurrency(invoice.tax18)}</span>
                      </div>
                    </>
                  )}
                </>
              )}
              <Separator className="w-64" />
              <div className="flex justify-between w-64 text-lg font-bold">
                <span>TOTAL:</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
            </div>

            {/* Payment */}
            <div className="flex justify-between text-sm border-t pt-2">
              <span>
                Pago: <strong className="capitalize">{invoice.paymentMethod}</strong>
              </span>
              {invoice.cashReceived && (
                <span>
                  Efectivo: {formatCurrency(invoice.cashReceived)} | Cambio:{" "}
                  {formatCurrency(invoice.changeAmount || 0)}
                </span>
              )}
            </div>

            {/* CAI Info - only for facturas */}
            {invoice.cai && (
              <div className="text-xs text-muted-foreground border-t pt-2 space-y-0.5">
                <p>CAI: {invoice.cai}</p>
                <p>
                  Rango: {formatInvoiceNumber(invoice.prefix, invoice.rangeStart)} al{" "}
                  {formatInvoiceNumber(invoice.prefix, invoice.rangeEnd)}
                </p>
                {invoice.caiExpiryDate && (
                  <p>Fecha Lím. Emisión: {formatDate(invoice.caiExpiryDate)}</p>
                )}
              </div>
            )}
            {invoice.type === "comprobante" && (
              <div className="text-xs text-muted-foreground border-t pt-2 text-center">
                <p>Comprobante de Venta</p>
              </div>
            )}

            {invoice.businessEmail && (
              <p className="text-xs text-muted-foreground text-center">{invoice.businessEmail}</p>
            )}

            {invoice.status === "anulada" && (
              <Badge variant="destructive" className="w-full justify-center">ANULADA</Badge>
            )}

            {invoice.ticketFooter && (
              <p className="text-xs text-muted-foreground text-center border-t pt-2">{invoice.ticketFooter}</p>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => window.open(`/print/${invoiceId}?type=thermal${simpleMode ? "&simple=true" : ""}`, "_blank")}
          >
            <Receipt className="mr-2 h-4 w-4" />
            Ticket
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`/print/${invoiceId}?type=letter${simpleMode ? "&simple=true" : ""}`, "_blank")}
          >
            <FileText className="mr-2 h-4 w-4" />
            Carta
          </Button>
          <Button onClick={() => window.open(`/print/${invoiceId}${simpleMode ? "?simple=true" : ""}`, "_blank")}>
            <Printer className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Nueva Venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
