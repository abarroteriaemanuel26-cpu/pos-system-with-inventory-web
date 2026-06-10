"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatCurrency } from "@/lib/utils/format";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Package,
  AlertTriangle,
  HelpCircle,
  Eye,
} from "lucide-react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al obtener datos");
  }
  return res.json();
};

type Category = {
  id: number;
  name: string;
  taxRate: number;
  active: number;
};

type Product = {
  id: number;
  barcode: string | null;
  name: string;
  description: string | null;
  image: string | null;
  categoryId: number | null;
  categoryName: string | null;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  unit: string;
  taxRate: number | null;
};

const emptyForm = {
  barcode: "",
  name: "",
  description: "",
  image: "",
  categoryId: "",
  purchasePrice: "0",
  salePrice: "",
  stock: "0",
  minStock: "5",
  unit: "unidad",
};

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (categoryFilter && categoryFilter !== "all") queryParams.set("category", categoryFilter);
  
  const { data: products, isLoading } = useSWR<Product[]>(
    `/api/products?${queryParams.toString()}`,
    fetcher
  );
  const { data: categories } = useSWR<Category[]>("/api/categories", fetcher);
  const { data: currentUser } = useSWR("/api/me", fetcher);
  const isAdmin = currentUser?.role === "admin";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const openNewDialog = () => {
    setEditingProduct(null);
    setFormData({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      barcode: product.barcode || "",
      name: product.name,
      description: product.description || "",
      image: product.image || "",
      categoryId: product.categoryId?.toString() || "",
      purchasePrice: product.purchasePrice.toString(),
      salePrice: product.salePrice.toString(),
      stock: product.stock.toString(),
      minStock: product.minStock.toString(),
      unit: product.unit,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const method = editingProduct ? "PUT" : "POST";
      const body = {
        barcode: formData.barcode || null,
        name: formData.name,
        description: formData.description || null,
        image: formData.image || null,
        categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
        purchasePrice: parseFloat(formData.purchasePrice) || 0,
        salePrice: parseFloat(formData.salePrice),
        stock: parseInt(formData.stock) || 0,
        minStock: parseInt(formData.minStock) || 5,
        unit: formData.unit,
        ...(editingProduct && { id: editingProduct.id }),
      };

      const response = await fetch("/api/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        mutate(`/api/products?${queryParams.toString()}`);
        setDialogOpen(false);
      } else {
        const error = await response.json();
        alert(error.error || "Error al guardar producto");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar este producto?")) return;

    await fetch(`/api/products?id=${id}`, { method: "DELETE" });
    mutate(`/api/products?${queryParams.toString()}`);
  };

  const compressImage = (file: File, maxW = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("No canvas context")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Error al cargar imagen"));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleBarcodeLookup = async () => {
    const bc = formData.barcode.trim();
    if (!bc) return;
    setBarcodeLoading(true);
    try {
      const res = await fetch(`/api/products?barcode=${encodeURIComponent(bc)}`);
      if (!res.ok) return;
      const prods = await res.json();
      if (prods.length > 0) {
        const p = prods[0];
        setFormData({
          ...formData,
          name: p.name,
          categoryId: p.categoryId?.toString() || "",
          unit: p.unit,
          purchasePrice: p.purchasePrice.toString(),
          salePrice: p.salePrice.toString(),
          image: p.image || "",
        });
      }
    } finally {
      setBarcodeLoading(false);
    }
  };

  const activeCategories = categories?.filter((c) => c.active !== 0) || [];
  const lowStockProducts = products?.filter((p) => p.stock <= p.minStock) || [];

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6" />
              Productos
            </h1>
            <p className="text-muted-foreground">Gestiona el inventario de tu bodega</p>
          </div>
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={openNewDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Producto
                </Button>
              </TooltipTrigger>
              <TooltipContent>Agregar un nuevo producto al inventario</TooltipContent>
            </Tooltip>
          )}
        </div>

        {lowStockProducts.length > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-600 flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                Productos con Stock Bajo ({lowStockProducts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {lowStockProducts.slice(0, 3).map((p) => p.name).join(", ")}
                {lowStockProducts.length > 3 && ` y ${lowStockProducts.length - 3} más...`}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, código o código de barras..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {activeCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !products || products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay productos registrados</p>
                <Button variant="link" onClick={openNewDialog}>
                  Agregar primer producto
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          Stock
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Se muestra alerta cuando el stock está por debajo del mínimo
                            </TooltipContent>
                          </Tooltip>
                        </span>
                      </TableHead>
                      <TableHead className="w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <span className="font-medium">{product.name}</span>
                          {product.description && (
                            <span className="block text-xs text-muted-foreground truncate max-w-[200px]">
                              {product.description}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {product.categoryName ? (
                            <Badge variant="secondary">{product.categoryName}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.salePrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              product.stock <= product.minStock
                                ? "text-amber-600 font-medium"
                                : ""
                            }
                          >
                            {product.stock}
                          </span>
                          <span className="text-muted-foreground text-xs ml-1">
                            {product.unit}
                          </span>
                          {product.stock <= product.minStock && (
                            <AlertTriangle className="inline-block ml-1 h-3.5 w-3.5 text-amber-500" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {product.image && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setPreviewImage(product.image)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver foto</TooltipContent>
                              </Tooltip>
                            )}
                            {isAdmin ? (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEditDialog(product)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar producto</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => handleDelete(product.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Eliminar producto</TooltipContent>
                                </Tooltip>
                              </>
                            ) : !product.image ? (
                              <span className="text-xs text-muted-foreground">-</span>
                            ) : null}
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Editar Producto" : "Nuevo Producto"}
              </DialogTitle>
              <DialogDescription>
                {editingProduct
                  ? "Modifica los datos del producto"
                  : "Ingresa los datos del nuevo producto"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="barcode" className="flex items-center gap-1">
                  Código de Barras
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      Escanea con el lector de códigos de barras o se auto-genera si se deja vacío
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      onBlur={handleBarcodeLookup}
                      placeholder="Auto-generado si se deja vacío"
                    />
                    {barcodeLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBarcodeLookup}
                    disabled={barcodeLoading || !formData.barcode.trim()}
                  >
                    {barcodeLoading ? (
                      <Loader2 className="h-4 w-4" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre del producto"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción opcional"
                />
              </div>

              <div className="space-y-2">
                <Label>Foto del Producto</Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("product-image-input")?.click()}
                  >
                    {formData.image ? "Cambiar foto" : "Subir foto"}
                  </Button>
                  <input
                    id="product-image-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const compressed = await compressImage(file);
                        setFormData({ ...formData, image: compressed });
                      } catch {
                        // Fallback to uncompressed
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setFormData({ ...formData, image: ev.target?.result as string || "" });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {formData.image && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setFormData({ ...formData, image: "" })}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
                {formData.image && (
                  <div className="mt-1">
                    <img
                      src={formData.image}
                      alt="Vista previa"
                      className="max-w-[120px] h-auto rounded border cursor-pointer"
                      onClick={() => setPreviewImage(formData.image)}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Categoría</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name} ({cat.taxRate}% ISV)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unidad</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData({ ...formData, unit: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unidad">Unidad</SelectItem>
                      <SelectItem value="libra">Libra (lb)</SelectItem>
                      <SelectItem value="onza">Onza (oz)</SelectItem>
                      <SelectItem value="kilo">Kilogramo (kg)</SelectItem>
                      <SelectItem value="gramo">Gramo (g)</SelectItem>
                      <SelectItem value="ristra">Ristra</SelectItem>
                      <SelectItem value="bolsa">Bolsa</SelectItem>
                      <SelectItem value="paquete">Paquete</SelectItem>
                      <SelectItem value="litro">Litro (L)</SelectItem>
                      <SelectItem value="galon">Galón (gal)</SelectItem>
                      <SelectItem value="botella">Botella</SelectItem>
                      <SelectItem value="lata">Lata</SelectItem>
                      <SelectItem value="caja">Caja</SelectItem>
                      <SelectItem value="docena">Docena</SelectItem>
                      <SelectItem value="pieza">Pieza</SelectItem>
                      <SelectItem value="rollo">Rollo</SelectItem>
                      <SelectItem value="par">Par</SelectItem>
                      <SelectItem value="metro">Metro (m)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchasePrice">Precio de Compra (L.)</Label>
                  <Input
                    id="purchasePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salePrice">Precio de Venta (L.) *</Label>
                  <Input
                    id="salePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock Actual</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minStock" className="flex items-center gap-1">
                    Stock Mínimo
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Se mostrará una alerta cuando el stock esté por debajo de este valor
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="minStock"
                    type="number"
                    min="0"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingProduct ? "Guardar Cambios" : "Crear Producto"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Image Preview Dialog */}
        <Dialog open={!!previewImage} onOpenChange={(o) => { if (!o) setPreviewImage(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Foto del Producto</DialogTitle>
            </DialogHeader>
            {previewImage && (
              <div className="flex justify-center">
                <img
                  src={previewImage}
                  alt="Producto"
                  className="max-w-full h-auto rounded border"
                />
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setPreviewImage(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
