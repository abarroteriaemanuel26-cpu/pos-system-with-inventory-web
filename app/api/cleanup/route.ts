import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const db = getDb();

    await db.run(sql`DELETE FROM invoice_items`);
    await db.run(sql`DELETE FROM invoices`);
    await db.run(sql`DELETE FROM purchase_items`);
    await db.run(sql`DELETE FROM purchases`);
    await db.run(sql`DELETE FROM daily_closings`);
    await db.run(sql`DELETE FROM cash_registers`);
    await db.run(sql`DELETE FROM products`);
    await db.run(sql`DELETE FROM system_config WHERE key = 'closed_dates'`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cleaning up:", error);
    return NextResponse.json({ error: "Error al limpiar datos" }, { status: 500 });
  }
}
