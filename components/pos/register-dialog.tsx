"use client";

import { useState } from "react";
import useSWR from "swr";
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
import { formatCurrency, getLocalDateString } from "@/lib/utils/format";
import { Loader2, HelpCircle, DollarSign, CheckCircle2, XCircle, User } from "lucide-react";

type CashRegister = {
  id: number;
  userId: number;
  openingAmount: number;
  openingTime: string;
  closingTime: string | null;
  expectedCash: number | null;
  actualCash: number | null;
  totalSales: number | null;
  totalInvoices: number | null;
  status: string;
  notes: string | null;
};

type UserOption = {
  id: number;
  name: string;
  username: string;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al obtener datos");
  }
  return res.json();
};

type OpenProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegisterChange: () => void;
  userId: number;
};

type CloseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  register: CashRegister | null | undefined;
  onRegisterChange: () => void;
};

export function OpenRegisterDialog({ open, onOpenChange, onRegisterChange, userId: defaultUserId }: OpenProps) {
  const [selectedUserId, setSelectedUserId] = useState(defaultUserId.toString());
  const [openingAmount, setOpeningAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  const { data: users } = useSWR<UserOption[]>(
    open ? "/api/users" : null,
    fetcher
  );

  const handleOpen = async () => {
    setProcessing(true);
    try {
      const response = await fetch("/api/cash-registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: parseInt(selectedUserId),
          openingAmount: parseFloat(openingAmount) || 0,
        }),
      });

      if (response.ok) {
        onRegisterChange();
        onOpenChange(false);
      } else {
        const error = await response.json();
        alert(error.error || "Error al abrir caja");
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Abrir Caja
          </DialogTitle>
          <DialogDescription>
            Seleccione el cajero y registre el monto inicial
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              Cajero
            </Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cajero" />
              </SelectTrigger>
              <SelectContent>
                {(users || []).map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name} ({user.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="openingAmount" className="flex items-center gap-1">
              Monto de Apertura
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  Efectivo inicial en la caja. Deje 0 si no hay monto inicial.
                </TooltipContent>
              </Tooltip>
            </Label>
            <Input
              id="openingAmount"
              type="number"
              min="0"
              step="0.01"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              placeholder="0.00"
              className="text-lg font-mono"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Si no tiene efectivo inicial, deje 0 y la caja se abrirá sin monto base.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleOpen} disabled={processing}>
            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Abrir Caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CloseRegisterDialog({ open, onOpenChange, register, onRegisterChange }: CloseProps) {
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  // Fetch today's actual sales data for accurate display
  const { data: todaySales } = useSWR(
    open ? `/api/invoices?startDate=${getLocalDateString()}&status=activa` : null,
    fetcher
  );

  const totalSalesToday = Array.isArray(todaySales)
    ? todaySales.reduce((s: number, inv: any) => s + (inv.total || 0), 0)
    : 0;
  const totalInvoicesToday = Array.isArray(todaySales) ? todaySales.length : 0;

  const handleClose = async () => {
    setProcessing(true);
    try {
      const response = await fetch("/api/cash-registers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: register?.id,
          closingAmount: register ? register.openingAmount + totalSalesToday : 0,
          actualCash: parseFloat(actualCash) || 0,
          notes: notes || null,
        }),
      });

      if (response.ok) {
        onRegisterChange();
        onOpenChange(false);
      } else {
        const error = await response.json();
        alert(error.error || "Error al cerrar caja");
      }
    } finally {
      setProcessing(false);
    }
  };

  if (!register) return null;

  const expectedCash = (register.openingAmount || 0) + totalSalesToday;
  const actualCashNum = parseFloat(actualCash) || 0;
  const difference = actualCashNum - expectedCash;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            Cerrar Caja
          </DialogTitle>
          <DialogDescription>
            Resumen de ventas del turno actual
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Monto Apertura</p>
              <p className="font-semibold">{formatCurrency(register.openingAmount || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ventas Totales</p>
              <p className="font-semibold">{formatCurrency(totalSalesToday)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Facturas</p>
              <p className="font-semibold">{totalInvoicesToday}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Efectivo Esperado</p>
              <p className="font-semibold">{formatCurrency(expectedCash)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="actualCash" className="flex items-center gap-1">
              Efectivo Real en Caja *
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  Cuente el efectivo físico y regístrelo aquí
                </TooltipContent>
              </Tooltip>
            </Label>
            <Input
              id="actualCash"
              type="number"
              min="0"
              step="0.01"
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
              placeholder="0.00"
              className="text-lg font-mono"
              autoFocus
            />
            {actualCashNum > 0 && difference !== 0 && (
              <div className={`p-2 rounded text-sm flex items-center gap-1 ${difference >= 0 ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"}`}>
                {difference >= 0 ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {difference >= 0 ? "Sobrante: " : "Faltante: "}
                {formatCurrency(Math.abs(difference))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones del cierre..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleClose} disabled={processing || !actualCash}>
            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cerrar Caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
