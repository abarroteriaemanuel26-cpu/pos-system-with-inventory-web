"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, Store, Database, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<"checking" | "configured" | "not_configured">("checking");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupMessage, setSetupMessage] = useState("");
  const [confirmSetup, setConfirmSetup] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if user already has a session - if so, log them out first
    fetch("/api/me")
      .then(res => {
        if (res.ok) {
          // Has an existing session, log them out so login is always required
          return fetch("/api/auth/logout", { method: "POST" });
        }
      })
      .catch(() => {})
      .finally(() => {
        // Now check DB status
        fetch("/api/settings")
          .then(res => {
            if (res.ok) {
              setDbStatus("configured");
            } else {
              setDbStatus("not_configured");
            }
          })
          .catch(() => setDbStatus("not_configured"))
          .finally(() => setCheckingSession(false));
      });
  }, []);

  const handleSetup = async () => {
    setSetupLoading(true);
    setError("");
    try {
      const res = await fetch("/api/setup", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSetupMessage("Base de datos configurada correctamente");
        setDbStatus("configured");
      } else {
        setError(data.error || "Error al configurar la base de datos");
      }
    } catch {
      setError("Error de conexión al configurar");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Error al iniciar sesión");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de conexión. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  // Show database setup screen if not configured
  if (dbStatus === "not_configured") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500">
              <Database className="h-8 w-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">Configurar Base de Datos</CardTitle>
              <CardDescription>
                Para usar el sistema POS, necesitas configurar la base de datos Turso
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!confirmSetup ? (
              <Button onClick={() => setConfirmSetup(true)} className="w-full">
                <Database className="mr-2 h-4 w-4" />
                Inicializar Base de Datos
              </Button>
            ) : (
              <div className="space-y-2 p-3 border border-amber-500/50 bg-amber-500/5 rounded-lg">
                <p className="text-sm font-medium text-amber-700">¿Está seguro?</p>
                <p className="text-xs text-muted-foreground">
                  Se crearán todas las tablas (usuarios, productos, facturas, etc.) y se agregará
                  el usuario administrador por defecto.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setConfirmSetup(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSetup} disabled={setupLoading} className="flex-1">
                    {setupLoading ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : null}
                    Confirmar
                  </Button>
                </div>
              </div>
            )}
            
            <p className="text-xs text-center text-muted-foreground">
              Inicialice solo la primera vez que configura el sistema
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Show loading while checking
  if (checkingSession || dbStatus === "checking") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Verificando configuración...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Store className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl">Sistema POS</CardTitle>
            <CardDescription>Ingrese sus credenciales para acceder</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {setupMessage && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{setupMessage}</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="Ingrese su usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </form>

        </CardContent>
      </Card>
    </main>
  );
}
