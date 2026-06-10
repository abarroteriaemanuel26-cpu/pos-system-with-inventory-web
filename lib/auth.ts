import { getDb, isDatabaseConfigured } from "./db";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type User = {
  id: number;
  username: string;
  name: string;
  role: "admin" | "cajero";
};

const SESSION_COOKIE = "pos_session";

export async function login(username: string, password: string): Promise<User | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }
  
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  
  if (!user || !user.active) {
    return null;
  }

  const validPassword = await compare(password, user.passwordHash);
  if (!validPassword) {
    return null;
  }

  const session = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role as "admin" | "cajero",
  };

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  return session;
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  
  if (!sessionCookie) {
    return null;
  }

  try {
    return JSON.parse(sessionCookie.value) as User;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<User> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireAdmin(): Promise<User> {
  const session = await requireAuth();
  if (session.role !== "admin") {
    redirect("/pos");
  }
  return session;
}
