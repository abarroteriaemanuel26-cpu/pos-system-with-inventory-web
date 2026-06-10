import { getDb } from "@/lib/db";
import { invoiceItems, invoices, products } from "@/lib/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    let start = startDate || todayStr;
    let end = endDate || todayStr;

    // Extend upper bound by 6h for Honduras UTC-6
    const [y, m, d] = end.split("-").map(Number);
    const nextDate = new Date(y, m - 1, d + 1);
    const nextDay = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
    const extendedEnd = nextDay + " 05:59:59";

    const rows = await db
      .select({
        productId: invoiceItems.productId,
        productCode: invoiceItems.productCode,
        productName: invoiceItems.productName,
        qtySold: sql<number>`SUM(${invoiceItems.quantity})`,
        totalRevenue: sql<number>`SUM(${invoiceItems.total})`,
        avgUnitPrice: sql<number>`AVG(${invoiceItems.unitPrice})`,
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.status, "activa"),
          gte(invoices.createdAt, start),
          lte(invoices.createdAt, extendedEnd)
        )
      )
      .groupBy(invoiceItems.productId, invoiceItems.productCode, invoiceItems.productName);

    // Get current purchase prices
    const productMap = new Map<number, { purchasePrice: number; salePrice: number }>();
    const allProducts = await db.select().from(products);
    for (const p of allProducts) {
      productMap.set(p.id, { purchasePrice: p.purchasePrice, salePrice: p.salePrice });
    }

    const result = rows.map((row) => {
      const productInfo = productMap.get(row.productId) || { purchasePrice: 0, salePrice: 0 };
      const qty = Number(row.qtySold) || 0;
      const revenue = Number(row.totalRevenue) || 0;
      const avgPrice = Number(row.avgUnitPrice) || 0;
      const cost = productInfo.purchasePrice * qty;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        productId: row.productId,
        productCode: row.productCode,
        productName: row.productName,
        purchasePrice: productInfo.purchasePrice,
        salePrice: productInfo.salePrice,
        avgSalePrice: Math.round(avgPrice * 100) / 100,
        qtySold: qty,
        revenue: Math.round(revenue * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin: Math.round(margin * 100) / 100,
      };
    });

    // Sort by profit descending
    result.sort((a, b) => b.profit - a.profit);

    return NextResponse.json({
      startDate: start,
      endDate: end,
      products: result,
      totalProfit: result.reduce((sum, p) => sum + p.profit, 0),
      totalRevenue: result.reduce((sum, p) => sum + p.revenue, 0),
    });
  } catch (error) {
    console.error("Error fetching product profitability:", error);
    return NextResponse.json({ error: "Error al obtener rentabilidad de productos" }, { status: 500 });
  }
}
