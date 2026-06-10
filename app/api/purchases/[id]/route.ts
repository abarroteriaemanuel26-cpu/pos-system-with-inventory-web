import { getDb } from "@/lib/db";
import { purchases, purchaseItems, products, suppliers } from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";
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
    const purchaseId = parseInt(id);

    const [purchase] = await db.select().from(purchases).where(eq(purchases.id, purchaseId));

    if (!purchase) {
      return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
    }

    const items = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, purchaseId));

    let supplierInfo = null;
    if (purchase.supplierId) {
      const [s] = await db.select().from(suppliers).where(eq(suppliers.id, purchase.supplierId));
      supplierInfo = s;
    }

    return NextResponse.json({
      ...purchase,
      items,
      supplier: supplierInfo,
    });
  } catch (error) {
    console.error("Error fetching purchase:", error);
    return NextResponse.json({ error: "Error al obtener compra" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Solo el administrador puede editar compras" }, { status: 403 });
    }

    const { id } = await params;
    const purchaseId = parseInt(id);
    const data = await request.json();

    if (!data.reason || data.reason.trim().length < 5) {
      return NextResponse.json({ error: "Debe especificar un motivo de edición (mínimo 5 caracteres)" }, { status: 400 });
    }

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ error: "Debe agregar al menos un producto" }, { status: 400 });
    }

    const [existing] = await db.select().from(purchases).where(eq(purchases.id, purchaseId));
    if (!existing) {
      return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
    }

    // Fetch old items to revert stock
    const oldItems = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, purchaseId));

    // Revert old stock
    for (const item of oldItems) {
      if (item.productId) {
        await db.run(sql`
          UPDATE products
          SET stock = stock - ${item.quantity}, updated_at = ${getLocalDateTimeString()}
          WHERE id = ${item.productId}
        `);
      }
    }

    // Delete old purchase items
    await db.delete(purchaseItems).where(eq(purchaseItems.purchaseId, purchaseId));

    // Calculate new subtotal
    let newSubtotal = 0;
    for (const item of data.items) {
      newSubtotal += item.quantity * item.purchasePrice;
    }

    // Update supplier reference
    let supplierId = data.supplierId || existing.supplierId;
    if (!supplierId && data.supplierName) {
      const [existingSupplier] = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.name, data.supplierName))
        .limit(1);
      if (existingSupplier) {
        supplierId = existingSupplier.id;
      } else {
        await db.run(sql`
          INSERT INTO suppliers (name, rtn, address, phone)
          VALUES (${data.supplierName}, ${data.supplierRtn || null}, ${data.supplierAddress || null}, ${data.supplierPhone || null})
        `);
        const [newSupplier] = await db.select().from(suppliers).orderBy(desc(suppliers.id)).limit(1);
        supplierId = newSupplier.id;
      }
    }

    const purchaseType = data.purchaseType === "factura" ? "factura" : "comprobante";

    // Ensure new columns exist (backward compatibility)
    try { await db.run(sql`ALTER TABLE purchases ADD COLUMN purchase_type TEXT DEFAULT 'comprobante'`); } catch {}
    try { await db.run(sql`ALTER TABLE purchases ADD COLUMN supplier_cai TEXT`); } catch {}

    // Update purchase record
    await db.run(sql`
      UPDATE purchases
      SET supplier_id = ${supplierId}, supplier_invoice = ${data.supplierInvoice || null}, supplier_name = ${data.supplierName}, supplier_rtn = ${data.supplierRtn || null}, supplier_address = ${data.supplierAddress || null}, supplier_phone = ${data.supplierPhone || null}, subtotal = ${newSubtotal}, total = ${newSubtotal}, purchase_type = ${purchaseType}, supplier_cai = ${data.supplierCai || null}, notes = ${(existing.notes || "") + " | Editado: " + data.reason.trim()}
      WHERE id = ${purchaseId}
    `);

    // Create new purchase items and add stock
    const createdItems: any[] = [];
    for (const item of data.items) {
      let productId = item.productId;

      if (!productId) {
        if (item.barcode) {
          const [existingProduct] = await db
            .select()
            .from(products)
            .where(eq(products.barcode, item.barcode))
            .limit(1);
          if (existingProduct) {
            productId = existingProduct.id;
          }
        }
      }

      if (!productId) {
        const barcode = item.barcode || "BAR-" + Date.now().toString(36).toUpperCase();
        await db.run(sql`
          INSERT INTO products (code, barcode, name, purchase_price, sale_price, stock, unit, created_at, updated_at)
          VALUES (${barcode}, ${barcode}, ${item.productName}, ${item.purchasePrice}, ${item.purchasePrice * 1.3}, 0, ${item.unit || "unidad"}, ${getLocalDateTimeString()}, ${getLocalDateTimeString()})
        `);
        const [newProduct] = await db.select().from(products).orderBy(desc(products.id)).limit(1);
        productId = newProduct.id;
      }

      const itemTotal = item.quantity * item.purchasePrice;
      await db.run(sql`
        INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, purchase_price, subtotal, total, expiry_date, created_at)
        VALUES (${purchaseId}, ${productId}, ${item.productName}, ${item.quantity}, ${item.purchasePrice}, ${itemTotal}, ${itemTotal}, ${item.expiryDate || null}, ${getLocalDateTimeString()})
      `);

      createdItems.push({ productId, productName: item.productName, quantity: item.quantity, purchasePrice: item.purchasePrice, subtotal: itemTotal, total: itemTotal, expiryDate: item.expiryDate || null });

      // Add new stock
      await db.run(sql`
        UPDATE products
        SET stock = stock + ${item.quantity}, updated_at = ${getLocalDateTimeString()}
        WHERE id = ${productId}
      `);
    }

    return NextResponse.json({ success: true, message: "Compra editada correctamente" });
  } catch (error) {
    console.error("Error updating purchase:", error);
    return NextResponse.json({ error: "Error al editar compra" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Solo el administrador puede eliminar compras" }, { status: 403 });
    }

    const { id } = await params;
    const purchaseId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const keepStock = searchParams.get("keepStock") === "true";

    const [purchase] = await db.select().from(purchases).where(eq(purchases.id, purchaseId));
    if (!purchase) {
      return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
    }

    const items = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, purchaseId));

    // Revert stock only if keepStock is false
    if (!keepStock) {
      for (const item of items) {
        if (item.productId) {
          await db.run(sql`
            UPDATE products
            SET stock = stock - ${item.quantity}, updated_at = ${getLocalDateTimeString()}
            WHERE id = ${item.productId}
          `);
        }
      }
    }

    await db.delete(purchaseItems).where(eq(purchaseItems.purchaseId, purchaseId));
    await db.delete(purchases).where(eq(purchases.id, purchaseId));

    return NextResponse.json({ success: true, message: keepStock ? "Compra eliminada, stock conservado" : "Compra eliminada y stock revertido" });
  } catch (error) {
    console.error("Error deleting purchase:", error);
    return NextResponse.json({ error: "Error al eliminar compra" }, { status: 500 });
  }
}
