import { getDb } from "@/lib/db";
import { dailyClosings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLocalDateTimeString } from "@/lib/utils/format";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Solo el administrador puede eliminar cierres" }, { status: 403 });
    }

    const { id } = await params;
    const { reason } = await request.json();

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ error: "Debe especificar un motivo de cancelación (mínimo 5 caracteres)" }, { status: 400 });
    }

    const [closing] = await db.select().from(dailyClosings).where(eq(dailyClosings.id, Number(id))).limit(1);

    if (!closing) {
      return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });
    }

    if (closing.cancelledAt) {
      return NextResponse.json({ error: "Este cierre ya fue cancelado" }, { status: 400 });
    }

    await db.update(dailyClosings)
      .set({
        cancelledAt: getLocalDateTimeString(),
        cancellationReason: reason.trim(),
      })
      .where(eq(dailyClosings.id, Number(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting closing:", error);
    return NextResponse.json({ error: "Error al eliminar cierre" }, { status: 500 });
  }
}
