import { getDb } from "@/lib/db";
import { invoices, invoiceItems, products, caiConfigs, systemConfig, cashRegisters } from "@/lib/schema";
import { eq, and, desc, gte, lte, sql, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { formatInvoiceNumber, getLocalDateString, getLocalDateTimeString } from "@/lib/utils/format";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    let conditions = [];
    
    if (startDate) {
      conditions.push(gte(invoices.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(invoices.createdAt, endDate + " 23:59:59"));
    }
    if (status && status !== "all") {
      conditions.push(eq(invoices.status, status));
    }

    const allInvoices = await db
      .select()
      .from(invoices)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(invoices.createdAt))
      .limit(100);

    // Filter by search if provided (invoice number or customer name)
    let filtered = allInvoices;
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = allInvoices.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(searchLower) ||
          inv.customerName?.toLowerCase().includes(searchLower) ||
          inv.customerRtn?.includes(search)
      );
    }

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json({ error: "Error al obtener facturas" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const data = await request.json();
    const invoiceType = data.type === "factura" ? "factura" : "comprobante";

    // Check for system datetime override
    const [sysDtCfg] = await db.select().from(systemConfig).where(eq(systemConfig.key, "system_date")).limit(1);
    const effectiveDate = sysDtCfg && sysDtCfg.value ? sysDtCfg.value : getLocalDateString();
    const [sysTmCfg] = await db.select().from(systemConfig).where(eq(systemConfig.key, "system_time")).limit(1);
    const effectiveTime = sysTmCfg && sysTmCfg.value ? sysTmCfg.value : getLocalDateTimeString().split(" ")[1];
    const effectiveDateTime = `${effectiveDate} ${effectiveTime}`;

    // Check if today is closed
    const config = await db.select().from(systemConfig).where(eq(systemConfig.key, "closed_dates"));
    if (config.length > 0) {
      const closedDates: string[] = JSON.parse(config[0].value);
      if (closedDates.includes(effectiveDate)) {
        return NextResponse.json(
          { error: "El día de hoy está cerrado. No se pueden emitir más facturas." },
          { status: 400 }
        );
      }
    }

    // Check if there's an open cash register
    const [activeRegister] = await db
      .select()
      .from(cashRegisters)
      .where(eq(cashRegisters.status, "abierta"))
      .limit(1);

    if (!activeRegister) {
      return NextResponse.json(
        { error: "No hay una caja abierta. Debe abrir caja antes de realizar ventas." },
        { status: 400 }
      );
    }

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ error: "La factura debe tener al menos un producto" }, { status: 400 });
    }

    // Calculate totals
    let taxExempt = 0;
    let taxable15 = 0;
    let taxable18 = 0;

    for (const item of data.items) {
      const subtotal = item.quantity * item.unitPrice;
      if (item.taxRate === 0) {
        taxExempt += subtotal;
      } else if (item.taxRate === 18) {
        taxable18 += subtotal;
      } else {
        taxable15 += subtotal;
      }
    }

    const tax15 = taxable15 * 0.15;
    const tax18 = taxable18 * 0.18;
    const subtotal = taxExempt + taxable15 + taxable18;
    const total = subtotal + tax15 + tax18;

    let invoiceNumber: string;
    let caiId: number | null = null;
    let receiptNumber: string | null = null;
    let activeCai: any = null;

    if (invoiceType === "factura") {
      // Get active CAI
      const [cai] = await db
        .select()
        .from(caiConfigs)
        .where(eq(caiConfigs.active, 1))
        .limit(1);

      if (!cai) {
        return NextResponse.json(
          { error: "No hay CAI activo configurado. Configure uno en la sección de CAI." },
          { status: 400 }
        );
      }

      // Check if CAI is expired
      const caiExpiry = new Date(cai.expiryDate + "T23:59:59-06:00");
      const effDt = new Date(effectiveDateTime.replace(" ", "T") + "-06:00");
      if (caiExpiry < effDt) {
        return NextResponse.json(
          { error: "El CAI activo ha vencido. Configure uno nuevo." },
          { status: 400 }
        );
      }

      // Check if we still have numbers available
      if (cai.currentNumber > cai.rangeEnd) {
        return NextResponse.json(
          { error: "Se agotó el rango de facturas del CAI activo. Configure uno nuevo." },
          { status: 400 }
        );
      }

      activeCai = cai;
      caiId = cai.id;
      invoiceNumber = formatInvoiceNumber(cai.prefix, cai.currentNumber);
    } else {
      // Comprobante simple: get or create receipt counter
      const [counterCfg] = await db.select().from(systemConfig).where(eq(systemConfig.key, "receipt_counter")).limit(1);
      let nextCounter = 1;
      if (counterCfg) {
        nextCounter = parseInt(counterCfg.value) + 1;
      }
      receiptNumber = String(nextCounter).padStart(6, "0");
      invoiceNumber = `C-${receiptNumber}`;

      // Save incremented counter
      if (counterCfg) {
        await db.update(systemConfig)
          .set({ value: String(nextCounter), updatedAt: getLocalDateTimeString() })
          .where(eq(systemConfig.key, "receipt_counter"));
      } else {
        await db.insert(systemConfig).values({
          key: "receipt_counter",
          value: String(nextCounter),
        });
      }
    }

    // Ensure new columns exist (backward compatibility)
    try { await db.run(sql`ALTER TABLE invoices ADD COLUMN type TEXT DEFAULT 'factura'`); } catch {}
    try { await db.run(sql`ALTER TABLE invoices ADD COLUMN receipt_number TEXT`); } catch {}

    // Create invoice (raw SQL to avoid returning() issues with Turso auto-increment)
    await db.run(sql`
      INSERT INTO invoices (invoice_number, cai_id, customer_name, customer_rtn, subtotal, tax_exempt, taxable_15, taxable_18, tax_15, tax_18, total, payment_method, cash_received, change_amount, status, type, receipt_number, user_id, cash_register_id, created_at)
      VALUES (${invoiceNumber}, ${caiId}, ${data.customerName || "Consumidor Final"}, ${data.customerRtn || null}, ${subtotal}, ${taxExempt}, ${taxable15}, ${taxable18}, ${tax15}, ${tax18}, ${total}, ${data.paymentMethod || "efectivo"}, ${data.cashReceived || null}, ${data.changeAmount || null}, 'activa', ${invoiceType}, ${receiptNumber}, ${session.id}, ${activeRegister.id}, ${effectiveDateTime})
    `);

    const [newInvoice] = await db.select().from(invoices).orderBy(desc(invoices.id)).limit(1);

    // Create invoice items and update stock
    for (const item of data.items) {
      const itemSubtotal = item.quantity * item.unitPrice;
      const taxAmount = itemSubtotal * (item.taxRate / 100);

      await db.insert(invoiceItems).values({
        invoiceId: newInvoice.id,
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        subtotal: itemSubtotal,
        taxAmount,
        total: itemSubtotal + taxAmount,
      });

      // Decrease stock
      if (item.productId) {
        await db.run(sql`
          UPDATE products 
          SET stock = stock - ${item.quantity}, updated_at = ${getLocalDateTimeString()}
          WHERE id = ${item.productId}
        `);
      }
    }

    // Increment CAI current number only for facturas
    if (invoiceType === "factura" && activeCai) {
      await db.update(caiConfigs)
        .set({ currentNumber: activeCai.currentNumber + 1 })
        .where(eq(caiConfigs.id, activeCai.id));
    }

    // Get system config for ticket footer, email, etc.
    const sysConfigRows = await db.select().from(systemConfig).where(
      inArray(systemConfig.key, ["ticket_footer", "business_email"])
    );
    const sysConfigMap: Record<string, string> = {};
    sysConfigRows.forEach((c) => { sysConfigMap[c.key] = c.value; });

    // Build response
    const response: any = {
      ...newInvoice,
      ticketFooter: sysConfigMap.ticket_footer || null,
      businessEmail: sysConfigMap.business_email || null,
    };

    if (invoiceType === "factura" && activeCai) {
      response.cai = activeCai.cai;
      response.caiExpiryDate = activeCai.expiryDate;
      response.rtn = activeCai.rtn;
      response.businessName = activeCai.businessName;
      response.businessAddress = activeCai.businessAddress;
      response.phone = activeCai.phone;
      response.rangeStart = activeCai.rangeStart;
      response.rangeEnd = activeCai.rangeEnd;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json({ error: "Error al crear factura" }, { status: 500 });
  }
}
