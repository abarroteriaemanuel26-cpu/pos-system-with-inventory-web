import { getDb } from "@/lib/db";
import { invoices, dailyClosings, systemConfig, cashRegisters, users } from "@/lib/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLocalDateTimeString } from "@/lib/utils/format";

export async function GET() {
  try {
    const db = getDb();
    const config = await db.select().from(systemConfig).where(eq(systemConfig.key, "closed_dates"));
    const closedDates: string[] = config.length > 0 ? JSON.parse(config[0].value) : [];
    return NextResponse.json({ closedDates });
  } catch {
    return NextResponse.json({ closedDates: [] });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Solo el administrador puede cerrar el día" }, { status: 403 });
    }

    const data = await request.json();
    const { date, action } = data;

    if (!date) {
      return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });
    }

    // Get current closed dates
    const config = await db.select().from(systemConfig).where(eq(systemConfig.key, "closed_dates"));
    let closedDates: string[] = config.length > 0 ? JSON.parse(config[0].value) : [];

    if (action === "close") {
      if (closedDates.includes(date)) {
        return NextResponse.json({ error: "La fecha ya está cerrada" }, { status: 400 });
      }

      // Also verify against the actual DB table in case config is out of sync
      const [existingClosing] = await db.select().from(dailyClosings).where(eq(dailyClosings.closingDate, date)).limit(1);
      if (existingClosing) {
        return NextResponse.json({ error: "La fecha ya está cerrada" }, { status: 400 });
      }

      // Get stats for the day for the closing record
      const [y, m, d] = date.split("-").map(Number);
      const nextDate = new Date(y, m - 1, d + 1);
      const nextDay = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
      const extendedEnd = nextDay + " 05:59:59";

      const dayInvoices = await db
        .select()
        .from(invoices)
        .where(
          and(
            gte(invoices.createdAt, date),
            lte(invoices.createdAt, extendedEnd)
          )
        );

      const totalSales = dayInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const totalCash = dayInvoices.filter(i => i.paymentMethod === "efectivo").reduce((sum, inv) => sum + inv.total, 0);
      const totalCard = dayInvoices.filter(i => i.paymentMethod === "tarjeta").reduce((sum, inv) => sum + inv.total, 0);
      const totalTransfer = dayInvoices.filter(i => i.paymentMethod === "transferencia").reduce((sum, inv) => sum + inv.total, 0);
      const totalInvoices = dayInvoices.length;
      const totalVoided = dayInvoices.filter(i => i.status === "anulada").length;

      // Get active cash register
      const [activeRegister] = await db
        .select()
        .from(cashRegisters)
        .where(eq(cashRegisters.status, "abierta"))
        .orderBy(sql`created_at DESC`)
        .limit(1);

      // Create daily closing record
      await db.run(sql`
        INSERT INTO daily_closings (closing_date, total_sales, total_cash, total_card, total_transfer, total_invoices, total_voided, user_id, cash_register_id, cashier_name, notes)
        VALUES (${date}, ${totalSales}, ${totalCash}, ${totalCard}, ${totalTransfer}, ${totalInvoices}, ${totalVoided}, ${session.id}, ${activeRegister?.id || null}, ${session.name}, ${`Cerrado por ${session.name}`})
      `);

      closedDates.push(date);

      // Update system config
      if (config.length > 0) {
        await db.update(systemConfig)
          .set({ value: JSON.stringify(closedDates), updatedAt: getLocalDateTimeString() })
          .where(eq(systemConfig.key, "closed_dates"));
      } else {
        await db.insert(systemConfig).values({
          key: "closed_dates",
          value: JSON.stringify(closedDates),
        });
      }

      return NextResponse.json({
        success: true,
        closedDates,
        stats: { totalSales, totalCash, totalCard, totalTransfer, totalInvoices, totalVoided },
      });
    } else if (action === "reopen") {
      if (!closedDates.includes(date)) {
        return NextResponse.json({ error: "La fecha no está cerrada" }, { status: 400 });
      }

      closedDates = closedDates.filter(d => d !== date);

      await db.update(systemConfig)
        .set({ value: JSON.stringify(closedDates), updatedAt: getLocalDateTimeString() })
        .where(eq(systemConfig.key, "closed_dates"));

      return NextResponse.json({ success: true, closedDates });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    console.error("Error in daily close:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
