import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// Usuarios del sistema
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("admin"),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

// Categorías de productos
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  taxRate: real("tax_rate").notNull().default(0.15),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

// Productos
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull(),
  barcode: text("barcode").unique(),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: integer("category_id").references(() => categories.id),
  purchasePrice: real("purchase_price").notNull(),
  salePrice: real("sale_price").notNull(),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(5),
  unit: text("unit").notNull().default("unidad"),
  image: text("image"),
  isTaxable: integer("is_taxable", { mode: "boolean" }).notNull().default(true),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

// CAI Configs (Constancia de Autorización de Impresión)
export const caiConfigs = sqliteTable("cai_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cai: text("cai").unique().notNull(),
  rtn: text("rtn").notNull(),
  businessName: text("business_name").notNull(),
  businessAddress: text("business_address"),
  phone: text("phone"),
  rangeStart: integer("range_start").notNull(),
  rangeEnd: integer("range_end").notNull(),
  currentNumber: integer("current_number").notNull(),
  prefix: text("prefix").notNull().default("000-001-01"),
  expiryDate: text("expiry_date").notNull(),
  active: integer("active").notNull().default(0),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

// Facturas
export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNumber: text("invoice_number").unique().notNull(),
  caiId: integer("cai_id").references(() => caiConfigs.id),
  customerName: text("customer_name").notNull().default("Consumidor Final"),
  customerRtn: text("customer_rtn"),
  subtotal: real("subtotal").notNull(),
  taxExempt: real("tax_exempt").notNull().default(0),
  taxable15: real("taxable_15").notNull().default(0),
  taxable18: real("taxable_18").notNull().default(0),
  tax15: real("tax_15").notNull().default(0),
  tax18: real("tax_18").notNull().default(0),
  total: real("total").notNull(),
  paymentMethod: text("payment_method").notNull(), // 'efectivo', 'tarjeta', 'transferencia'
  cashReceived: real("cash_received"),
  changeAmount: real("change_amount"),
  status: text("status").notNull().default("activa"), // 'activa', 'anulada'
  voidedReason: text("voided_reason"),
  userId: integer("user_id").references(() => users.id),
  cashRegisterId: integer("cash_register_id").references(() => cashRegisters.id),
  type: text("type").notNull().default("factura"),
  receiptNumber: text("receipt_number"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

// Detalle de facturas
export const invoiceItems = sqliteTable("invoice_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  productId: integer("product_id").notNull().references(() => products.id),
  productCode: text("product_code").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  taxRate: real("tax_rate").notNull().default(0),
  subtotal: real("subtotal").notNull(),
  taxAmount: real("tax_amount").notNull().default(0),
  total: real("total").notNull(),
});

// Cierres de caja diarios
export const dailyClosings = sqliteTable("daily_closings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  closingDate: text("closing_date").unique().notNull(),
  totalSales: real("total_sales").notNull(),
  totalCash: real("total_cash").notNull(),
  totalCard: real("total_card").notNull(),
  totalTransfer: real("total_transfer").notNull(),
  totalInvoices: integer("total_invoices").notNull(),
  totalVoided: integer("total_voided").notNull().default(0),
  userId: integer("user_id").references(() => users.id),
  cashRegisterId: integer("cash_register_id"),
  cashierName: text("cashier_name"),
  notes: text("notes"),
  cancelledAt: text("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

// Apertura/Cierre de caja
export const cashRegisters = sqliteTable("cash_registers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  openingAmount: real("opening_amount").notNull().default(0),
  openingTime: text("opening_time").notNull().default("CURRENT_TIMESTAMP"),
  closingAmount: real("closing_amount"),
  closingTime: text("closing_time"),
  expectedCash: real("expected_cash"),
  actualCash: real("actual_cash"),
  difference: real("difference"),
  cardSales: real("card_sales"),
  transferSales: real("transfer_sales"),
  totalSales: real("total_sales"),
  totalInvoices: integer("total_invoices"),
  status: text("status").notNull().default("abierta"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

// Proveedores
export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  rtn: text("rtn"),
  address: text("address"),
  phone: text("phone"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

// Compras a proveedores
export const purchases = sqliteTable("purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  supplierInvoice: text("supplier_invoice"),
  supplierName: text("supplier_name").notNull(),
  supplierRtn: text("supplier_rtn"),
  supplierAddress: text("supplier_address"),
  supplierPhone: text("supplier_phone"),
  subtotal: real("subtotal").notNull(),
  total: real("total").notNull(),
  notes: text("notes"),
  supplierInvoicePhoto: text("supplier_invoice_photo"),
  userId: integer("user_id").references(() => users.id),
  purchaseType: text("purchase_type").notNull().default("comprobante"),
  supplierCai: text("supplier_cai"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

// Detalle de compras
export const purchaseItems = sqliteTable("purchase_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseId: integer("purchase_id").notNull().references(() => purchases.id),
  productId: integer("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(),
  quantity: real("quantity").notNull(),
  purchasePrice: real("purchase_price").notNull(),
  subtotal: real("subtotal").notNull(),
  total: real("total").notNull(),
  expiryDate: text("expiry_date"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

// Configuración del sistema
export const systemConfig = sqliteTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

// Relaciones
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  invoiceItems: many(invoiceItems),
}));

export const caiConfigsRelations = relations(caiConfigs, ({ many }) => ({
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  caiConfig: one(caiConfigs, {
    fields: [invoices.caiId],
    references: [caiConfigs.id],
  }),
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  product: one(products, {
    fields: [invoiceItems.productId],
    references: [products.id],
  }),
}));

export const dailyClosingsRelations = relations(dailyClosings, ({ one }) => ({
  user: one(users, {
    fields: [dailyClosings.userId],
    references: [users.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchases: many(purchases),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchases.supplierId],
    references: [suppliers.id],
  }),
  user: one(users, {
    fields: [purchases.userId],
    references: [users.id],
  }),
  items: many(purchaseItems),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  product: one(products, {
    fields: [purchaseItems.productId],
    references: [products.id],
  }),
}));

export const cashRegistersRelations = relations(cashRegisters, ({ one }) => ({
  user: one(users, {
    fields: [cashRegisters.userId],
    references: [users.id],
  }),
}));

// Tipos TypeScript inferidos
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type CaiConfig = typeof caiConfigs.$inferSelect;
export type NewCaiConfig = typeof caiConfigs.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
export type DailyClosing = typeof dailyClosings.$inferSelect;
export type NewDailyClosing = typeof dailyClosings.$inferInsert;
export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type Purchase = typeof purchases.$inferSelect;
export type NewPurchase = typeof purchases.$inferInsert;
export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type NewPurchaseItem = typeof purchaseItems.$inferInsert;
export type CashRegister = typeof cashRegisters.$inferSelect;
export type NewCashRegister = typeof cashRegisters.$inferInsert;
export type SystemConfig = typeof systemConfig.$inferSelect;
export type NewSystemConfig = typeof systemConfig.$inferInsert;
