import { getDb } from "@/lib/db";
import { invoices } from "@/lib/schema";
import { sql, like, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rtn = searchParams.get("rtn");

    if (!rtn || rtn.length < 3) {
      return NextResponse.json([]);
    }

    const db = getDb();
    const results = await db
      .selectDistinct({
        rtn: invoices.customerRtn,
        name: invoices.customerName,
      })
      .from(invoices)
      .where(
        and(
          sql`${invoices.customerRtn} IS NOT NULL`,
          like(invoices.customerRtn, `%${rtn}%`)
        )
      );

    return NextResponse.json(results.filter((r) => r.rtn));
  } catch (error) {
    console.error("Error searching customers:", error);
    return NextResponse.json({ error: "Error al buscar clientes" }, { status: 500 });
  }
}
