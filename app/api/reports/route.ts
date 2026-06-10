import { getDb } from "@/lib/db";
import { invoices, dailyClosings } from "@/lib/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLocalDateString } from "@/lib/utils/format";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const date = searchParams.get("date"); // keep single date for backward compat

    const today = getLocalDateString();
    let start = startDate || date || today;
    let end = endDate || date || today;

    if (!endDate && date) {
      end = date;
    }

    // Extend upper bound by 6h to catch old UTC timestamps (Honduras UTC-6)
    const [y, m, d] = end.split("-").map(Number);
    const nextDate = new Date(y, m - 1, d + 1);
    const nextDay = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
    const extendedEnd = nextDay + " 05:59:59";

    const dateInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          gte(invoices.createdAt, start),
          lte(invoices.createdAt, extendedEnd)
        )
      );

    const activeInvoices = dateInvoices.filter((inv) => inv.status === "activa");
    const voidedInvoices = dateInvoices.filter((inv) => inv.status === "anulada");

    const totalSales = activeInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalCash = activeInvoices
      .filter((inv) => inv.paymentMethod === "efectivo")
      .reduce((sum, inv) => sum + inv.total, 0);
    const totalCard = activeInvoices
      .filter((inv) => inv.paymentMethod === "tarjeta")
      .reduce((sum, inv) => sum + inv.total, 0);
    const totalTransfer = activeInvoices
      .filter((inv) => inv.paymentMethod === "transferencia")
      .reduce((sum, inv) => sum + inv.total, 0);

    const totalTax = activeInvoices.reduce((sum, inv) => sum + inv.tax15 + inv.tax18, 0);
    const totalExempt = activeInvoices.reduce((sum, inv) => sum + inv.taxExempt, 0);

    return NextResponse.json({
      startDate: start,
      endDate: end,
      totalSales,
      totalCash,
      totalCard,
      totalTransfer,
      totalTax,
      totalExempt,
      totalInvoices: activeInvoices.length,
      totalVoided: voidedInvoices.length,
      invoices: activeInvoices,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return NextResponse.json({ error: "Error al obtener reporte" }, { status: 500 });
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
    const date = data.date || getLocalDateString();

    // Check if closing already exists
    const [existing] = await db
      .select()
      .from(dailyClosings)
      .where(eq(dailyClosings.closingDate, date))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un cierre para esta fecha" },
        { status: 400 }
      );
    }

    // Extend upper bound by 6h to catch old UTC timestamps
    const [y, m, d] = date.split("-").map(Number);
    const nextDate = new Date(y, m - 1, d + 1);
    const nextDay = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
    const extendedEnd = nextDay + " 05:59:59";

    // Get today's stats
    const dateInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "activa"),
          gte(invoices.createdAt, date),
          lte(invoices.createdAt, extendedEnd)
        )
      );

    const voidedCount = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "anulada"),
          gte(invoices.createdAt, date),
          lte(invoices.createdAt, extendedEnd)
        )
      );

    const totalSales = dateInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalCash = dateInvoices
      .filter((inv) => inv.paymentMethod === "efectivo")
      .reduce((sum, inv) => sum + inv.total, 0);
    const totalCard = dateInvoices
      .filter((inv) => inv.paymentMethod === "tarjeta")
      .reduce((sum, inv) => sum + inv.total, 0);
    const totalTransfer = dateInvoices
      .filter((inv) => inv.paymentMethod === "transferencia")
      .reduce((sum, inv) => sum + inv.total, 0);

    await db.run(sql`
      INSERT INTO daily_closings (closing_date, total_sales, total_cash, total_card, total_transfer, total_invoices, total_voided, user_id, notes)
      VALUES (${date}, ${totalSales}, ${totalCash}, ${totalCard}, ${totalTransfer}, ${dateInvoices.length}, ${voidedCount.length}, ${session.id}, ${data.notes || null})
    `);

    const [closing] = await db.select().from(dailyClosings).orderBy(desc(dailyClosings.id)).limit(1);

    return NextResponse.json(closing);
  } catch (error) {
    console.error("Error creating closing:", error);
    return NextResponse.json({ error: "Error al crear cierre" }, { status: 500 });
  }
}
