import { getDb } from "@/lib/db";
import { caiConfigs } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const db = getDb();
    const configs = await db.select().from(caiConfigs).orderBy(desc(caiConfigs.createdAt));
    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching CAI configs:", error);
    return NextResponse.json({ error: "Error al obtener configuraciones CAI" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const data = await request.json();
    
    if (!data.cai || !data.rtn || !data.businessName || !data.rangeStart || !data.rangeEnd || !data.expiryDate) {
      return NextResponse.json(
        { error: "CAI, RTN, nombre del negocio, rango y fecha de vencimiento son requeridos" },
        { status: 400 }
      );
    }

    // Deactivate all other CAI configs
    await db.update(caiConfigs).set({ active: 0 });

    const [newConfig] = await db.insert(caiConfigs).values({
      cai: data.cai,
      rtn: data.rtn,
      businessName: data.businessName,
      businessAddress: data.businessAddress || null,
      phone: data.phone || null,
      rangeStart: data.rangeStart,
      rangeEnd: data.rangeEnd,
      currentNumber: data.rangeStart,
      prefix: data.prefix || "000-001-01",
      expiryDate: data.expiryDate,
      active: 1,
    }).returning();

    return NextResponse.json(newConfig);
  } catch (error) {
    console.error("Error creating CAI config:", error);
    return NextResponse.json({ error: "Error al crear configuración CAI" }, { status: 500 });
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

    const caiId = parseInt(id, 10);
    await db.delete(caiConfigs).where(eq(caiConfigs.id, caiId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting CAI config:", error);
    return NextResponse.json({ error: "Error al eliminar CAI" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb();
    const data = await request.json();
    
    if (!data.id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // If setting as active, deactivate others first
    if (data.active === 1) {
      await db.update(caiConfigs).set({ active: 0 });
    }

    const [updated] = await db.update(caiConfigs)
      .set({
        cai: data.cai,
        rtn: data.rtn,
        businessName: data.businessName,
        businessAddress: data.businessAddress,
        phone: data.phone,
        rangeStart: data.rangeStart,
        rangeEnd: data.rangeEnd,
        prefix: data.prefix,
        expiryDate: data.expiryDate,
        active: data.active,
      })
      .where(eq(caiConfigs.id, data.id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating CAI config:", error);
    return NextResponse.json({ error: "Error al actualizar configuración CAI" }, { status: 500 });
  }
}
