import { getDb } from "@/lib/db";
import { suppliers } from "@/lib/schema";
import { eq, desc, like, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    let query = db.select().from(suppliers).orderBy(desc(suppliers.createdAt)).$dynamic();

    if (search) {
      query = query.where(
        or(
          like(suppliers.name, `%${search}%`),
          like(suppliers.rtn, `%${search}%`)
        )
      );
    }

    const all = await query;
    return NextResponse.json(all);
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    return NextResponse.json({ error: "Error al obtener proveedores" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const data = await request.json();

    if (!data.name) {
      return NextResponse.json({ error: "El nombre del proveedor es requerido" }, { status: 400 });
    }

    const [newSupplier] = await db.insert(suppliers).values({
      name: data.name,
      rtn: data.rtn || null,
      address: data.address || null,
      phone: data.phone || null,
    }).returning();

    return NextResponse.json(newSupplier);
  } catch (error) {
    console.error("Error creating supplier:", error);
    return NextResponse.json({ error: "Error al crear proveedor" }, { status: 500 });
  }
}
