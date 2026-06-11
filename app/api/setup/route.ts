import { getDb, getClient } from "@/lib/db";
import { users, categories, caiConfigs, systemConfig } from "@/lib/schema";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const start = performance.now();
    const db = getDb();
    await db.run(sql`SELECT 1`);
    const latency = Math.round(performance.now() - start);
    return NextResponse.json({ status: "connected", latency });
  } catch (error) {
    return NextResponse.json({ status: "disconnected", error: error instanceof Error ? error.message : "Error de conexión" });
  }
}

export async function POST() {
  try {
    const db = getDb();
    
    // Create tables
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        tax_rate REAL DEFAULT 0.15,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        category_id INTEGER REFERENCES categories(id),
        purchase_price REAL NOT NULL,
        sale_price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 5,
        unit TEXT DEFAULT 'unidad',
        image TEXT,
        is_taxable INTEGER DEFAULT 1,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add image column if upgrading from older version
    try { await db.run(sql`ALTER TABLE products ADD COLUMN image TEXT`); } catch {}

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS cai_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cai TEXT NOT NULL UNIQUE,
        rtn TEXT NOT NULL,
        business_name TEXT NOT NULL,
        business_address TEXT,
        phone TEXT,
        range_start INTEGER NOT NULL,
        range_end INTEGER NOT NULL,
        current_number INTEGER NOT NULL,
        prefix TEXT DEFAULT '000-001-01',
        expiry_date TEXT NOT NULL,
        active INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL UNIQUE,
        cai_id INTEGER REFERENCES cai_configs(id),
        customer_name TEXT DEFAULT 'Consumidor Final',
        customer_rtn TEXT,
        subtotal REAL NOT NULL,
        tax_exempt REAL DEFAULT 0,
        taxable_15 REAL DEFAULT 0,
        taxable_18 REAL DEFAULT 0,
        tax_15 REAL DEFAULT 0,
        tax_18 REAL DEFAULT 0,
        total REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'efectivo',
        cash_received REAL,
        change_amount REAL,
        status TEXT DEFAULT 'activa',
        voided_reason TEXT,
        user_id INTEGER REFERENCES users(id),
        cash_register_id INTEGER REFERENCES cash_registers(id),
        type TEXT DEFAULT 'factura',
        receipt_number TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_code TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        tax_rate REAL DEFAULT 0,
        subtotal REAL NOT NULL,
        tax_amount REAL DEFAULT 0,
        total REAL NOT NULL
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS daily_closings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        closing_date TEXT NOT NULL UNIQUE,
        total_sales REAL NOT NULL,
        total_cash REAL NOT NULL,
        total_card REAL NOT NULL,
        total_transfer REAL NOT NULL,
        total_invoices INTEGER NOT NULL,
        total_voided INTEGER DEFAULT 0,
        user_id INTEGER REFERENCES users(id),
        cash_register_id INTEGER REFERENCES cash_registers(id),
        cashier_name TEXT,
        notes TEXT,
        cancelled_at TEXT,
        cancellation_reason TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        rtn TEXT,
        address TEXT,
        phone TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER REFERENCES suppliers(id),
        supplier_invoice TEXT,
        supplier_name TEXT NOT NULL,
        supplier_rtn TEXT,
        supplier_address TEXT,
        supplier_phone TEXT,
        subtotal REAL NOT NULL,
        total REAL NOT NULL,
        supplier_invoice_photo TEXT,
        notes TEXT,
        user_id INTEGER REFERENCES users(id),
        purchase_type TEXT DEFAULT 'comprobante',
        supplier_cai TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER NOT NULL REFERENCES purchases(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        purchase_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        total REAL NOT NULL,
        expiry_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS cash_registers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        opening_amount REAL NOT NULL DEFAULT 0,
        opening_time TEXT DEFAULT CURRENT_TIMESTAMP,
        closing_amount REAL,
        closing_time TEXT,
        expected_cash REAL,
        actual_cash REAL,
        difference REAL,
        card_sales REAL,
        transfer_sales REAL,
        total_sales REAL,
        total_invoices INTEGER,
        status TEXT DEFAULT 'abierta',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    // Add new columns to existing tables
    try { await db.run(sql`ALTER TABLE invoices ADD COLUMN cash_register_id INTEGER REFERENCES cash_registers(id)`); } catch {}
    try { await db.run(sql`ALTER TABLE daily_closings ADD COLUMN cash_register_id INTEGER REFERENCES cash_registers(id)`); } catch {}
    try { await db.run(sql`ALTER TABLE daily_closings ADD COLUMN cashier_name TEXT`); } catch {}
    try { await db.run(sql`ALTER TABLE daily_closings ADD COLUMN cancelled_at TEXT`); } catch {}
    try { await db.run(sql`ALTER TABLE daily_closings ADD COLUMN cancellation_reason TEXT`); } catch {}
    try { await db.run(sql`ALTER TABLE cash_registers ADD COLUMN difference REAL`); } catch {}
    try { await db.run(sql`ALTER TABLE invoices ADD COLUMN type TEXT DEFAULT 'factura'`); } catch {}
    try { await db.run(sql`ALTER TABLE invoices ADD COLUMN receipt_number TEXT`); } catch {}
    try { await db.run(sql`ALTER TABLE purchases ADD COLUMN purchase_type TEXT DEFAULT 'comprobante'`); } catch {}
    try { await db.run(sql`ALTER TABLE purchases ADD COLUMN supplier_cai TEXT`); } catch {}

    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(created_at)`);

    // Check if admin exists
    const existingAdmin = await db.select().from(users).limit(1);
    
    if (existingAdmin.length === 0) {
      // Create default admin user
      const hashedPassword = await hash("admin123", 10);
      await db.insert(users).values({
        username: "admin",
        passwordHash: hashedPassword,
        name: "Administrador",
        role: "admin",
      });

      // Create default category
      await db.insert(categories).values({
        name: "General",
        taxRate: 0.15,
      });

      // Create default system config
      await db.insert(systemConfig).values([
        { key: "business_name", value: "Mi Bodega" },
        { key: "business_address", value: "Dirección del negocio" },
        { key: "business_phone", value: "0000-0000" },
        { key: "business_email", value: "correo@ejemplo.com" },
        { key: "ticket_footer", value: "Gracias por su compra" },
        { key: "printer_type", value: "thermal" },
        { key: "cash_register_number", value: "1" },
      ]);

      // Create sample CAI configuration if none exists
      const existingCai = await db.select().from(caiConfigs).limit(1);
      if (existingCai.length === 0) {
        await db.run(sql`
          INSERT INTO cai_configs (cai, rtn, business_name, business_address, phone, range_start, range_end, current_number, prefix, expiry_date, active)
          VALUES ('DEMO-8X3B-7A2C-4D9E-1F5G', '00000000000000', 'Mi Bodega', 'Dirección del negocio', '0000-0000', 1, 1000, 1, '000-001-01', '2027-12-31', 1)
        `);
      }
    }

    return NextResponse.json({ success: true, message: "Base de datos configurada correctamente" });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
