import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const db = getDb();
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
      })
      .from(users);

    return NextResponse.json(allUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const data = await request.json();

    if (!data.username || !data.password || !data.name) {
      return NextResponse.json(
        { error: "Usuario, contraseña y nombre son requeridos" },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(data.password, 10);

    await db.run(sql`
      INSERT INTO users (username, password_hash, name, role, active)
      VALUES (${data.username}, ${hashedPassword}, ${data.name}, ${data.role || "cajero"}, 1)
    `);

    const [newUser] = await db.select({
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
      active: users.active,
    }).from(users).orderBy(desc(users.id)).limit(1);

    return NextResponse.json(newUser);
  } catch (error) {
    console.error("Error creating user:", error);
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese nombre de usuario" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
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

    if (!data.id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      name: data.name,
      role: data.role,
      active: data.active,
    };

    if (data.password) {
      updateData.password = await hash(data.password, 10);
    }

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, data.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 });
  }
}
