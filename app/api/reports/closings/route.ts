import { getDb } from "@/lib/db";
import { dailyClosings } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const db = getDb();
    const closings = await db
      .select()
      .from(dailyClosings)
      .orderBy(desc(dailyClosings.closingDate))
      .limit(50);

    return NextResponse.json(closings);
  } catch (error) {
    console.error("Error fetching closings:", error);
    return NextResponse.json({ error: "Error al obtener cierres" }, { status: 500 });
  }
}
