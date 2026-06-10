import { getDb, isDatabaseConfigured } from "@/lib/db";
import { invoices, invoiceItems, caiConfigs, systemConfig, users } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { formatCurrency, formatDateTime, formatDate, formatRTN, formatInvoiceNumber } from "@/lib/utils/format";
import { PrintInvoice } from "@/components/invoice/print-invoice";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; simple?: string }>;
};

export default async function PrintInvoicePage({ params, searchParams }: Props) {
  if (!isDatabaseConfigured()) {
    redirect("/dashboard");
  }
  
  const db = getDb();
  const { id } = await params;
  const { type, simple } = await searchParams;
  const invoiceId = parseInt(id);
  const printType = type === "letter" ? "letter" : "thermal";
  const simpleMode = simple === "true";

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));

  if (!invoice) {
    notFound();
  }

  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

  let caiData = null;
  if (invoice.caiId) {
    const [cai] = await db.select().from(caiConfigs).where(eq(caiConfigs.id, invoice.caiId));
    caiData = cai;
  }

  // Get cashier name
  let cashierName: string | null = null;
  if (invoice.userId) {
    const [user] = await db.select().from(users).where(eq(users.id, invoice.userId)).limit(1);
    cashierName = user?.name || null;
  }

  // Get system config for business info, ticket footer, email, etc.
  const sysConfigRows = await db.select().from(systemConfig).where(
    inArray(systemConfig.key, [
      "ticket_footer", "business_email", "business_name",
      "business_phone", "business_address", "business_rtn", "cash_register_number"
    ])
  );
  const sysConfigMap: Record<string, string> = {};
  sysConfigRows.forEach((c) => { sysConfigMap[c.key] = c.value; });

  return (
    <PrintInvoice
      invoice={invoice}
      items={items}
      caiData={caiData}
      printType={printType}
      simpleMode={simpleMode}
      ticketFooter={sysConfigMap.ticket_footer || null}
      businessEmail={sysConfigMap.business_email || null}
      businessName={sysConfigMap.business_name || null}
      businessPhone={sysConfigMap.business_phone || null}
      businessAddress={sysConfigMap.business_address || null}
      businessRtn={sysConfigMap.business_rtn || null}
      cashRegisterNumber={sysConfigMap.cash_register_number || null}
      cashierName={cashierName}
    />
  );
}
