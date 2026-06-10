// Honduras uses Lempiras (HNL)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("es-HN").format(num);
}

function parseDate(date: Date | string): Date {
  if (typeof date === "string") {
    // SQLite stores "2026-06-01 14:30:00" in Honduras time (UTC-6)
    // Append -06:00 so JS treats it as local Honduras time, not UTC
    let iso: string;
    if (date.includes(" ")) {
      iso = date.replace(" ", "T") + "-06:00";
    } else {
      // Date-only string like "2026-06-01" — treat as Honduras midnight
      iso = date + "T00:00:00-06:00";
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) return new Date();
    return d;
  }
  return date;
}

export function formatDate(date: Date | string): string {
  const d = parseDate(date);
  return new Intl.DateTimeFormat("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = parseDate(date);
  return new Intl.DateTimeFormat("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatInvoiceNumber(prefix: string, number: number): string {
  return `${prefix}-${number.toString().padStart(8, "0")}`;
}

// Validate RTN format (Honduras tax ID)
export function validateRTN(rtn: string): boolean {
  const cleaned = rtn.replace(/[-\s]/g, "");
  return /^\d{14}$/.test(cleaned);
}

export function formatRTN(rtn: string): string {
  const cleaned = rtn.replace(/[-\s]/g, "");
  if (cleaned.length !== 14) return rtn;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
}

// Calculate ISV (Honduras tax)
export function calculateTax(subtotal: number, rate: number = 15): number {
  return subtotal * (rate / 100);
}

export function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

// Override date/time from system_config (used by admin setting)
let _systemDateOverride: string | null = null;

export function setSystemDateOverride(val: string | null) {
  _systemDateOverride = val;
}

export function getSystemDateOverride(): string | null {
  return _systemDateOverride;
}

function getHondurasDate(): Date {
  const now = new Date();
  // If a system date override is set, use it
  if (_systemDateOverride) {
    const [y, m, d] = _systemDateOverride.split("-").map(Number);
    const parts = _systemDateOverride.split(" ");
    if (parts.length > 1) {
      const [timeY, timeM, timeD] = parts[0].split("-").map(Number);
      const [h, min, s] = (parts[1] || "00:00:00").split(":").map(Number);
      return new Date(timeY, timeM - 1, timeD, h || 0, min || 0, s || 0);
    }
    return new Date(y, m - 1, d);
  }
  // Format the date using Honduras timezone (America/Tegucigalpa, UTC-6)
  const formatter = new Intl.DateTimeFormat("es-HN", {
    timeZone: "America/Tegucigalpa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || "0", 10);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

// Get local date string for SQLite queries (YYYY-MM-DD)
export function getLocalDateString(date?: Date): string {
  const d = date || getHondurasDate();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// Get local datetime string for SQLite storage (YYYY-MM-DD HH:MM:SS)
export function getLocalDateTimeString(date?: Date): string {
  const d = date || getHondurasDate();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0');
}
