import { parseCsv, rowsToObjects } from "./csv";

export interface InvoiceRecord {
  number: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  amountCents: number;
  dueDate: Date;
  notes?: string;
}

// line = 1-based CSV line number, including the header row.
export interface ImportError {
  line: number;
  message: string;
}

const EXPECTED_HEADERS = [
  "invoice_number",
  "customer_name",
  "customer_email",
  "customer_phone",
  "amount",
  "due_date",
  "notes",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Validates a single header-normalized row (keys lowercased + trimmed).
// Returns the record or a single human-readable error — never throws.
export function validateRow(
  row: Record<string, string>,
): { record?: InvoiceRecord; error?: string } {
  const get = (key: string): string => (row[key] ?? "").trim();

  const number = get("invoice_number");
  if (number === "") {
    return { error: "missing invoice_number" };
  }
  if (number.length > 100) return { error: "invoice_number must be 100 characters or fewer" };

  const customerName = get("customer_name");
  if (customerName === "") {
    return { error: "missing customer_name" };
  }
  if (customerName.length > 200) return { error: "customer_name must be 200 characters or fewer" };

  const rawAmount = get("amount");
  if (rawAmount === "") {
    return { error: "missing amount" };
  }
  const cleanedAmount = rawAmount.replace(/^\$/, "").replace(/,/g, "").trim();
  const dollars = Number(cleanedAmount);
  if (cleanedAmount === "" || !Number.isFinite(dollars) || dollars <= 0) {
    return {
      error: `invalid amount "${rawAmount}" — expected a number like 1250.00`,
    };
  }
  const amountCents = Math.round(dollars * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents > 2_000_000_000) return { error: "amount is too large" };

  const rawDate = get("due_date");
  if (rawDate === "") {
    return { error: "missing due_date" };
  }
  let dueDate: Date | undefined;
  const dateMatch = DATE_RE.exec(rawDate);
  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    // Reject dates that overflow into the next month (e.g. 2026-13-99).
    if (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    ) {
      dueDate = candidate;
    }
  }
  if (!dueDate) {
    return { error: `invalid due_date "${rawDate}" — expected YYYY-MM-DD` };
  }

  const email = get("customer_email");
  if (email !== "" && !EMAIL_RE.test(email)) {
    return {
      error: `invalid customer_email "${email}" — expected something like name@example.com`,
    };
  }

  const phone = get("customer_phone");
  if (phone !== "") {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return { error: `invalid customer_phone "${phone}"` };
  }
  const notes = get("notes");
  if (notes.length > 1000) return { error: "notes must be 1000 characters or fewer" };

  const record: InvoiceRecord = {
    number,
    customerName,
    amountCents,
    dueDate,
  };
  if (email !== "") {
    record.customerEmail = email.toLowerCase();
  }
  if (phone !== "") {
    record.customerPhone = phone;
  }
  if (notes !== "") {
    record.notes = notes;
  }
  return { record };
}

// Parses and validates a full CSV document. Collects ALL row errors and
// never throws on bad data. Line numbers are 1-based and include the
// header row (row index 0 -> line 2, etc.; blank lines are skipped by
// the parser, so line numbers assume no blank lines between rows).
export function importCsv(text: string): {
  records: InvoiceRecord[];
  errors: ImportError[];
} {
  let rows: string[][];
  try {
    rows = parseCsv(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      records: [],
      errors: [{ line: 1, message: `could not parse CSV: ${detail}` }],
    };
  }

  if (rows.length === 0) {
    return { records: [], errors: [{ line: 1, message: "empty file" }] };
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const headersMatch =
    headers.length === EXPECTED_HEADERS.length &&
    headers.every((h, idx) => h === EXPECTED_HEADERS[idx]);
  if (!headersMatch) {
    return {
      records: [],
      errors: [
        {
          line: 1,
          message: `unexpected headers — expected: ${EXPECTED_HEADERS.join(", ")}`,
        },
      ],
    };
  }

  // Normalize header keys (case-insensitive, trimmed) before validating.
  const normalizedRows = [
    rows[0].map((h) => h.trim().toLowerCase()),
    ...rows.slice(1),
  ];

  const records: InvoiceRecord[] = [];
  const errors: ImportError[] = [];
  const objects = rowsToObjects(normalizedRows);
  for (let idx = 0; idx < objects.length; idx++) {
    const obj = objects[idx];
    const line = idx + 2;
    const { record, error } = validateRow(obj);
    if (record) {
      records.push(record);
    } else if (error) {
      errors.push({ line, message: error });
    }
  }
  return { records, errors };
}
