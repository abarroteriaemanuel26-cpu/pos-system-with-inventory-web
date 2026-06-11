"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatDate, formatRTN, formatInvoiceNumber } from "@/lib/utils/format";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Receipt,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al obtener datos");
  }
  return res.json();
};

type CaiConfig = {
  id: number;
  cai: string;
  rtn: string;
  businessName: string;
  businessAddress: string | null;
  phone: string | null;
  rangeStart: number;
  rangeEnd: number;
  currentNumber: number;
  prefix: string;
  expiryDate: string;
  active: number;
  createdAt: string;
};

const emptyForm = {
  cai: "",
  rtn: "",
  businessName: "",
  businessAddress: "",
  phone: "",
  rangeStart: "",
  rangeEnd: "",
  prefix: "000-001-01",
  expiryDate: "",
};

export default function CaiPage() {
  const { data: configs, isLoading } = useSWR<CaiConfig[]>("/api/cai", fetcher);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<CaiConfig | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const openNewDialog = () => {
    setEditingConfig(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (config: CaiConfig) => {
    setEditingConfig(config);
    setFormData({
      cai: config.cai,
      rtn: config.rtn,
      businessName: config.businessName,
      businessAddress: config.businessAddress || "",
      phone: config.phone || "",
      rangeStart: config.rangeStart.toString(),
      rangeEnd: config.rangeEnd.toString(),
      prefix: config.prefix,
      expiryDate: config.expiryDate.split("T")[0],
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const method = editingConfig ? "PUT" : "POST";
      const body = {
        ...formData,
        rangeStart: parseInt(formData.rangeStart),
        rangeEnd: parseInt(formData.rangeEnd),
        ...(editingConfig && { id: editingConfig.id, active: editingConfig.active }),
      };

      const response = await fetch("/api/cai", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        mutate("/api/cai");
        setDialogOpen(false);
      } else {
        const error = await response.json();
        alert(error.error || "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteCai = async (id: number) => {
    const response = await fetch(`/api/cai?id=${id}`, { method: "DELETE" });
    if (response.ok) {
      mutate("/api/cai");
      setDeleteConfirm(null);
    } else {
      const err = await response.json();
      alert(err.error || "Error al eliminar CAI");
    }
  };

  const setAsActive = async (config: CaiConfig) => {
    await fetch("/api/cai", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, active: 1 }),
    });
    mutate("/api/cai");
  };

  const activeConfig = configs?.find((c) => c.active === 1);
  const isExpiringSoon = activeConfig && new Date(activeConfig.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const isRangeRunningOut = activeConfig && (activeConfig.rangeEnd - activeConfig.currentNumber) <= 100;

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6" />
              Configuración CAI
            </h1>
            <p className="text-muted-foreground">
              Administra tus Códigos de Autorización de Impresión para facturación fiscal
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo CAI
              </Button>
            </TooltipTrigger>
            <TooltipContent>Registrar un nuevo CAI autorizado por la SAR</TooltipContent>
          </Tooltip>
        </div>

        {activeConfig && (isExpiringSoon || isRangeRunningOut) && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-600 flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                Alertas del CAI Activo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {isExpiringSoon && (
                <p>El CAI vence el {formatDate(activeConfig.expiryDate)}. Solicite uno nuevo a la SAR.</p>
              )}
              {isRangeRunningOut && (
                <p>Quedan solo {activeConfig.rangeEnd - activeConfig.currentNumber} facturas disponibles en el rango actual.</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeConfig && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                CAI Activo
              </CardTitle>
              <CardDescription>Configuración fiscal actualmente en uso</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">CAI</p>
                  <p className="font-mono text-sm break-all">{activeConfig.cai}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">RTN</p>
                  <p className="font-mono">{formatRTN(activeConfig.rtn)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Razón Social</p>
                  <p>{activeConfig.businessName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rango Autorizado</p>
                  <p className="font-mono text-sm">
                    {formatInvoiceNumber(activeConfig.prefix, activeConfig.rangeStart)} al{" "}
                    {formatInvoiceNumber(activeConfig.prefix, activeConfig.rangeEnd)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Próxima Factura</p>
                  <p className="font-mono text-sm font-medium">
                    {formatInvoiceNumber(activeConfig.prefix, activeConfig.currentNumber)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha Límite de Emisión</p>
                  <p className={isExpiringSoon ? "text-amber-600 font-medium" : ""}>
                    {formatDate(activeConfig.expiryDate)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Historial de CAI</CardTitle>
            <CardDescription>Todos los CAI registrados en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !configs || configs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay CAI registrados</p>
                <p className="text-sm mt-2">
                  Debe registrar un CAI autorizado por la SAR para poder emitir facturas fiscales.
                </p>
                <Button variant="link" onClick={openNewDialog}>
                  Registrar primer CAI
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>CAI</TableHead>
                    <TableHead>Razón Social</TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        Rango
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>Rango de correlativos autorizados</TooltipContent>
                        </Tooltip>
                      </span>
                    </TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell>
                        {config.active === 1 ? (
                          <Badge className="bg-green-600">Activo</Badge>
                        ) : (
                          <Badge variant="secondary">Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[150px] truncate">
                        {config.cai}
                      </TableCell>
                      <TableCell>{config.businessName}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {config.rangeStart} - {config.rangeEnd}
                        <span className="block text-muted-foreground">
                          Actual: {config.currentNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={
                          new Date(config.expiryDate) <= new Date() ? "text-destructive" :
                          new Date(config.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? "text-amber-600" : ""
                        }>
                          {formatDate(config.expiryDate)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(config)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar CAI</TooltipContent>
                          </Tooltip>
                          {config.active !== 1 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setAsActive(config)}
                                >
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Establecer como activo</TooltipContent>
                            </Tooltip>
                          )}
                          {deleteConfirm === config.id ? (
                            <div className="flex gap-1">
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => deleteCai(config.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setDeleteConfirm(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteConfirm(config.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Eliminar CAI</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingConfig ? "Editar CAI" : "Nuevo CAI"}</DialogTitle>
              <DialogDescription>
                Ingrese los datos del Código de Autorización de Impresión proporcionado por la SAR
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cai" className="flex items-center gap-1">
                  CAI *
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[250px]">
                      Código de Autorización de Impresión de 37 caracteres proporcionado por la SAR
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="cai"
                  value={formData.cai}
                  onChange={(e) => setFormData({ ...formData, cai: e.target.value.toUpperCase() })}
                  placeholder="Ej: A1B2C3-D4E5F6-G7H8I9-J0K1L2-M3N4O5-P6Q7R8"
                  required
                  className="font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rtn">RTN *</Label>
                  <Input
                    id="rtn"
                    value={formData.rtn}
                    onChange={(e) => setFormData({ ...formData, rtn: e.target.value.replace(/\D/g, "") })}
                    placeholder="14 dígitos"
                    maxLength={14}
                    required
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Teléfono del negocio"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessName">Razón Social *</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  placeholder="Nombre del negocio según SAR"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessAddress">Dirección</Label>
                <Input
                  id="businessAddress"
                  value={formData.businessAddress}
                  onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                  placeholder="Dirección del establecimiento"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prefix" className="flex items-center gap-1">
                    Prefijo
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Formato: Establecimiento-Punto de Emisión-Tipo de Documento
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="prefix"
                    value={formData.prefix}
                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                    placeholder="000-001-01"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rangeStart">Rango Inicial *</Label>
                  <Input
                    id="rangeStart"
                    type="number"
                    min="1"
                    value={formData.rangeStart}
                    onChange={(e) => setFormData({ ...formData, rangeStart: e.target.value })}
                    placeholder="1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rangeEnd">Rango Final *</Label>
                  <Input
                    id="rangeEnd"
                    type="number"
                    min="1"
                    value={formData.rangeEnd}
                    onChange={(e) => setFormData({ ...formData, rangeEnd: e.target.value })}
                    placeholder="500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate">Fecha Límite de Emisión *</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  required
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingConfig ? "Guardar Cambios" : "Registrar CAI"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
