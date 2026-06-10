"use client";

import { useState, useEffect, useRef } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  ClipboardList,
  Plus,
  Trash2,
  Loader2,
  Search,
  HelpCircle,
  Calendar,
  Package,
  Barcode,
  Eye,
  ImagePlus,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { PurchasePreview } from "@/components/purchases/purchase-preview";
import { toast } from "sonner";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al obtener datos");
  }
  return res.json();
};

type Supplier = {
  id: number;
  name: string;
  rtn: string | null;
  address: string | null;
  phone: string | null;
};

type PurchaseItem = {
  key: string;
  productId?: number;
  barcode: string;
  productName: string;
  quantity: number;
  purchasePrice: number;
  unit: string;
  expiryDate: string;
};

type Purchase = {
  id: number;
  supplierName: string;
  supplierInvoice: string | null;
  total: number;
  createdAt: string;
};

const UNITS = [
  "unidad", "libra", "onza", "kilo", "gramo", "ristra", "bolsa", "paquete",
  "litro", "galón", "metro", "caja", "docena", "pieza", "rollo", "par", "botella", "lata"
];

export default function PurchasesPage() {
  const [tab, setTab] = useState<"list" | "new">("list");
  const [search, setSearch] = useState("");
  const [newDialog, setNewDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewPurchase, setPreviewPurchase] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // New purchase form
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierRtn, setSupplierRtn] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierRtnSuggestions, setSupplierRtnSuggestions] = useState<Supplier[]>([]);
  const [purchaseType, setPurchaseType] = useState<"factura" | "comprobante">("comprobante");
  const [supplierCai, setSupplierCai] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [supplierInvoicePhoto, setSupplierInvoicePhoto] = useState("");
  const [notes, setNotes] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [productSuggestions, setProductSuggestions] = useState<Record<string, any[]>>({});
  const [barcodeSuggestions, setBarcodeSuggestions] = useState<Record<string, any[]>>({});
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingPurchase, setDeletingPurchase] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteKeepStock, setDeleteKeepStock] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  const [editReason, setEditReason] = useState("");
  const [editConfirm, setEditConfirm] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editFormLoading, setEditFormLoading] = useState(false);

  const { data: purchases, isLoading } = useSWR<Purchase[]>(
    tab === "list" ? "/api/purchases" : null,
    fetcher
  );

  const { data: suppliers } = useSWR<Supplier[]>(
    supplierSearch ? `/api/suppliers?search=${encodeURIComponent(supplierSearch)}` : "/api/suppliers",
    fetcher
  );

  const { data: products } = useSWR(
    "/api/products",
    fetcher
  );

  // Search supplier by RTN
  const rtnTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (rtnTimerRef.current) clearTimeout(rtnTimerRef.current);
    if (supplierRtn.length < 3) {
      setSupplierRtnSuggestions([]);
      return;
    }
    rtnTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suppliers?search=${encodeURIComponent(supplierRtn)}`);
        if (res.ok) {
          const data = await res.json();
          setSupplierRtnSuggestions(data);
        }
      } catch {}
    }, 300);
  }, [supplierRtn]);

  const addItem = () => {
    setPurchaseItems([
      ...purchaseItems,
      {
        key: Date.now().toString(),
        barcode: "",
        productName: "",
        quantity: 1,
        purchasePrice: 0,
        unit: "unidad",
        expiryDate: "",
      },
    ]);
  };

  const searchBarcode = async (key: string, barcode: string) => {
    updateItem(key, "barcode", barcode);
    updateItem(key, "productId", undefined);
    if (barcode.length < 1) { setBarcodeSuggestions((prev) => ({ ...prev, [key]: [] })); return; }
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(barcode)}`);
      const results = await res.json();
      if (Array.isArray(results)) {
        setBarcodeSuggestions((prev) => ({ ...prev, [key]: results }));
        // Exact barcode match auto-fills
        const exact = results.find((p: any) => p.barcode === barcode);
        if (exact) {
          updateItem(key, "productId", exact.id);
          updateItem(key, "productName", exact.name);
          updateItem(key, "purchasePrice", exact.purchasePrice);
          updateItem(key, "unit", exact.unit);
          setBarcodeSuggestions((prev) => ({ ...prev, [key]: [] }));
          return;
        }
        if (results.length === 1) {
          const p = results[0];
          updateItem(key, "productId", p.id);
          updateItem(key, "productName", p.name);
          updateItem(key, "purchasePrice", p.purchasePrice);
          updateItem(key, "unit", p.unit);
          setBarcodeSuggestions((prev) => ({ ...prev, [key]: [] }));
        }
      }
    } catch {}
  };

  const searchProductName = async (key: string, name: string) => {
    updateItem(key, "productName", name);
    updateItem(key, "productId", undefined);
    if (name.length < 2) return;
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(name)}`);
      const results = await res.json();
      if (Array.isArray(results)) {
        setProductSuggestions((prev: any) => ({ ...prev, [key]: results }));
      }
    } catch {}
  };

  const selectProductSuggestion = (key: string, product: any) => {
    updateItem(key, "productId", product.id);
    updateItem(key, "productName", product.name);
    updateItem(key, "barcode", product.barcode || "");
    updateItem(key, "purchasePrice", product.purchasePrice || 0);
    updateItem(key, "unit", product.unit || "unidad");
    setProductSuggestions((prev: any) => ({ ...prev, [key]: [] }));
    setBarcodeSuggestions((prev: any) => ({ ...prev, [key]: [] }));
  };

  const updateItem = (key: string, field: keyof PurchaseItem, value: unknown) => {
    setPurchaseItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (key: string) => {
    setPurchaseItems((prev) => prev.filter((item) => item.key !== key));
  };

  const selectSupplier = (supplier: Supplier) => {
    setSelectedSupplierId(supplier.id);
    setSupplierName(supplier.name);
    setSupplierRtn(supplier.rtn || "");
    setSupplierAddress(supplier.address || "");
    setSupplierPhone(supplier.phone || "");
    setSupplierSearch("");
  };

  const handleSave = async () => {
    if (!supplierName.trim()) {
      toast.error("Ingrese el nombre del proveedor");
      return;
    }
    if (purchaseItems.length === 0) {
      toast.error("Agregue al menos un producto");
      return;
    }
    if (editingPurchase && (!editReason || editReason.trim().length < 5)) {
      toast.error("Debe especificar un motivo de edición (mínimo 5 caracteres)");
      return;
    }
    for (const item of purchaseItems) {
      if (!item.productName.trim()) {
        toast.error("Todos los productos deben tener nombre");
        return;
      }
      if (item.quantity <= 0) {
        toast.error("La cantidad debe ser mayor a 0");
        return;
      }
      if (item.purchasePrice <= 0) {
        toast.error("El precio de compra debe ser mayor a 0");
        return;
      }
    }

    if (!editConfirm && editingPurchase) {
      setEditConfirm(true);
      return;
    }

    setSaving(true);
    try {
      const url = editingPurchase ? `/api/purchases/${editingPurchase.id}` : "/api/purchases";
      const method = editingPurchase ? "PUT" : "POST";
      const body: any = {
        supplierId: selectedSupplierId,
        supplierName: supplierName.trim(),
        supplierRtn: supplierRtn.trim() || null,
        supplierAddress: supplierAddress.trim() || null,
        supplierPhone: supplierPhone.trim() || null,
        purchaseType,
        supplierCai: supplierCai.trim() || null,
        supplierInvoice: supplierInvoice.trim() || null,
        supplierInvoicePhoto: supplierInvoicePhoto || null,
        notes: notes.trim() || null,
        items: purchaseItems.map((item) => ({
          productId: item.productId,
          barcode: item.barcode || null,
          productName: item.productName.trim(),
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          unit: item.unit,
          expiryDate: item.expiryDate || null,
        })),
      };
      if (editingPurchase) {
        body.reason = editReason.trim();
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const saved = await response.json();
        mutate("/api/purchases");
        mutate((key) => typeof key === "string" && key.startsWith("/api/products"));
        setPreviewPurchase(editingPurchase || saved);
        resetForm();
        setEditingPurchase(null);
        setEditReason("");
        setEditConfirm(false);
        if (editingPurchase) {
          setTab("list");
          toast.success("Compra editada correctamente");
        } else {
          toast.success("Compra guardada exitosamente");
        }
      } else {
        let errorMsg = "Error al guardar compra";
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch {}
        toast.error(errorMsg);
      }
    } catch (err) {
      toast.error("Error de conexión al guardar la compra");
      console.error("Save purchase error:", err);
    } finally {
      setSaving(false);
    }
  };

  const openPurchasePreview = async (purchase: Purchase) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/purchases/${purchase.id}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewPurchase(data);
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const resetForm = () => {
    setPurchaseType("comprobante");
    setSupplierCai("");
    setSupplierName("");
    setSupplierRtn("");
    setSupplierAddress("");
    setSupplierPhone("");
    setSupplierInvoice("");
    setSupplierInvoicePhoto("");
    setNotes("");
    setSelectedSupplierId(null);
    setPurchaseItems([{ key: Date.now().toString(), productId: undefined, barcode: "", productName: "", quantity: 1, purchasePrice: 0, unit: "unidad", expiryDate: "" }]);
    setProductSuggestions({});
    setBarcodeSuggestions({});
    setEditingPurchase(null);
    setEditReason("");
    setEditConfirm(false);
  };

  const subtotal = purchaseItems.reduce((sum, item) => sum + item.quantity * item.purchasePrice, 0);

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="h-6 w-6" />
              Compras
            </h1>
            <p className="text-muted-foreground">
              Registre las compras a proveedores y entrada de inventario
            </p>
          </div>
          <Button onClick={() => { resetForm(); setTab("new"); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Compra
          </Button>
        </div>

        {tab === "list" ? (
          <Card>
            <CardHeader>
              <CardTitle>Historial de Compras</CardTitle>
              <CardDescription>Todas las compras registradas</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !purchases || purchases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay compras registradas</p>
                  <Button variant="outline" className="mt-4" onClick={() => setTab("new")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Registrar Primera Compra
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Factura Prov.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-[130px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{formatDate(p.createdAt)}</TableCell>
                          <TableCell className="font-medium">{p.supplierName}</TableCell>
                          <TableCell className="font-mono text-sm">{p.supplierInvoice || "-"}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(p.total)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openPurchasePreview(p)} disabled={previewLoading}>
                                {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                              </Button>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" disabled={editFormLoading} onClick={async () => { setEditFormLoading(true); try { const r = await fetch(`/api/purchases/${p.id}`); if (r.ok) { const d = await r.json(); setEditingPurchase(d); setPurchaseType(d.purchaseType || "comprobante"); setSupplierCai(d.supplierCai || ""); setSupplierName(d.supplierName || ""); setSupplierRtn(d.supplierRtn || ""); setSupplierAddress(d.supplierAddress || ""); setSupplierPhone(d.supplierPhone || ""); setSupplierInvoice(d.supplierInvoice || ""); setSupplierInvoicePhoto(d.supplierInvoicePhoto || ""); setNotes(d.notes || ""); setSelectedSupplierId(d.supplierId ?? null); setPurchaseItems((d.items || []).map((i: any) => ({ key: Date.now().toString() + Math.random(), productId: i.productId, barcode: "", productName: i.productName, quantity: i.quantity, purchasePrice: i.purchasePrice, unit: i.unit || "unidad", expiryDate: i.expiryDate || "" }))); setTab("new"); } } finally { setEditFormLoading(false); } }}>
                                    {editFormLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar compra</TooltipContent>
                              </Tooltip>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => { setDeletingPurchase(p); setDeleteConfirm(false); setDeleteKeepStock(false); setDeleteDialog(true); }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {editingPurchase && (
              <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/10">
                <CardContent className="pt-4 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Pencil className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm font-medium">
                    Editando compra #{editingPurchase.id} — {editingPurchase.supplierName}
                  </p>
                </CardContent>
              </Card>
            )}
            {/* Supplier Info */}
            <Card>
              <CardHeader>
                <CardTitle>Datos del Proveedor</CardTitle>
                <CardDescription>Información del proveedor y factura</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Label>Proveedor *</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={supplierSearch}
                        onChange={(e) => setSupplierSearch(e.target.value)}
                        placeholder="Buscar proveedor existente o escribir nuevo..."
                        className="pl-9"
                      />
                    </div>
                  </div>
                  {suppliers && suppliers.length > 0 && supplierSearch && (
                    <Card className="absolute z-10 w-full mt-1 shadow-lg">
                      <CardContent className="p-2 max-h-40 overflow-y-auto">
                        {suppliers.map((s) => (
                          <button
                            key={s.id}
                            className="w-full text-left p-2 rounded hover:bg-muted text-sm"
                            onClick={() => selectSupplier(s)}
                          >
                            <span className="font-medium">{s.name}</span>
                            {s.rtn && <span className="text-muted-foreground ml-2">RTN: {s.rtn}</span>}
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre del Proveedor *</Label>
                    <Input
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="Nombre del proveedor"
                    />
                  </div>
                  <div className="space-y-2 relative">
                    <Label>RTN</Label>
                    <Input
                      value={supplierRtn}
                      onChange={(e) => setSupplierRtn(e.target.value)}
                      placeholder="RTN del proveedor"
                    />
                    {supplierRtnSuggestions.length > 0 && (
                      <Card className="absolute z-10 w-full mt-1 shadow-lg">
                        <CardContent className="p-1 max-h-32 overflow-y-auto">
                          {supplierRtnSuggestions.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className="w-full text-left p-2 rounded hover:bg-muted text-sm"
                              onClick={() => {
                                setSelectedSupplierId(s.id);
                                setSupplierName(s.name);
                                setSupplierRtn(s.rtn || "");
                                setSupplierAddress(s.address || "");
                                setSupplierPhone(s.phone || "");
                                setSupplierRtnSuggestions([]);
                              }}
                            >
                              <span className="font-mono text-xs">{s.rtn}</span>
                              <span className="ml-2">{s.name}</span>
                            </button>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección</Label>
                    <Input
                      value={supplierAddress}
                      onChange={(e) => setSupplierAddress(e.target.value)}
                      placeholder="Dirección del proveedor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={supplierPhone}
                      onChange={(e) => setSupplierPhone(e.target.value)}
                      placeholder="Teléfono del proveedor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Documento</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={purchaseType === "comprobante" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setPurchaseType("comprobante")}
                      >
                        Comprobante Simple
                      </Button>
                      <Button
                        type="button"
                        variant={purchaseType === "factura" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setPurchaseType("factura")}
                      >
                        Factura con CAI
                      </Button>
                    </div>
                  </div>
                  {purchaseType === "factura" && (
                    <div className="space-y-2">
                      <Label>CAI del Proveedor</Label>
                      <Input
                        value={supplierCai}
                        onChange={(e) => setSupplierCai(e.target.value)}
                        placeholder="Ingrese el CAI del proveedor"
                        className="font-mono"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Factura del Proveedor</Label>
                    <Input
                      value={supplierInvoice}
                      onChange={(e) => setSupplierInvoice(e.target.value)}
                      placeholder="Número de factura del proveedor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Foto de Factura</Label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("photo-input")?.click()}
                      >
                        <ImagePlus className="mr-2 h-4 w-4" />
                        {supplierInvoicePhoto ? "Cambiar foto" : "Adjuntar foto"}
                      </Button>
                      <input
                        id="photo-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              setSupplierInvoicePhoto(ev.target?.result as string || "");
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      {supplierInvoicePhoto && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setSupplierInvoicePhoto("")}
                        >
                          Quitar
                        </Button>
                      )}
                    </div>
                    {supplierInvoicePhoto && (
                      <img
                        src={supplierInvoicePhoto}
                        alt="Vista previa"
                        className="max-w-[200px] h-auto rounded border mt-1"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Productos Recibidos</CardTitle>
                  <CardDescription>Ingrese los productos de esta compra</CardDescription>
                </div>
                <Button variant="outline" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Producto
                </Button>
              </CardHeader>
              <CardContent>
                {purchaseItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay productos en esta compra</p>
                    <Button variant="outline" className="mt-4" onClick={addItem}>
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar Producto
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {purchaseItems.map((item, idx) => (
                      <div key={item.key} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">Producto #{idx + 1}</Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.key)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                          <div className="space-y-1 relative">
                            <Label className="text-xs flex items-center gap-1">
                              <Barcode className="h-3 w-3" />
                              Código Barras
                            </Label>
                            <Input
                              value={item.barcode}
                              onChange={(e) => searchBarcode(item.key, e.target.value)}
                              placeholder="Escanear o escribir"
                              className="font-mono"
                            />
                            {barcodeSuggestions[item.key]?.length > 0 && (
                              <Card className="absolute z-10 w-full mt-1 shadow-lg">
                                <CardContent className="p-1 max-h-40 overflow-y-auto">
                                  {barcodeSuggestions[item.key].map((p: any) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      className="w-full text-left p-2 rounded hover:bg-muted text-sm"
                                      onClick={() => selectProductSuggestion(item.key, p)}
                                    >
                                      <span className="font-mono text-xs">{p.barcode}</span>
                                      <span className="ml-2 font-medium">{p.name}</span>
                                      {p.stock !== undefined && <span className="text-muted-foreground ml-2 text-xs">Stock: {p.stock}</span>}
                                    </button>
                                  ))}
                                </CardContent>
                              </Card>
                            )}
                          </div>
                          <div className="space-y-1 relative">
                            <Label className="text-xs">Nombre del Producto *</Label>
                            <Input
                              value={item.productName}
                              onChange={(e) => searchProductName(item.key, e.target.value)}
                              placeholder="Escribir o buscar producto existente"
                            />
                            {productSuggestions[item.key]?.length > 0 && (
                              <Card className="absolute z-10 w-full mt-1 shadow-lg">
                                <CardContent className="p-1 max-h-40 overflow-y-auto">
                                  {productSuggestions[item.key].map((p: any) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      className="w-full text-left p-2 rounded hover:bg-muted text-sm"
                                      onClick={() => selectProductSuggestion(item.key, p)}
                                    >
                                      <span className="font-medium">{p.name}</span>
                                      {p.barcode && <span className="text-muted-foreground ml-2 font-mono text-xs">{p.barcode}</span>}
                                      {p.stock !== undefined && <span className="text-muted-foreground ml-2 text-xs">Stock: {p.stock}</span>}
                                    </button>
                                  ))}
                                </CardContent>
                              </Card>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Cantidad *</Label>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.quantity || ""}
                              onChange={(e) => updateItem(item.key, "quantity", parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Unidad</Label>
                            <Select
                              value={item.unit}
                              onValueChange={(v) => updateItem(item.key, "unit", v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UNITS.map((u) => (
                                  <SelectItem key={u} value={u}>{u}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Precio de Compra *</Label>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.purchasePrice || ""}
                              onChange={(e) => updateItem(item.key, "purchasePrice", parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              Fecha Vencimiento
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Fecha de vencimiento del producto (opcional)
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <Input
                              type="date"
                              value={item.expiryDate}
                              onChange={(e) => updateItem(item.key, "expiryDate", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground text-right">
                          Subtotal: {formatCurrency(item.quantity * item.purchasePrice)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Total & Notes */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Notas (opcional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas adicionales sobre la compra..."
                    rows={2}
                  />
                </div>
                {editingPurchase && (
                  <div className="space-y-2">
                    <Label className="text-amber-600 dark:text-amber-400 font-semibold">
                      Motivo de edición *
                    </Label>
                    <Textarea
                      value={editReason}
                      onChange={(e) => { setEditReason(e.target.value); setEditConfirm(false); }}
                      placeholder="Describa el motivo de la edición (mín. 5 caracteres)..."
                      rows={2}
                      className="border-amber-300 dark:border-amber-700"
                    />
                    {editConfirm && (
                      <div className="p-3 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/20">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Doble confirmación requerida</p>
                            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                              Esta edición modificará los datos de la compra. Los cambios en productos afectarán el stock. Presione "Guardar Cambios" nuevamente para confirmar.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {purchaseItems.length} producto{purchaseItems.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total de Compra</p>
                    <p className="text-2xl font-bold">{formatCurrency(subtotal)}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { resetForm(); setTab("list"); }}>
                    {editingPurchase ? "Cancelar edición" : "Cancelar"}
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingPurchase ? "Guardar Cambios" : "Guardar Compra"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <PurchasePreview
        purchase={previewPurchase}
        open={!!previewPurchase}
        onClose={() => setPreviewPurchase(null)}
      />

      {/* Delete Purchase Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Eliminar Compra
            </DialogTitle>
            <DialogDescription>
              Seleccione el tipo de eliminación. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {deletingPurchase && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium">{deletingPurchase.supplierName}</p>
                <p className="text-sm text-muted-foreground">
                  Total: {formatCurrency(deletingPurchase.total)} | {formatDate(deletingPurchase.createdAt)}
                </p>
              </div>
              {!deleteConfirm ? (
                <div className="space-y-2">
                  <Button variant="destructive" className="w-full" onClick={() => { setDeleteKeepStock(false); setDeleteConfirm(true); }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar compra y revertir stock
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => { setDeleteKeepStock(true); setDeleteConfirm(true); }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar compra pero mantener stock
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-destructive font-medium">¿Está completamente seguro?</p>
                  <p className="text-xs text-muted-foreground">
                    {deleteKeepStock
                      ? "Se eliminará el registro de compra pero los productos permanecerán en inventario."
                      : "Se eliminará la compra y se restará del stock de cada producto."}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setDeleteDialog(false); setDeletingPurchase(null); setDeleteConfirm(false); }}>
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/purchases/${deletingPurchase.id}?keepStock=${deleteKeepStock}`, { method: "DELETE" });
                          if (res.ok) {
                            mutate("/api/purchases");
                            mutate((key) => typeof key === "string" && key.startsWith("/api/products"));
                            setDeleteDialog(false);
                            setDeletingPurchase(null);
                            setDeleteConfirm(false);
                            toast.success(deleteKeepStock ? "Compra eliminada, stock conservado" : "Compra eliminada y stock revertido");
                          } else {
                            const err = await res.json();
                            toast.error(err.error || "Error al eliminar compra");
                          }
                        } catch {
                          toast.error("Error de conexión");
                        }
                      }}
                    >
                      Confirmar Eliminación
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
