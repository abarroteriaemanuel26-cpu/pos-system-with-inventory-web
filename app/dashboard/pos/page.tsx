"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCurrency, roundToTwo, validateRTN, formatRTN } from "@/lib/utils/format";
import { OpenRegisterDialog, CloseRegisterDialog } from "@/components/pos/register-dialog";
import { InvoicePreview } from "@/components/pos/invoice-preview";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Loader2,
  CreditCard,
  Banknote,
  Building2,
  AlertCircle,
  Barcode,
  HelpCircle,
  Printer,
  DollarSign,
  CheckCircle2,
  XCircle,
  Grid3X3,
  Package,
  Eye,
  ChevronDown,
} from "lucide-react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al obtener datos");
  }
  return res.json();
};

type Product = {
  id: number;
  barcode: string | null;
  name: string;
  salePrice: number;
  stock: number;
  unit: string;
  taxRate: number | null;
  image: string | null;
};

type CartItem = {
  productId: number;
  productCode: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  taxRate: number;
  stock: number;
  unit: string;
};

type InvoiceResult = {
  id: number;
  invoiceNumber: string;
  total: number;
  customerName: string;
  cai: string;
  businessName: string;
};

export default function POSPage() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerRtn, setCustomerRtn] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<{ rtn: string; name: string }[]>([]);
  const [invoiceType, setInvoiceType] = useState<"factura" | "comprobante">("comprobante");
  const [simpleMode, setSimpleMode] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [cashReceived, setCashReceived] = useState("");
  const [productsCollapsed, setProductsCollapsed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<InvoiceResult | null>(null);
  const [error, setError] = useState("");
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeBuffer = useRef("");
  const barcodeTimeout = useRef<NodeJS.Timeout | null>(null);

  const { data: products } = useSWR<Product[]>(
    search
      ? `/api/products?search=${encodeURIComponent(search)}&limit=50`
      : "/api/products?limit=200",
    fetcher
  );

  const { data: currentUser } = useSWR("/api/me", fetcher);

  const { data: registers, mutate: mutateRegisters } = useSWR("/api/cash-registers", fetcher);
  const activeRegister = Array.isArray(registers)
    ? registers.find((r: { status: string }) => r.status === "abierta")
    : null;

  const [openRegisterDialog, setOpenRegisterDialog] = useState(false);
  const [closeRegisterDialog, setCloseRegisterDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<InvoiceResult | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Barcode scanner detection - rapid keystrokes indicate scanner
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if we're in an input that's not the search
      const activeElement = document.activeElement;
      if (activeElement && activeElement !== searchInputRef.current) {
        const tagName = (activeElement as HTMLElement).tagName;
        if (tagName === "INPUT" || tagName === "TEXTAREA") return;
      }

      if (e.key === "Enter" && barcodeBuffer.current.length > 3) {
        // Barcode complete, search for product
        handleBarcodeSearch(barcodeBuffer.current);
        barcodeBuffer.current = "";
        return;
      }

      // Only accept alphanumeric characters for barcode
      if (/^[a-zA-Z0-9]$/.test(e.key)) {
        barcodeBuffer.current += e.key;
        
        // Clear buffer after 100ms of no input (human typing is slower)
        if (barcodeTimeout.current) {
          clearTimeout(barcodeTimeout.current);
        }
        barcodeTimeout.current = setTimeout(() => {
          barcodeBuffer.current = "";
        }, 100);
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, []);

  // Search customer by RTN
  const rtnTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (rtnTimeout.current) clearTimeout(rtnTimeout.current);
    if (customerRtn.length < 3) {
      setCustomerSuggestions([]);
      return;
    }
    rtnTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/search?rtn=${encodeURIComponent(customerRtn)}`);
        if (res.ok) {
          const data = await res.json();
          setCustomerSuggestions(data);
        }
      } catch {}
    }, 300);
  }, [customerRtn]);

  const handleBarcodeSearch = useCallback(async (barcode: string) => {
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(barcode)}`);
      const results = await response.json();
      
      if (results.length === 1) {
        addToCart(results[0]);
      } else if (results.length > 1) {
        // Multiple matches - show in search
        setSearch(barcode);
        searchInputRef.current?.focus();
      } else {
        // No match
        setError(`Producto no encontrado: ${barcode}`);
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      console.error("Barcode search error:", err);
    }
  }, []);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error(`Stock insuficiente. Disponible: ${product.stock}`);
          return prev;
        }
        toast.success(`${product.name} x${existing.quantity + 1}`);
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      toast.success(`${product.name} agregado`);
      return [
        ...prev,
        {
          productId: product.id,
          productCode: product.barcode || "PROD-" + product.id,
          productName: product.name,
          unitPrice: product.salePrice,
          quantity: 1,
          taxRate: product.taxRate ?? 15,
          stock: product.stock,
          unit: product.unit,
        },
      ];
    });
    setSearch("");
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.stock) {
              toast.error(`Stock insuficiente. Disponible: ${item.stock}`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName("");
    setCustomerRtn("");
    setInvoiceType("comprobante");
    setPaymentMethod("efectivo");
    setCashReceived("");
  };

  // Calculate totals
  const totals = cart.reduce(
    (acc, item) => {
      const subtotal = item.quantity * item.unitPrice;
      const tax = subtotal * (item.taxRate / 100);
      return {
        subtotal: acc.subtotal + subtotal,
        tax: acc.tax + tax,
        total: acc.total + subtotal + tax,
        items: acc.items + item.quantity,
      };
    },
    { subtotal: 0, tax: 0, total: 0, items: 0 }
  );

  const change =
    paymentMethod === "efectivo" && cashReceived
      ? parseFloat(cashReceived) - totals.total
      : 0;

  const canProcess =
    cart.length > 0 &&
    (paymentMethod !== "efectivo" || parseFloat(cashReceived || "0") >= totals.total) &&
    (currentUser?.role !== "cajero" || activeRegister);

  const processInvoice = async () => {
    if (!canProcess) return;
    
    // Validate RTN only for factura type
    if (invoiceType === "factura") {
      if (!customerRtn || !validateRTN(customerRtn)) {
        toast.error("Para factura con CAI debe ingresar un RTN válido de 14 dígitos");
        return;
      }
    } else {
      if (customerRtn && !validateRTN(customerRtn)) {
        toast.error("El RTN debe tener 14 dígitos");
        return;
      }
    }

    setProcessing(true);
    setError("");

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          type: invoiceType,
          customerName: customerName || "Consumidor Final",
          customerRtn: customerRtn || null,
          paymentMethod,
          cashReceived: paymentMethod === "efectivo" ? parseFloat(cashReceived) : null,
          changeAmount: paymentMethod === "efectivo" ? change : null,
        }),
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch {}

      if (!response.ok) {
        toast.error(data?.error || "Error al procesar la factura");
        setProcessing(false);
        return;
      }

      setLastInvoice(data);
      setPreviewData(data);
      setShowPreview(true);
      clearCart();
      if (data.type === "factura") {
        toast.success(`Factura #${data.invoiceNumber} creada`);
      } else {
        toast.success(`Comprobante #${data.receiptNumber} creado`);
      }
      
      // Refresh products to update stock
      mutate((key) => typeof key === "string" && key.startsWith("/api/products"));
    } catch (err) {
      toast.error("Error de conexión. Intente nuevamente.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-1px)] flex flex-col lg:flex-row">
        {/* Left Panel - Product Search and Cart */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Products Section - Collapsible */}
          <Collapsible
            open={!productsCollapsed}
            onOpenChange={(open) => setProductsCollapsed(!open)}
            className="shrink-0"
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4 shrink-0" />
                    <span>Productos</span>
                    <ChevronDown className="h-4 w-4 ml-auto transition-transform" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Buscar producto por nombre, código o escanear código de barras..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 pr-9"
                      autoFocus
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Escanee un código de barras o escriba para buscar
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Search Results */}
                  {search && products && products.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border rounded-lg">
                      {products.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => addToCart(product)}
                          className="w-full flex items-center justify-between p-2 rounded hover:bg-muted text-left"
                          disabled={product.stock === 0}
                        >
                          <div>
                            <span className="font-medium">{product.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {product.barcode ? `(${product.barcode})` : ""}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">{formatCurrency(product.salePrice)}</span>
                            <span className={`block text-xs ${product.stock === 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              Stock: {product.stock}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Product Grid */}
                  {!search && products && products.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-52 overflow-y-auto">
                      {products.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => addToCart(product)}
                          disabled={product.stock === 0}
                          className={`p-2 rounded-lg border text-left transition-colors ${
                            product.stock === 0
                              ? "opacity-50 cursor-not-allowed border-destructive/30 bg-destructive/5"
                              : "hover:bg-muted border-border"
                          }`}
                        >
                          {product.image ? (
                            <div className="w-full h-14 mb-1 rounded overflow-hidden bg-muted relative group">
                              <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(product.image); }}
                                className="absolute top-0.5 right-0.5 p-1 rounded bg-black/40 hover:bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Eye className="h-3 w-3 text-white" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-full h-14 mb-1 rounded bg-muted flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                          )}
                          <p className="text-xs font-medium leading-tight line-clamp-2">{product.name}</p>
                          <p className="text-sm font-bold mt-1">{formatCurrency(product.salePrice)}</p>
                          <p className={`text-xs mt-0.5 ${product.stock === 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {product.stock === 0 ? "Sin stock" : `Stock: ${product.stock} ${product.unit}`}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {!search && products && products.length === 0 && (
                    <div className="text-center py-3 text-muted-foreground">
                      <Package className="h-6 w-6 mx-auto mb-1 opacity-50" />
                      <p className="text-sm">No hay productos disponibles</p>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Cart Table - always visible */}
          <Card className="flex-1 flex flex-col overflow-hidden mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="h-5 w-5 shrink-0" />
                <span>Carrito</span>
                {cart.length > 0 && (
                  <Badge variant="secondary">{totals.items} productos</Badge>
                )}
                {cart.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-auto">
                    Total: {formatCurrency(totals.total)}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
                  <p>El carrito está vacío</p>
                  <p className="text-sm">Seleccione productos desde arriba</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-center w-[130px]">Cantidad</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <span className="font-medium">{item.productName}</span>
                          <span className="block text-xs text-muted-foreground">
                            {item.productCode} | ISV {item.taxRate}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.productId, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.productId, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.quantity * item.unitPrice)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeFromCart(item.productId)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Payment */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l bg-card p-4 flex flex-col">
          {/* Current Date */}
          <div className="mb-2 p-2 rounded-lg border bg-muted/30 text-center text-sm">
            <span className="text-muted-foreground">Fecha:</span>{' '}
            <span className="font-medium">
              {new Intl.DateTimeFormat("es-HN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }).format(new Date())}
            </span>
          </div>

          {/* Register Status */}
          <div className={`mb-4 p-3 rounded-lg border ${activeRegister ? "bg-green-500/5 border-green-500/30" : "bg-amber-500/5 border-amber-500/30"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                {activeRegister ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-600" />
                )}
                <span className={activeRegister ? "text-green-700" : "text-amber-700"}>
                  {activeRegister ? "Caja abierta" : "Caja cerrada"}
                </span>
              </div>
              {activeRegister ? (
                currentUser?.role === "admin" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCloseRegisterDialog(true)}>
                    Cerrar
                  </Button>
                )
              ) : currentUser?.role === "admin" ? (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpenRegisterDialog(true)}>
                  <DollarSign className="h-3 w-3 mr-1" />
                  Abrir
                </Button>
              ) : null}
            </div>
            {activeRegister && (
              <p className="text-xs text-muted-foreground mt-1">
                Monto apertura: {formatCurrency(activeRegister.openingAmount || 0)}
              </p>
            )}
          </div>

          {currentUser && currentUser.role === "cajero" && !activeRegister && (
            <div className="mb-4 p-3 rounded-lg border bg-destructive/10 border-destructive/30 text-destructive text-sm text-center">
              <AlertCircle className="h-4 w-4 mx-auto mb-1" />
              <p className="font-medium">No hay caja abierta</p>
              <p className="text-xs mt-1">Solicite a un administrador que abra una caja</p>
            </div>
          )}

          <h2 className="font-semibold text-lg mb-4">Datos del Cliente</h2>

          <div className="space-y-4 flex-1">
            {/* Invoice Type Toggle */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={invoiceType === "comprobante" ? "default" : "outline"}
                  className="flex flex-col h-auto py-2"
                  onClick={() => setInvoiceType("comprobante")}
                >
                  <span className="text-xs font-normal">Comprobante</span>
                  <span className="text-[10px] opacity-70">Simple</span>
                </Button>
                <Button
                  type="button"
                  variant={invoiceType === "factura" ? "default" : "outline"}
                  className="flex flex-col h-auto py-2"
                  onClick={() => setInvoiceType("factura")}
                >
                  <span className="text-xs font-normal">Factura</span>
                  <span className="text-[10px] opacity-70">Con CAI</span>
                </Button>
              </div>
            </div>

            {/* Customer Info */}
            <div className="space-y-2">
              <Label htmlFor="customerName">Cliente</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Consumidor Final"
              />
            </div>

            {invoiceType === "factura" && (
              <div className="space-y-2 relative">
                <Label htmlFor="customerRtn" className="flex items-center gap-1">
                  RTN <span className="text-destructive">*</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Registro Tributario Nacional del cliente (14 dígitos)
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="customerRtn"
                  value={customerRtn}
                  onChange={(e) => setCustomerRtn(e.target.value.replace(/\D/g, ""))}
                  placeholder="14 dígitos"
                  maxLength={14}
                  className="font-mono"
                />
                {customerRtn && customerRtn.length === 14 && (
                  <p className="text-xs text-muted-foreground">
                    {formatRTN(customerRtn)}
                  </p>
                )}
                {customerSuggestions.length > 0 && (
                  <Card className="absolute z-10 w-full mt-1 shadow-lg">
                    <CardContent className="p-1 max-h-32 overflow-y-auto">
                      {customerSuggestions.map((s) => (
                        <button
                          key={s.rtn}
                          type="button"
                          className="w-full text-left p-2 rounded hover:bg-muted text-sm"
                          onClick={() => {
                            setCustomerRtn(s.rtn);
                            setCustomerName(s.name);
                            setCustomerSuggestions([]);
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
            )}

            <Separator />

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === "efectivo" ? "default" : "outline"}
                  className="flex flex-col h-auto py-3"
                  onClick={() => setPaymentMethod("efectivo")}
                >
                  <Banknote className="h-5 w-5 mb-1" />
                  <span className="text-xs">Efectivo</span>
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "tarjeta" ? "default" : "outline"}
                  className="flex flex-col h-auto py-3"
                  onClick={() => setPaymentMethod("tarjeta")}
                >
                  <CreditCard className="h-5 w-5 mb-1" />
                  <span className="text-xs">Tarjeta</span>
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "transferencia" ? "default" : "outline"}
                  className="flex flex-col h-auto py-3"
                  onClick={() => setPaymentMethod("transferencia")}
                >
                  <Building2 className="h-5 w-5 mb-1" />
                  <span className="text-xs">Transfer.</span>
                </Button>
              </div>
            </div>

            {/* Cash Received */}
            {paymentMethod === "efectivo" && (
              <div className="space-y-2">
                <Label htmlFor="cashReceived">Efectivo Recibido</Label>
                <Input
                  id="cashReceived"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0.00"
                  className="text-lg font-mono"
                />
                {change > 0 && (
                  <div className="p-2 bg-green-500/10 rounded text-green-700 text-center">
                    <span className="text-sm">Cambio: </span>
                    <span className="font-bold text-lg">{formatCurrency(change)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Switch id="simple-mode" checked={simpleMode} onCheckedChange={setSimpleMode} />
              <Label htmlFor="simple-mode" className="text-xs cursor-pointer">Ocultar impuestos</Label>
            </div>
          </div>
          <Separator />

          {/* Totals */}
          <div className="space-y-2 pt-2">
            {!simpleMode && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ISV (15%)</span>
                  <span>{formatCurrency(totals.tax)}</span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 space-y-2">
            <Button
              className="w-full h-12 text-lg"
              disabled={!canProcess || processing}
              onClick={processInvoice}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-5 w-5" />
                  {invoiceType === "factura" ? "Facturar" : "Generar Comprobante"}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={clearCart}
              disabled={cart.length === 0}
            >
              Limpiar Carrito
            </Button>
          </div>
        </div>

        {/* Invoice Preview Dialog */}
        {previewData && (
          <InvoicePreview
            invoiceId={previewData.id}
            open={showPreview}
            onOpenChange={setShowPreview}
            simpleMode={simpleMode}
          />
        )}

        {/* Image Preview Dialog */}
        <Dialog open={!!previewImageUrl} onOpenChange={(o) => { if (!o) setPreviewImageUrl(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Foto del Producto</DialogTitle>
            </DialogHeader>
            {previewImageUrl && (
              <div className="flex justify-center">
                <img src={previewImageUrl} alt="Producto" className="max-w-full h-auto rounded border" />
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setPreviewImageUrl(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Register Dialogs */}
        <OpenRegisterDialog
          open={openRegisterDialog}
          onOpenChange={setOpenRegisterDialog}
          onRegisterChange={() => mutateRegisters()}
          userId={currentUser?.id || 0}
        />
        <CloseRegisterDialog
          open={closeRegisterDialog}
          onOpenChange={setCloseRegisterDialog}
          register={activeRegister}
          onRegisterChange={() => mutateRegisters()}
        />
      </div>
    </TooltipProvider>
  );
}
