import { getDb } from "@/lib/db";
import { categories } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const db = getDb();
    const allCategories = await db.select().from(categories).orderBy(categories.name);
    return NextResponse.json(allCategories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ error: "Error al obtener categorías" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const data = await request.json();
    
    if (!data.name) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    const [newCategory] = await db.insert(categories).values({
      name: data.name,
      description: data.description || null,
      taxRate: data.taxRate ?? 15,
      active: 1,
    }).returning();

    return NextResponse.json(newCategory);
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json({ error: "Error al crear categoría" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb();
    const data = await request.json();
    
    if (!data.id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const [updated] = await db.update(categories)
      .set({
        name: data.name,
        description: data.description,
        taxRate: data.taxRate,
        active: data.active,
      })
      .where(eq(categories.id, data.id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json({ error: "Error al actualizar categoría" }, { status: 500 });
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

    await db.update(categories)
      .set({ active: 0 })
      .where(eq(categories.id, parseInt(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json({ error: "Error al eliminar categoría" }, { status: 500 });
  }
}
