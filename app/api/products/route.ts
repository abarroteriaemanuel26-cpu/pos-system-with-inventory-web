import { getDb } from "@/lib/db";
import { products, categories } from "@/lib/schema";
import { eq, like, or, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const categoryId = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "200");

    let query = db
      .select({
        id: products.id,
        barcode: products.barcode,
        name: products.name,
        description: products.description,
        categoryId: products.categoryId,
        categoryName: categories.name,
        purchasePrice: products.purchasePrice,
        salePrice: products.salePrice,
        stock: products.stock,
        minStock: products.minStock,
        unit: products.unit,
        image: products.image,
        active: products.active,
        taxRate: categories.taxRate,
        createdAt: products.createdAt,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.active, 1))
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .$dynamic();

    if (search) {
      query = query.where(
        or(
          like(products.name, `%${search}%`),
          like(products.barcode, `%${search}%`)
        )
      );
    }

    if (categoryId) {
      query = query.where(eq(products.categoryId, parseInt(categoryId)));
    }

    const allProducts = await query;
    return NextResponse.json(allProducts);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "Error al obtener productos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const data = await request.json();
    
    if (!data.name || data.salePrice === undefined) {
      return NextResponse.json(
        { error: "Nombre y precio de venta son requeridos" },
        { status: 400 }
      );
    }

    const barcode = data.barcode || "BAR-" + Date.now().toString(36).toUpperCase();

    await db.run(sql`
      INSERT INTO products (code, barcode, name, description, image, category_id, purchase_price, sale_price, stock, min_stock, unit, active)
      VALUES (${barcode}, ${barcode}, ${data.name}, ${data.description || null}, ${data.image || null}, ${data.categoryId || null}, ${data.purchasePrice || 0}, ${data.salePrice}, ${data.stock || 0}, ${data.minStock || 5}, ${data.unit || "unidad"}, 1)
    `);

    const [newProduct] = await db.select().from(products).orderBy(desc(products.id)).limit(1);

    return NextResponse.json(newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "Ya existe un producto con ese código o código de barras" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Error al crear producto" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb();
    const data = await request.json();
    
    if (!data.id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const barcode = data.barcode || "BAR-" + Date.now().toString(36).toUpperCase();

    await db.run(sql`
      UPDATE products SET code = ${barcode}, barcode = ${barcode}, name = ${data.name}, description = ${data.description}, image = ${data.image || null}, category_id = ${data.categoryId}, purchase_price = ${data.purchasePrice}, sale_price = ${data.salePrice}, stock = ${data.stock}, min_stock = ${data.minStock}, unit = ${data.unit}
      WHERE id = ${data.id}
    `);

    const [updated] = await db.select().from(products).where(eq(products.id, data.id)).limit(1);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json({ error: "Error al actualizar producto" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    await db.update(products)
      .set({ active: 0 })
      .where(eq(products.id, parseInt(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json({ error: "Error al eliminar producto" }, { status: 500 });
  }
}
