import { getDb } from "@/lib/db";
import { systemConfig, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { getSession } from "@/lib/auth";
import { getLocalDateTimeString } from "@/lib/utils/format";

export async function GET() {
  try {
    const db = getDb();
    const config = await db.select().from(systemConfig);
    
    const configMap: Record<string, string> = {};
    config.forEach((c) => {
      configMap[c.key] = c.value;
    });
    
    return NextResponse.json(configMap);
  } catch (error) {
    console.error("Error fetching config:", error);
    return NextResponse.json({ error: "Error al obtener configuración" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb();
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const data = await request.json();

    for (const [key, value] of Object.entries(data)) {
      const [existing] = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, key))
        .limit(1);

      if (existing) {
        await db.update(systemConfig)
          .set({ value: String(value), updatedAt: getLocalDateTimeString() })
          .where(eq(systemConfig.key, key));
      } else {
        await db.insert(systemConfig).values({
          key,
          value: String(value),
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating config:", error);
    return NextResponse.json({ error: "Error al actualizar configuración" }, { status: 500 });
  }
}
