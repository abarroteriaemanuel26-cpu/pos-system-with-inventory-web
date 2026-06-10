"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDateTime, formatDate, formatRTN, formatInvoiceNumber } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Printer, FileText, Receipt } from "lucide-react";

type Invoice = {
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
  cashReceived: number | null;
  changeAmount: number | null;
  status: string;
  createdAt: string;
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

type CaiData = {
  cai: string;
  rtn: string;
  businessName: string;
  businessAddress: string | null;
  phone: string | null;
  rangeStart: number;
  rangeEnd: number;
  prefix: string;
  expiryDate: string;
} | null;

type Props = {
  invoice: Invoice;
  items: InvoiceItem[];
  caiData: CaiData;
  printType: "thermal" | "letter";
  simpleMode?: boolean;
  ticketFooter?: string | null;
  businessEmail?: string | null;
  businessName?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  businessRtn?: string | null;
  cashRegisterNumber?: string | null;
  cashierName?: string | null;
};

export function PrintInvoice({ invoice, items, caiData, printType: initialPrintType, simpleMode = false, ticketFooter, businessEmail, businessName, businessPhone, businessAddress, businessRtn, cashRegisterNumber, cashierName }: Props) {
  const [printType, setPrintType] = useState(initialPrintType);

  useEffect(() => {
    // Auto print after a short delay
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "efectivo": return "Efectivo";
      case "tarjeta": return "Tarjeta";
      case "transferencia": return "Transferencia";
      default: return method;
    }
  };

  const formatDateTime12h = (dateStr: string) => {
    try {
      let iso: string;
      if (dateStr.includes("T")) {
        iso = dateStr;
      } else if (dateStr.includes(" ")) {
        iso = dateStr.replace(" ", "T") + "-06:00";
      } else {
        iso = dateStr + "T00:00:00-06:00";
      }
      const d = new Date(iso);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat("es-HN", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: true,
      }).format(d);
    } catch { return dateStr; }
  };

  const isThermal = printType === "thermal";

  const displayName = businessName || caiData?.businessName || "";
  const displayAddress = businessAddress || caiData?.businessAddress || "";
  const displayRtn = businessRtn ? formatRTN(businessRtn) : (caiData ? formatRTN(caiData.rtn) : "");
  const displayPhone = businessPhone || caiData?.phone || "";
  const displayCai = caiData?.cai || "";
  const displayRangeStart = caiData?.rangeStart || 0;
  const displayRangeEnd = caiData?.rangeEnd || 0;
  const displayPrefix = caiData?.prefix || "";
  const displayExpiryDate = caiData?.expiryDate || "";
  const displayCaja = cashRegisterNumber || "";

  if (isThermal) {
    return (
      <>
        {/* Print Controls - Hidden when printing */}
        <div className="print:hidden fixed top-4 right-4 flex gap-2 z-50">
          <Button
            variant="default"
            size="sm"
            onClick={() => setPrintType("thermal")}
          >
            <Receipt className="mr-2 h-4 w-4" />
            Ticket
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPrintType("letter")}
          >
            <FileText className="mr-2 h-4 w-4" />
            Carta
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>

        {/* Thermal Receipt (80mm) */}
        <div className="w-[80mm] mx-auto p-2 bg-white text-black font-mono text-[10px] leading-tight">
          {/* Header */}
          <div className="text-center mb-1">
            {(businessName || caiData) ? (
              <>
                <p className="font-bold text-[12px]">{businessName || caiData?.businessName}</p>
                {(businessAddress || caiData?.businessAddress) && <p>{(businessAddress || caiData?.businessAddress)}</p>}
                {displayRtn && <p>RTN: {displayRtn}</p>}
                {displayPhone && <p>Tel: {displayPhone}</p>}
                {displayCaja && <p>Caja No. {displayCaja}</p>}
              </>
            ) : null}
          </div>

          {/* Invoice Info */}
          <div className="text-center mb-1">
            <p className="font-bold text-[11px]">{invoice.type === "factura" ? "FACTURA" : "COMPROBANTE"}</p>
            <p className="font-bold text-[11px]">
              {invoice.type === "factura" ? invoice.invoiceNumber : `C-${invoice.receiptNumber}`}
            </p>
            <p>{formatDateTime12h(invoice.createdAt)}</p>
            {cashierName && <p>Cajero: {cashierName}</p>}
          </div>

          {/* Customer */}
          <div className="mb-1">
            <p>Cliente: {invoice.customerName}</p>
            {invoice.customerRtn && <p>RTN: {formatRTN(invoice.customerRtn)}</p>}
          </div>

          <div className="border-t border-dashed border-black my-1" />

          {/* Items */}
          <table className="w-full">
            <thead>
              <tr className="border-b border-dashed border-black">
                <th className="text-left">Desc.</th>
                <th className="text-right w-8">Cnt</th>
                <th className="text-right w-16">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="text-left truncate max-w-[35mm]">
                    {item.productName}
                  </td>
                  <td className="text-right">{item.quantity}</td>
                  <td className="text-right">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-black my-1" />

          {/* Totals */}
          <div className="space-y-0.5">
            {!simpleMode && (
              <>
                {invoice.taxable15 > 0 && (
                  <div className="flex justify-between">
                    <span>Gravado 15%:</span>
                    <span>{formatCurrency(invoice.taxable15)}</span>
                  </div>
                )}
                {invoice.tax15 > 0 && (
                  <div className="flex justify-between">
                    <span>ISV 15%:</span>
                    <span>{formatCurrency(invoice.tax15)}</span>
                  </div>
                )}
                {invoice.taxExempt > 0 && (
                  <div className="flex justify-between">
                    <span>Exento:</span>
                    <span>{formatCurrency(invoice.taxExempt)}</span>
                  </div>
                )}
              </>
            )}
            <div className="border-t border-black my-1" />
            <div className="flex justify-between font-bold text-[12px]">
              <span>TOTAL:</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="mt-1 pt-1 border-t border-dashed border-black">
            <div className="flex justify-between">
              <span>Forma de Pago:</span>
              <span>{getPaymentMethodLabel(invoice.paymentMethod)}</span>
            </div>
            {invoice.cashReceived != null && (
              <>
                <div className="flex justify-between">
                  <span>Efectivo:</span>
                  <span>{formatCurrency(invoice.cashReceived)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cambio:</span>
                  <span>{formatCurrency(invoice.changeAmount || 0)}</span>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-dashed border-black my-1" />

          {/* CAI Info - only for facturas */}
          {invoice.type === "factura" && caiData && (
            <div className="text-[8px] space-y-0.5">
              <p>CAI: {displayCai}</p>
              <p>
                Rango: {formatInvoiceNumber(displayPrefix, displayRangeStart)} al{" "}
                {formatInvoiceNumber(displayPrefix, displayRangeEnd)}
              </p>
              <p>Fecha Lím. Emisión: {formatDate(displayExpiryDate)}</p>
            </div>
          )}

          {businessEmail && <p className="text-center text-[8px]">{businessEmail}</p>}

          {invoice.type === "comprobante" && (
            <p className="text-center text-[8px] mt-1">Comprobante de Venta</p>
          )}

          <div className="border-t border-dashed border-black my-1" />

          {/* Footer */}
          <div className="text-center">
            <p>{ticketFooter || "Gracias por su compra"}</p>
            {invoice.status === "anulada" && (
              <p className="font-bold mt-1">*** ANULADA ***</p>
            )}
          </div>
        </div>

        <style jsx global>{`
          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
        `}</style>
      </>
    );
  }

  // Letter Size Invoice
  return (
    <>
      {/* Print Controls */}
      <div className="print:hidden fixed top-4 right-4 flex gap-2 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPrintType("thermal")}
        >
          <Receipt className="mr-2 h-4 w-4" />
          Ticket
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => setPrintType("letter")}
        >
          <FileText className="mr-2 h-4 w-4" />
          Carta
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* Letter Size Invoice */}
      <div className="w-[8.5in] min-h-[11in] mx-auto p-8 bg-white text-black">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            {(businessName || caiData) && (
              <>
                <h1 className="text-2xl font-bold">{businessName || caiData?.businessName}</h1>
                {(businessAddress || caiData?.businessAddress) && <p className="text-gray-600">{businessAddress || caiData?.businessAddress}</p>}
                <p>RTN: {businessRtn ? formatRTN(businessRtn) : (caiData ? formatRTN(caiData.rtn) : "")}</p>
                {(businessPhone || caiData?.phone) && <p>Tel: {businessPhone || caiData?.phone}</p>}
                {cashRegisterNumber && <p>Caja No. {cashRegisterNumber}</p>}
              </>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-800">
              {invoice.type === "factura" ? "FACTURA" : "COMPROBANTE"}
            </h2>
            <p className="text-2xl font-mono font-bold">
              {invoice.type === "factura" ? invoice.invoiceNumber : `C-${invoice.receiptNumber}`}
            </p>
            <p className="text-gray-600">{formatDateTime(invoice.createdAt)}</p>
            {invoice.status === "anulada" && (
              <span className="inline-block mt-2 px-3 py-1 bg-red-100 text-red-800 font-bold rounded">
                ANULADA
              </span>
            )}
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <h3 className="font-semibold mb-2">Datos del Cliente</h3>
          <p className="font-medium">{invoice.customerName}</p>
          {invoice.customerRtn ? (
            <p>RTN: {formatRTN(invoice.customerRtn)}</p>
          ) : (
            <p className="text-gray-500">Consumidor Final</p>
          )}
        </div>

        {/* Items Table */}
        <table className="w-full mb-6">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2">Descripción</th>
              <th className="text-center py-2">Cantidad</th>
              <th className="text-right py-2">P. Unitario</th>
              {!simpleMode && <th className="text-right py-2">ISV</th>}
              <th className="text-right py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="py-2">{item.productName}</td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                {!simpleMode && <td className="py-2 text-right">{item.taxRate}%</td>}
                <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-72">
            {!simpleMode && (
              <>
                <div className="flex justify-between py-1">
                  <span>Subtotal Gravado 15%:</span>
                  <span>{formatCurrency(invoice.taxable15)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>ISV 15%:</span>
                  <span>{formatCurrency(invoice.tax15)}</span>
                </div>
                {invoice.taxable18 > 0 && (
                  <>
                    <div className="flex justify-between py-1">
                      <span>Subtotal Gravado 18%:</span>
                      <span>{formatCurrency(invoice.taxable18)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>ISV 18%:</span>
                      <span>{formatCurrency(invoice.tax18)}</span>
                    </div>
                  </>
                )}
                {invoice.taxExempt > 0 && (
                  <div className="flex justify-between py-1">
                    <span>Exento:</span>
                    <span>{formatCurrency(invoice.taxExempt)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between py-2 border-t-2 border-black text-xl font-bold">
              <span>TOTAL:</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <div className="flex justify-between">
            <span>Forma de Pago: <strong>{getPaymentMethodLabel(invoice.paymentMethod)}</strong></span>
            {invoice.cashReceived && (
              <span>
                Efectivo: {formatCurrency(invoice.cashReceived)} | 
                Cambio: {formatCurrency(invoice.changeAmount || 0)}
              </span>
            )}
          </div>
        </div>

        {/* CAI Info - only for facturas */}
        {invoice.type === "factura" && caiData && (
          <div className="text-xs text-gray-600 border-t pt-4">
            <p>CAI: {caiData.cai}</p>
            <p>
              Rango Autorizado: {formatInvoiceNumber(caiData.prefix, caiData.rangeStart)} al{" "}
              {formatInvoiceNumber(caiData.prefix, caiData.rangeEnd)}
            </p>
            <p>Fecha Límite de Emisión: {formatDate(caiData.expiryDate)}</p>
          </div>
        )}

        {invoice.type === "comprobante" && (
          <div className="text-center text-gray-500 text-xs border-t pt-4">
            <p>Comprobante de Venta</p>
          </div>
        )}

        {businessEmail && (
          <div className="text-center text-gray-500 text-xs">
            <p>{businessEmail}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500">
          <p>{ticketFooter || "Gracias por su compra"}</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </>
  );
}
