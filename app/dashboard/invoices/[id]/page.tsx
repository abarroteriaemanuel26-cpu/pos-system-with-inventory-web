import { getDb, isDatabaseConfigured } from "@/lib/db";
import { invoices, invoiceItems, caiConfigs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { formatCurrency, formatDateTime, formatDate, formatRTN, formatInvoiceNumber } from "@/lib/utils/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Printer, Ban } from "lucide-react";
import Link from "next/link";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailPage({ params }: Props) {
  if (!isDatabaseConfigured()) {
    redirect("/dashboard");
  }
  
  const db = getDb();
  const { id } = await params;
  const invoiceId = parseInt(id);

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));

  if (!invoice) {
    notFound();
  }

  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

  let caiData = null;
  if (invoice.caiId) {
    const [cai] = await db.select().from(caiConfigs).where(eq(caiConfigs.id, invoice.caiId));
    caiData = cai;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/invoices">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-mono">
              {invoice.type === "factura" ? invoice.invoiceNumber : `C-${invoice.receiptNumber}`}
            </h1>
            <p className="text-muted-foreground">
              {formatDateTime(invoice.createdAt)} — {invoice.type === "factura" ? "Factura con CAI" : "Comprobante"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {invoice.status === "activa" ? (
            <Badge className="bg-green-600">Activa</Badge>
          ) : (
            <Badge variant="destructive">Anulada</Badge>
          )}
          <Link href={`/print/${id}`} target="_blank">
            <Button>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </Link>
        </div>
      </div>

      {invoice.status === "anulada" && invoice.voidedReason && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <Ban className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="font-medium text-destructive">Factura Anulada</p>
                <p className="text-sm text-muted-foreground">{invoice.voidedReason}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del Emisor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {caiData ? (
              <>
                <p className="font-medium">{caiData.businessName}</p>
                <p className="text-muted-foreground">{caiData.businessAddress || "Sin dirección"}</p>
                <p>RTN: <span className="font-mono">{formatRTN(caiData.rtn)}</span></p>
                {caiData.phone && <p>Tel: {caiData.phone}</p>}
              </>
            ) : (
              <p className="text-muted-foreground">Datos del emisor no disponibles</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{invoice.customerName}</p>
            {invoice.customerRtn ? (
              <p>RTN: <span className="font-mono">{formatRTN(invoice.customerRtn)}</span></p>
            ) : (
              <p className="text-muted-foreground">Consumidor Final</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle de Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-center">Cant.</TableHead>
                <TableHead className="text-right">P. Unit.</TableHead>
                <TableHead className="text-right">ISV</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-right">{item.taxRate}%</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-end space-y-2">
            <div className="flex justify-between w-full max-w-xs">
              <span className="text-muted-foreground">Subtotal Gravado 15%:</span>
              <span>{formatCurrency(invoice.taxable15)}</span>
            </div>
            <div className="flex justify-between w-full max-w-xs">
              <span className="text-muted-foreground">ISV 15%:</span>
              <span>{formatCurrency(invoice.tax15)}</span>
            </div>
            {invoice.taxable18 > 0 && (
              <>
                <div className="flex justify-between w-full max-w-xs">
                  <span className="text-muted-foreground">Subtotal Gravado 18%:</span>
                  <span>{formatCurrency(invoice.taxable18)}</span>
                </div>
                <div className="flex justify-between w-full max-w-xs">
                  <span className="text-muted-foreground">ISV 18%:</span>
                  <span>{formatCurrency(invoice.tax18)}</span>
                </div>
              </>
            )}
            {invoice.taxExempt > 0 && (
              <div className="flex justify-between w-full max-w-xs">
                <span className="text-muted-foreground">Exento:</span>
                <span>{formatCurrency(invoice.taxExempt)}</span>
              </div>
            )}
            <Separator className="w-full max-w-xs" />
            <div className="flex justify-between w-full max-w-xs text-xl font-bold">
              <span>TOTAL:</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {invoice.type === "factura" && caiData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información Fiscal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">CAI: </span>
              <span className="font-mono break-all">{caiData.cai}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Rango Autorizado: </span>
              <span className="font-mono">
                {formatInvoiceNumber(caiData.prefix, caiData.rangeStart)} al{" "}
                {formatInvoiceNumber(caiData.prefix, caiData.rangeEnd)}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Fecha Límite de Emisión: </span>
              {formatDate(caiData.expiryDate)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
