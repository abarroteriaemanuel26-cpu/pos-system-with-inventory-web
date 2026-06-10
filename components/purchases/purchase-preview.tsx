"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PurchaseItem {
  id?: number;
  productId?: number;
  productName: string;
  quantity: number;
  purchasePrice: number;
  subtotal: number;
  total: number;
  expiryDate: string | null;
}

interface PurchaseData {
  id: number;
  supplierName: string | null;
  supplierRtn: string | null;
  supplierInvoice: string | null;
  supplierInvoicePhoto: string | null;
  notes: string | null;
  subtotal: number;
  total: number;
  createdAt: string;
  purchaseType?: string;
  supplierCai?: string | null;
  items: PurchaseItem[];
  supplier: { name: string; rtn: string | null } | null;
}

export function PurchasePreview({
  purchase,
  open,
  onClose,
}: {
  purchase: PurchaseData | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!purchase) return null;

  const displaySupplier = purchase.supplierName || purchase.supplier?.name || "N/A";
  const displayRtn = purchase.supplierRtn || purchase.supplier?.rtn || "N/A";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Compra #POS{purchase.id.toString().padStart(5, "0")}
            <Badge variant={purchase.purchaseType === "factura" ? "default" : "secondary"}>
              {purchase.purchaseType === "factura" ? "Factura con CAI" : "Comprobante Simple"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Proveedor</p>
              <p className="font-medium">{displaySupplier}</p>
            </div>
            <div>
              <p className="text-muted-foreground">RTN</p>
              <p className="font-medium">{displayRtn}</p>
            </div>
            {purchase.purchaseType === "factura" && purchase.supplierCai && (
              <div>
                <p className="text-muted-foreground">CAI Proveedor</p>
                <p className="font-medium font-mono text-xs">{purchase.supplierCai}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Factura proveedor</p>
              <p className="font-medium">{purchase.supplierInvoice || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha</p>
              <p className="font-medium">
                {(() => {
                  try {
                    if (!purchase.createdAt) return "N/A";
                    const d = new Date(purchase.createdAt.includes("T") ? purchase.createdAt : purchase.createdAt.replace(" ", "T") + "Z");
                    if (isNaN(d.getTime())) return "N/A";
                    return format(d, "dd/MM/yyyy hh:mm a", { locale: es });
                  } catch { return "N/A"; }
                })()}
              </p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Producto</th>
                <th className="py-2 text-right">Cantidad</th>
                <th className="py-2 text-right">Precio</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item, idx) => (
                <tr key={item.id ?? item.productId ?? idx} className="border-b">
                  <td className="py-2">{item.productName}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">L.{item.purchasePrice.toFixed(2)}</td>
                  <td className="py-2 text-right">L.{item.subtotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end text-sm font-bold">
            <span>Total: L.{purchase.total.toFixed(2)}</span>
          </div>

          {purchase.notes && (
            <div className="text-sm">
              <p className="text-muted-foreground">Notas</p>
              <p>{purchase.notes}</p>
            </div>
          )}

          {purchase.supplierInvoicePhoto && (
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">Foto de factura</p>
              <img
                src={purchase.supplierInvoicePhoto}
                alt="Factura del proveedor"
                className="max-w-full h-auto rounded border cursor-pointer"
                onClick={(e) => {
                  const img = e.currentTarget;
                  if (img.requestFullscreen) img.requestFullscreen();
                }}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}