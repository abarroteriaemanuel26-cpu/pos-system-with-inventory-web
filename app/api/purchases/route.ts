import { getDb } from "@/lib/db";
import { purchases, purchaseItems, products, suppliers } from "@/lib/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLocalDateTimeString } from "@/lib/utils/format";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let filter;
    if (startDate && endDate) {
      filter = and(gte(purchases.createdAt, startDate), lte(purchases.createdAt, endDate + " 23:59:59"));
    } else if (startDate) {
      filter = gte(purchases.createdAt, startDate);
    } else if (endDate) {
      filter = lte(purchases.createdAt, endDate + " 23:59:59");
    }

    const all = filter
      ? await db.select().from(purchases).where(filter).orderBy(desc(purchases.createdAt))
      : await db.select().from(purchases).orderBy(desc(purchases.createdAt));
    return NextResponse.json(all);
  } catch (error) {
    console.error("Error fetching purchases:", error);
    return NextResponse.json({ error: "Error al obtener compras" }, { status: 500 });
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

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ error: "Debe agregar al menos un producto" }, { status: 400 });
    }

    let subtotal = 0;
    for (const item of data.items) {
      const itemTotal = item.quantity * item.purchasePrice;
      subtotal += itemTotal;
    }

    // Create or find supplier
    let supplierId = data.supplierId || null;
    if (!supplierId && data.supplierName) {
      const [existing] = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.name, data.supplierName))
        .limit(1);

      if (existing) {
        supplierId = existing.id;
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

    // Create purchase using raw SQL to avoid auto-increment issues with returning()
    await db.run(sql`
      INSERT INTO purchases (supplier_id, supplier_invoice, supplier_name, supplier_rtn, supplier_address, supplier_phone, subtotal, total, notes, supplier_invoice_photo, user_id, purchase_type, supplier_cai, created_at)
      VALUES (${supplierId}, ${data.supplierInvoice || null}, ${data.supplierName}, ${data.supplierRtn || null}, ${data.supplierAddress || null}, ${data.supplierPhone || null}, ${subtotal}, ${subtotal}, ${data.notes || null}, ${data.supplierInvoicePhoto || null}, ${session.id}, ${purchaseType}, ${data.supplierCai || null}, ${getLocalDateTimeString()})
    `);

    const [purchase] = await db.select().from(purchases).orderBy(desc(purchases.id)).limit(1);

    if (!purchase) {
      return NextResponse.json({ error: "Error al crear compra" }, { status: 500 });
    }

    // Create purchase items and update stock
    const createdItems: any[] = [];
    for (const item of data.items) {
      let productId = item.productId;
      const itemTotal = item.quantity * item.purchasePrice;

      if (!productId) {
        // Look up existing product by barcode first
        if (item.barcode) {
          const [existing] = await db
            .select()
            .from(products)
            .where(eq(products.barcode, item.barcode))
            .limit(1);
          if (existing) {
            productId = existing.id;
          }
        }
      }

      if (!productId) {
        // Auto-create product if it doesn't exist
        const barcode = item.barcode || "BAR-" + Date.now().toString(36).toUpperCase();
        await db.run(sql`
          INSERT INTO products (code, barcode, name, purchase_price, sale_price, stock, unit, created_at, updated_at)
          VALUES (${barcode}, ${barcode}, ${item.productName}, ${item.purchasePrice}, ${item.purchasePrice * 1.3}, 0, ${item.unit || "unidad"}, ${getLocalDateTimeString()}, ${getLocalDateTimeString()})
        `);
        const [newProduct] = await db.select().from(products).orderBy(desc(products.id)).limit(1);
        productId = newProduct.id;
      }

      await db.run(sql`
        INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, purchase_price, subtotal, total, expiry_date, created_at)
        VALUES (${purchase.id}, ${productId}, ${item.productName}, ${item.quantity}, ${item.purchasePrice}, ${itemTotal}, ${itemTotal}, ${item.expiryDate || null}, ${getLocalDateTimeString()})
      `);

      createdItems.push({
        purchaseId: purchase.id,
        productId,
        productName: item.productName,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        subtotal: itemTotal,
        total: itemTotal,
        expiryDate: item.expiryDate || null,
      });

      // Increase stock
      await db.run(sql`
        UPDATE products
        SET stock = stock + ${item.quantity}, updated_at = ${getLocalDateTimeString()}
        WHERE id = ${productId}
      `);
    }

    // Get supplier info
    let supplierInfo = null;
    if (supplierId) {
      const [s] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
      supplierInfo = s;
    }

    return NextResponse.json({
      ...purchase,
      items: createdItems,
      supplier: supplierInfo,
    });
  } catch (error) {
    console.error("Error creating purchase:", error);
    return NextResponse.json({ error: "Error al crear compra" }, { status: 500 });
  }
}
