"use client";

import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Settings,
  Users,
  Store,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  HelpCircle,
  Database,
  Wifi,
  WifiOff,
  CalendarX,
  Clock,
  Lock,
  Unlock,
  Calendar,
  AlertCircle,
} from "lucide-react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al obtener datos");
  }
  return res.json();
};

type User = {
  id: number;
  username: string;
  name: string;
  role: string;
  active: number;
};

type SystemConfig = {
  business_name?: string;
  ticket_footer?: string;
  printer_type?: string;
  printer_name?: string;
  business_address?: string;
  business_phone?: string;
  business_email?: string;
  cash_drawer?: string;
  system_date?: string;
  system_time?: string;
  cash_register_number?: string;
};

export default function SettingsPage() {
  const { data: users, isLoading: usersLoading } = useSWR<User[]>("/api/users", fetcher);
  const { data: config, isLoading: configLoading } = useSWR<SystemConfig>(
    "/api/settings",
    fetcher
  );

  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    name: "",
    role: "cajero",
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const [configForm, setConfigForm] = useState<SystemConfig>({});
  const [configSaving, setConfigSaving] = useState(false);

  // Update config form when data loads
  useEffect(() => {
    if (config) {
      setConfigForm(config);
      if (config.system_date) {
        setSystemDate(config.system_date);
        setUseCustomDateTime(true);
      }
      if (config.system_time) {
        setSystemTime(config.system_time);
      }
    }
  }, [config]);

  const openNewUserDialog = () => {
    setEditingUser(null);
    setUserForm({ username: "", password: "", name: "", role: "cajero" });
    setUserDialog(true);
  };

  const openEditUserDialog = (user: User) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      password: "",
      name: user.name,
      role: user.role,
    });
    setUserDialog(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const method = editingUser ? "PUT" : "POST";
      const body = {
        ...userForm,
        ...(editingUser && { id: editingUser.id }),
        ...(editingUser && !userForm.password && { password: undefined }),
      };

      const response = await fetch("/api/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        mutate("/api/users");
        setUserDialog(false);
      } else {
        const error = await response.json();
        alert(error.error || "Error al guardar usuario");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (userId: number) => {
    const response = await fetch(`/api/users?id=${userId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      mutate("/api/users");
      setDeleteConfirm(null);
    } else {
      const err = await response.json();
      alert(err.error || "Error al eliminar usuario");
    }
  };

  const toggleUserActive = async (user: User) => {
    await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: user.id,
        name: user.name,
        role: user.role,
        active: user.active === 1 ? 0 : 1,
      }),
    });
    mutate("/api/users");
  };

  const handleConfigSave = async () => {
    setConfigSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configForm),
      });

      if (response.ok) {
        mutate("/api/settings");
        alert("Configuración guardada correctamente");
      }
    } finally {
      setConfigSaving(false);
    }
  };

  const [confirmSetup, setConfirmSetup] = useState(false);
  const [testResult, setTestResult] = useState<{ status: string; latency?: number } | null>(null);
  const [testing, setTesting] = useState(false);

  // Daily close
  const { data: closeData, mutate: mutateClose } = useSWR("/api/daily-close", fetcher);
  const [closeConfirmStep, setCloseConfirmStep] = useState(0);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeStats, setCloseStats] = useState<any>(null);
  const [reopenDate, setReopenDate] = useState<string | null>(null);
  const [reopenConfirm, setReopenConfirm] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/setup");
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ status: "disconnected" });
    } finally {
      setTesting(false);
    }
  };

  const handleCloseDay = async () => {
    setCloseLoading(true);
    try {
      const d = new Date();
      const today = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      const res = await fetch("/api/daily-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, action: "close" }),
      });
      const data = await res.json();
      if (res.ok) {
        setCloseStats(data.stats);
        setCloseConfirmStep(3); // Show success
        mutateClose();
      } else {
        alert(data.error || "Error al cerrar el día");
        setCloseConfirmStep(0);
      }
    } catch {
      alert("Error de conexión");
      setCloseConfirmStep(0);
    } finally {
      setCloseLoading(false);
    }
  };

  const handleReopenDay = async (date: string) => {
    setCloseLoading(true);
    try {
      const res = await fetch("/api/daily-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, action: "reopen" }),
      });
      if (res.ok) {
        setReopenDate(null);
        setReopenConfirm(false);
        mutateClose();
      } else {
        const data = await res.json();
        alert(data.error || "Error al reabrir el día");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setCloseLoading(false);
    }
  };

  const [cleanupStep, setCleanupStep] = useState(0);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);

  // Date/time override
  const [systemDate, setSystemDate] = useState("");
  const [systemTime, setSystemTime] = useState("");
  const [dateTimeSaving, setDateTimeSaving] = useState(false);
  const [useCustomDateTime, setUseCustomDateTime] = useState(false);

  const handleCleanup = async () => {
    setCleanupLoading(true);
    try {
      const res = await fetch("/api/cleanup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setCleanupResult(data);
        setCleanupStep(2);
      } else {
        alert(data.error || "Error al limpiar datos");
        setCleanupStep(0);
      }
    } catch {
      alert("Error de conexión");
      setCleanupStep(0);
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleSaveDateTime = async () => {
    setDateTimeSaving(true);
    try {
      const updates: Record<string, string> = {};
      if (useCustomDateTime && systemDate) {
        updates.system_date = systemDate;
        updates.system_time = systemTime || "00:00";
      } else {
        updates.system_date = "";
        updates.system_time = "";
      }
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        mutate("/api/settings");
        toast.success("Fecha/hora del sistema actualizada");
      } else {
        const err = await response.json();
        toast.error(err.error || "Error al guardar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDateTimeSaving(false);
    }
  };

  const handleSetupDatabase = async () => {
    try {
      const response = await fetch("/api/setup", { method: "POST" });
      const data = await response.json();
      
      if (response.ok) {
        alert("Base de datos configurada correctamente. Puede iniciar sesión con admin/admin123");
        window.location.reload();
      } else {
        alert(data.error || "Error al configurar la base de datos");
      }
    } catch (error) {
      alert("Error de conexión al configurar la base de datos");
    }
    setConfirmSetup(false);
  };

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Configuración
            </h1>
            <p className="text-muted-foreground">
              Administra usuarios y configuración del sistema
            </p>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="system">
              <Store className="mr-2 h-4 w-4" />
              Sistema
            </TabsTrigger>
            <TabsTrigger value="datetime">
              <Clock className="mr-2 h-4 w-4" />
              Fecha/Hora
            </TabsTrigger>
            <TabsTrigger value="database">
              <Database className="mr-2 h-4 w-4" />
              Base de Datos
            </TabsTrigger>
            <TabsTrigger value="dailyclose">
              <CalendarX className="mr-2 h-4 w-4" />
              Fin de Día
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Usuarios del Sistema</CardTitle>
                  <CardDescription>
                    Administra los usuarios que pueden acceder al sistema
                  </CardDescription>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={openNewUserDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nuevo Usuario
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Crear un nuevo usuario</TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !users || users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay usuarios registrados</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[100px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-mono">{user.username}</TableCell>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>
                            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                              {user.role === "admin" ? "Administrador" : "Cajero"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={user.active === 1}
                              onCheckedChange={() => toggleUserActive(user)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditUserDialog(user)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar usuario</TooltipContent>
                              </Tooltip>
                              {deleteConfirm === user.id ? (
                                <div className="flex gap-1">
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => deleteUser(user.id)}
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
                                      onClick={() => setDeleteConfirm(user.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Eliminar usuario</TooltipContent>
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
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración del Negocio</CardTitle>
                <CardDescription>
                  Ajustes generales del sistema de punto de venta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {configLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="business_name">Nombre del Negocio</Label>
                      <Input
                        id="business_name"
                        value={configForm.business_name || config?.business_name || ""}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, business_name: e.target.value })
                        }
                        placeholder="Mi Bodega"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="business_address">Dirección del Negocio</Label>
                      <Input
                        id="business_address"
                        value={configForm.business_address || config?.business_address || ""}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, business_address: e.target.value })
                        }
                        placeholder="Dirección del negocio"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="business_phone">Teléfono</Label>
                        <Input
                          id="business_phone"
                          value={configForm.business_phone || config?.business_phone || ""}
                          onChange={(e) =>
                            setConfigForm({ ...configForm, business_phone: e.target.value })
                          }
                          placeholder="Teléfono del negocio"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="business_email">Correo Electrónico</Label>
                        <Input
                          id="business_email"
                          value={configForm.business_email || config?.business_email || ""}
                          onChange={(e) =>
                            setConfigForm({ ...configForm, business_email: e.target.value })
                          }
                          placeholder="correo@ejemplo.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ticket_footer">Mensaje en Ticket</Label>
                      <Input
                        id="ticket_footer"
                        value={configForm.ticket_footer || config?.ticket_footer || ""}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, ticket_footer: e.target.value })
                        }
                        placeholder="Gracias por su compra"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="printer_type" className="flex items-center gap-1">
                        Tipo de Impresora por Defecto
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Tipo de impresora que se usará por defecto al imprimir
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <Select
                        value={configForm.printer_type || config?.printer_type || "thermal"}
                        onValueChange={(value) =>
                          setConfigForm({ ...configForm, printer_type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="thermal">Térmica (80mm)</SelectItem>
                          <SelectItem value="letter">Carta (8.5x11)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="printer_name" className="flex items-center gap-1">
                        Nombre de la Impresora
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Nombre de la impresora configurada en Windows. Ej: "EPSON TM-T20", "3nStar POS-80"
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <Input
                        id="printer_name"
                        value={configForm.printer_name || config?.printer_name || ""}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, printer_name: e.target.value })
                        }
                        placeholder="Nombre de la impresora"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cash_register_number">Número de Caja</Label>
                      <Input
                        id="cash_register_number"
                        type="number"
                        min="1"
                        max="99"
                        value={configForm.cash_register_number || config?.cash_register_number || ""}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, cash_register_number: e.target.value })
                        }
                        placeholder="Ej: 1"
                      />
                      <p className="text-xs text-muted-foreground">
                        Número de esta caja (1-99). Se usará para identificar la caja en reportes y facturas.
                      </p>
                    </div>

                    <Button onClick={handleConfigSave} disabled={configSaving}>
                      {configSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Guardar Cambios
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="datetime" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Fecha y Hora del Sistema
                </CardTitle>
                <CardDescription>
                  Configure la fecha y hora que usarán las facturas. Útil si la hora del servidor no es correcta. Solo administrador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {configLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Usar fecha/hora personalizada</p>
                        <p className="text-sm text-muted-foreground">
                          Al activar, todas las facturas usarán esta fecha y hora
                        </p>
                      </div>
                      <Switch
                        checked={useCustomDateTime}
                        onCheckedChange={setUseCustomDateTime}
                      />
                    </div>

                    {useCustomDateTime && (
                      <>
                        <div className="p-4 border rounded-lg bg-amber-500/5 border-amber-500/30">
                          <p className="text-sm text-amber-700 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            La fecha/hora personalizada afectará los timbres de las facturas
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Fecha</Label>
                            <Input
                              type="date"
                              value={systemDate}
                              onChange={(e) => setSystemDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Hora</Label>
                            <Input
                              type="time"
                              value={systemTime}
                              onChange={(e) => setSystemTime(e.target.value)}
                            />
                          </div>
                        </div>

                        {systemDate && (
                          <div className="p-3 bg-muted rounded-lg text-sm">
                            <p className="text-muted-foreground">Fecha/Hora activa:</p>
                            <p className="font-mono font-medium">
                              {systemDate} {systemTime || "00:00"}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {!useCustomDateTime && (
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        <p className="text-muted-foreground">Usando fecha/hora real del servidor</p>
                        <p className="font-mono font-medium">
                          {new Intl.DateTimeFormat("es-HN", {
                            timeZone: "America/Tegucigalpa",
                            year: "numeric", month: "2-digit", day: "2-digit",
                            hour: "2-digit", minute: "2-digit", second: "2-digit",
                            hour12: false,
                          }).format(new Date())}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button onClick={handleSaveDateTime} disabled={dateTimeSaving}>
                        {dateTimeSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar
                      </Button>
                      {useCustomDateTime && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setUseCustomDateTime(false);
                            setSystemDate("");
                            setSystemTime("");
                          }}
                        >
                          Usar hora real del sistema
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="database" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Base de Datos</CardTitle>
                <CardDescription>
                  Herramientas para inicializar y mantener la base de datos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg space-y-3">
                  <h3 className="font-medium">Probar Conexión</h3>
                  <p className="text-sm text-muted-foreground">
                    Verifica si la base de datos está accesible antes de inicializar.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={testConnection} disabled={testing}>
                      {testing ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : testResult?.status === "connected" ? (
                        <Wifi className="mr-2 h-3 w-3 text-green-600" />
                      ) : testResult ? (
                        <WifiOff className="mr-2 h-3 w-3 text-destructive" />
                      ) : (
                        <Wifi className="mr-2 h-3 w-3" />
                      )}
                      {testResult?.status === "connected" ? `Conectado (${testResult.latency}ms)` : testResult ? "Sin conexión" : "Probar Conexión"}
                    </Button>
                  </div>
                </div>
                <div className="p-4 border rounded-lg space-y-3">
                  <h3 className="font-medium">Inicializar Base de Datos</h3>
                  <p className="text-sm text-muted-foreground">
                    Crea todas las tablas necesarias para el sistema (productos, facturas, usuarios,
                    cierres de día, configuraciones de CAI, etc.) y agrega el usuario administrador
                    por defecto (<strong>admin</strong> / <strong>admin123</strong>).
                    Use esto la primera vez que configura el sistema o si la base de datos está vacía.
                    Si ya hay datos, se conservarán (solo se crean las tablas faltantes).
                  </p>
                  {!confirmSetup ? (
                    <Button variant="outline" onClick={() => setConfirmSetup(true)}>
                      <Database className="mr-2 h-4 w-4" />
                      Inicializar Base de Datos
                    </Button>
                  ) : (
                    <div className="space-y-2 p-3 border border-amber-500/50 bg-amber-500/5 rounded-lg">
                      <p className="text-sm font-medium text-amber-700">¿Está seguro?</p>
                      <p className="text-xs text-muted-foreground">
                        Se crearán todas las tablas y se agregará el usuario administrador por defecto.
                        Si la base de datos ya tiene datos, se conservarán.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setConfirmSetup(false)} className="flex-1">
                          Cancelar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleSetupDatabase} className="flex-1">
                          Confirmar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border border-destructive/30 rounded-lg space-y-3">
                  <h3 className="font-medium text-destructive">Limpiar Datos de Prueba</h3>
                  <p className="text-sm text-muted-foreground">
                    Elimina todas las facturas y ventas realizadas. Útil para probar
                    el sistema desde cero. <strong>Esta acción no se puede deshacer.</strong>
                  </p>
                  {cleanupStep === 0 ? (
                    <Button variant="destructive" size="sm" onClick={() => setCleanupStep(1)}>
                      Eliminar todas las facturas
                    </Button>
                  ) : cleanupStep === 1 ? (
                    <div className="space-y-2 p-3 border border-destructive/50 bg-destructive/5 rounded-lg">
                      <p className="text-sm font-medium text-destructive">¿Está seguro?</p>
                      <p className="text-xs text-muted-foreground">
                        Se eliminarán TODAS las facturas y sus detalles. Los productos,
                        proveedores y demás datos se conservarán.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCleanupStep(0)} className="flex-1">
                          Cancelar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleCleanup} className="flex-1">
                          {cleanupLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                          Confirmar eliminación
                        </Button>
                      </div>
                    </div>
                  ) : cleanupStep === 2 && (
                    <div className="space-y-2 p-3 border border-green-500/50 bg-green-500/5 rounded-lg">
                      <p className="text-sm font-medium text-green-700">Datos eliminados correctamente</p>
                      <p className="text-xs text-muted-foreground">
                        Se eliminaron {cleanupResult?.deletedInvoices || 0} facturas
                        y {cleanupResult?.deletedInvoiceItems || 0} registros de detalle.
                      </p>
                      <Button variant="outline" size="sm" onClick={() => setCleanupStep(0)}>
                        Aceptar
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dailyclose" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarX className="h-5 w-5" />
                  Fin de Día
                </CardTitle>
                <CardDescription>
                  Cierra el día de ventas para evitar nuevas facturas en la fecha actual.
                  Solo el administrador puede reabrir un día cerrado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Close today */}
                <div className="p-4 border rounded-lg space-y-3">
                  <h3 className="font-medium">Cerrar día de hoy</h3>
                  <p className="text-sm text-muted-foreground">
                    Al cerrar el día, se generará un resumen de ventas y no se permitirán más
                    facturas en la fecha de hoy.
                  </p>

                  {closeConfirmStep === 0 && (
                    <Button
                      variant="default"
                      onClick={() => setCloseConfirmStep(1)}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Cerrar Día
                    </Button>
                  )}

                  {closeConfirmStep === 1 && (
                    <div className="space-y-2 p-3 border border-amber-500/50 bg-amber-500/5 rounded-lg">
                      <p className="text-sm font-medium text-amber-700">Primera confirmación</p>
                      <p className="text-xs text-muted-foreground">
                        ¿Está seguro que desea cerrar el día de hoy? No se podrán emitir
                        más facturas en esta fecha.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCloseConfirmStep(0)} className="flex-1">
                          Cancelar
                        </Button>
                        <Button variant="default" size="sm" onClick={() => setCloseConfirmStep(2)} className="flex-1">
                          Continuar
                        </Button>
                      </div>
                    </div>
                  )}

                  {closeConfirmStep === 2 && (
                    <div className="space-y-2 p-3 border border-destructive/50 bg-destructive/5 rounded-lg">
                      <p className="text-sm font-medium text-destructive">Segunda confirmación</p>
                      <p className="text-xs text-muted-foreground">
                        Esta acción es irreversible desde el POS. Solo un administrador podrá
                        reabrir el día desde Configuración. ¿Confirma que desea proceder?
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCloseConfirmStep(1)} className="flex-1">
                          Atrás
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleCloseDay}
                          disabled={closeLoading}
                          className="flex-1"
                        >
                          {closeLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                          Confirmar y Cerrar
                        </Button>
                      </div>
                    </div>
                  )}

                  {closeConfirmStep === 3 && closeStats && (
                    <div className="space-y-3 p-4 border border-green-500/50 bg-green-500/5 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700 font-medium">
                        <Lock className="h-4 w-4" />
                        Día cerrado correctamente
                      </div>
                      <div className="text-sm space-y-1">
                        <p>Total facturas: <strong>{closeStats.totalInvoices}</strong></p>
                        <p>Ventas totales: <strong>L.{closeStats.totalSales.toFixed(2)}</strong></p>
                        <p>Efectivo: L.{closeStats.totalCash.toFixed(2)}</p>
                        <p>Tarjeta: L.{closeStats.totalCard.toFixed(2)}</p>
                        <p>Transferencia: L.{closeStats.totalTransfer.toFixed(2)}</p>
                        {closeStats.totalVoided > 0 && (
                          <p>Anuladas: {closeStats.totalVoided}</p>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setCloseConfirmStep(0)}>
                        Aceptar
                      </Button>
                    </div>
                  )}
                </div>

                {/* Reopen closed dates */}
                <div className="p-4 border rounded-lg space-y-3">
                  <h3 className="font-medium">Reabrir día cerrado</h3>
                  <p className="text-sm text-muted-foreground">
                    Si cometió un error, puede reabrir un día cerrado para permitir
                    facturación nuevamente en esa fecha.
                  </p>

                  {closeData?.closedDates?.length > 0 ? (
                    <div className="space-y-2">
                      {closeData.closedDates.map((date: string) => (
                        <div key={date} className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm font-mono">{date}</span>
                          {reopenDate === date ? (
                            <div className="flex gap-2">
                              {!reopenConfirm ? (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => setReopenDate(null)}>
                                    Cancelar
                                  </Button>
                                  <Button variant="default" size="sm" onClick={() => setReopenConfirm(true)}>
                                    Reabrir
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => { setReopenDate(null); setReopenConfirm(false); }}>
                                    Cancelar
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleReopenDay(date)}
                                    disabled={closeLoading}
                                  >
                                    {closeLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                    Confirmar Reapertura
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReopenDate(date)}
                            >
                              <Unlock className="mr-2 h-3 w-3" />
                              Reabrir
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No hay días cerrados</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* User Dialog */}
        <Dialog open={userDialog} onOpenChange={setUserDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Modifica los datos del usuario. Deja la contraseña vacía para no cambiarla."
                  : "Ingresa los datos del nuevo usuario"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuario *</Label>
                <Input
                  id="username"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder="nombre_usuario"
                  required={!editingUser}
                  disabled={!!editingUser}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nombre Completo *</Label>
                <Input
                  id="name"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="Juan Pérez"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Contraseña {editingUser ? "(dejar vacío para no cambiar)" : "*"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="••••••••"
                  required={!editingUser}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select
                  value={userForm.role}
                  onValueChange={(value) => setUserForm({ ...userForm, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="cajero">Cajero</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setUserDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingUser ? "Guardar Cambios" : "Crear Usuario"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
