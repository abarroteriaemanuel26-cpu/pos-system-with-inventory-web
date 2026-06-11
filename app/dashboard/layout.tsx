import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { systemConfig } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { DashboardNav } from "@/components/dashboard/nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const db = getDb();

  const [config] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, "business_name"))
    .limit(1);
  const businessName = config?.value || "Mi Negocio";

  return (
    <div className="min-h-screen flex">
      <DashboardNav user={user} businessName={businessName} />
      <main className="flex-1 overflow-auto bg-muted/30">
        {children}
      </main>
    </div>
  );
}
