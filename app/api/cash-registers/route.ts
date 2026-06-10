import { getDb } from "@/lib/db";
import { cashRegisters, invoices } from "@/lib/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLocalDateString, getLocalDateTimeString } from "@/lib/utils/format";

export async function GET() {
  try {
    const db = getDb();
    const all = await db.select().from(cashRegisters).orderBy(desc(cashRegisters.createdAt)).limit(50);
    return NextResponse.json(all);
  } catch (error) {
    console.error("Error fetching cash registers:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const data = await request.json();

    if (session.role !== "admin") {
      return NextResponse.json({ error: "Solo el administrador puede abrir caja" }, { status: 403 });
    }

    // Check if there's already an open register for this user
    const [openRegister] = await db
      .select()
      .from(cashRegisters)
      .where(and(
        eq(cashRegisters.userId, data.userId || session.id),
        eq(cashRegisters.status, "abierta")
      ))
      .limit(1);

    if (openRegister) {
      return NextResponse.json(
        { error: "Ya tiene una caja abierta. Ciérrela antes de abrir otra." },
        { status: 400 }
      );
    }

      await db.run(sql`
        INSERT INTO cash_registers (user_id, opening_amount, opening_time)
        VALUES (${data.userId || session.id}, ${data.openingAmount || 0}, ${getLocalDateTimeString()})
      `);

      const [register] = await db.select().from(cashRegisters).orderBy(desc(cashRegisters.id)).limit(1);

    return NextResponse.json(register);
  } catch (error) {
    console.error("Error opening register:", error);
    return NextResponse.json({ error: "Error al abrir caja" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const data = await request.json();

    if (session.role !== "admin") {
      return NextResponse.json({ error: "Solo el administrador puede cerrar caja" }, { status: 403 });
    }

    if (!data.id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const [register] = await db
      .select()
      .from(cashRegisters)
      .where(eq(cashRegisters.id, data.id))
      .limit(1);

    if (!register) {
      return NextResponse.json({ error: "Caja no encontrada" }, { status: 404 });
    }

    if (register.status === "cerrada") {
      return NextResponse.json({ error: "La caja ya está cerrada" }, { status: 400 });
    }

    // Get today's sales for this user
    const today = getLocalDateString();
    const todayInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "activa"),
          eq(invoices.userId, session.id),
          gte(invoices.createdAt, today),
          lte(invoices.createdAt, today + " 23:59:59")
        )
      );

    const totalSales = todayInvoices.reduce((s, inv) => s + inv.total, 0);
    const cardSales = todayInvoices
      .filter((inv) => inv.paymentMethod === "tarjeta")
      .reduce((s, inv) => s + inv.total, 0);
    const transferSales = todayInvoices
      .filter((inv) => inv.paymentMethod === "transferencia")
      .reduce((s, inv) => s + inv.total, 0);
    const cashSales = todayInvoices
      .filter((inv) => inv.paymentMethod === "efectivo")
      .reduce((s, inv) => s + inv.total, 0);

    const expectedCash = register.openingAmount + cashSales;

    await db.run(sql`
      UPDATE cash_registers SET closing_amount = ${data.closingAmount}, closing_time = ${getLocalDateTimeString()}, expected_cash = ${expectedCash}, actual_cash = ${data.actualCash}, card_sales = ${cardSales}, transfer_sales = ${transferSales}, total_sales = ${totalSales}, total_invoices = ${todayInvoices.length}, status = 'cerrada', notes = ${data.notes}
      WHERE id = ${data.id}
    `);

    const [updated] = await db.select().from(cashRegisters).where(eq(cashRegisters.id, data.id)).limit(1);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error closing register:", error);
    return NextResponse.json({ error: "Error al cerrar caja" }, { status: 500 });
  }
}
