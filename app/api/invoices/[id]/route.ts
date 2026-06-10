import { getDb } from "@/lib/db";
import { invoices, invoiceItems, products, caiConfigs, systemConfig, users } from "@/lib/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLocalDateTimeString } from "@/lib/utils/format";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const invoiceId = parseInt(id);

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));

    if (!invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    // Get invoice items
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

    // Get CAI data
    let caiData = null;
    if (invoice.caiId) {
      const [cai] = await db.select().from(caiConfigs).where(eq(caiConfigs.id, invoice.caiId));
      caiData = cai;
    }

    // Get cashier name
    let cashierName: string | null = null;
    if (invoice.userId) {
      const [user] = await db.select().from(users).where(eq(users.id, invoice.userId)).limit(1);
      cashierName = user?.name || null;
    }

    // Get system config
    const sysConfigRows = await db.select().from(systemConfig).where(
      inArray(systemConfig.key, ["ticket_footer", "business_email", "business_phone", "business_address", "business_name", "business_rtn", "cash_register_number"])
    );
    const sysConfigMap: Record<string, string> = {};
    sysConfigRows.forEach((c) => { sysConfigMap[c.key] = c.value; });

    return NextResponse.json({
      ...invoice,
      items,
      cashierName,
      cai: caiData?.cai,
      caiExpiryDate: caiData?.expiryDate,
      rtn: sysConfigMap.business_rtn || caiData?.rtn,
      businessName: sysConfigMap.business_name || caiData?.businessName,
      businessAddress: sysConfigMap.business_address || caiData?.businessAddress,
      phone: sysConfigMap.business_phone || caiData?.phone,
      businessEmail: sysConfigMap.business_email || null,
      rangeStart: caiData?.rangeStart,
      rangeEnd: caiData?.rangeEnd,
      prefix: caiData?.prefix,
      ticketFooter: sysConfigMap.ticket_footer || null,
      cashRegisterNumber: sysConfigMap.cash_register_number || null,
    });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json({ error: "Error al obtener factura" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const invoiceId = parseInt(id);
    const data = await request.json();

    // Get current invoice
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));

    if (!invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    // Only allow voiding (admin only)
    if (data.action === "void") {
      if (session.role !== "admin") {
        return NextResponse.json({ error: "Solo el administrador puede anular facturas" }, { status: 403 });
      }

      if (invoice.status === "anulada") {
        return NextResponse.json({ error: "La factura ya está anulada" }, { status: 400 });
      }

      if (!data.reason) {
        return NextResponse.json({ error: "Debe proporcionar una razón para anular" }, { status: 400 });
      }

      // Restore stock for all items
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
      
      for (const item of items) {
        if (item.productId) {
          await db.run(sql`
            UPDATE products 
            SET stock = stock + ${item.quantity}, updated_at = ${getLocalDateTimeString()}
            WHERE id = ${item.productId}
          `);
        }
      }

      // Mark invoice as voided
      await db.update(invoices)
        .set({
          status: "anulada",
          voidedReason: data.reason,
        })
        .where(eq(invoices.id, invoiceId));

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json({ error: "Error al actualizar factura" }, { status: 500 });
  }
}
