// Hand-rolled CSV parser (no dependencies).
//
// Handles:
// - quoted fields containing commas, newlines, and "" escaped quotes
// - CRLF and LF line endings
// - fully-empty lines are skipped
// Returns rows of cells; the first row is the header row.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  const pushRow = (): void => {
    row.push(cell);
    cell = "";
    // Skip fully-empty lines (every cell empty or whitespace-only).
    if (row.some((c) => c.trim() !== "")) {
      rows.push(row);
    }
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        cell += ch;
        i += 1;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
    } else if (ch === "\r" || ch === "\n") {
      pushRow();
      // Consume CRLF as a single line break.
      if (ch === "\r" && text[i + 1] === "\n") {
        i += 2;
      } else {
        i += 1;
      }
    } else {
      cell += ch;
      i += 1;
    }
  }

  // Flush a final line that has no trailing newline (e.g. at EOF).
  if (inQuotes || cell !== "" || row.length > 0) {
    pushRow();
  }

  return rows;
}

// Maps data rows to header-keyed objects. Headers are trimmed;
// missing cells become "".
export function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) {
    return [];
  }
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((h, idx) => [h, cells[idx] ?? ""])),
  );
}
