function escapeCsvCell(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows, columns, { delimiter = ";", includeHeader = true } = {}) {
  const lines = [];
  if (includeHeader) lines.push(columns.map((c) => escapeCsvCell(c.header)).join(delimiter));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(c.get(row))).join(delimiter));
  }
  return lines.join("\r\n") + "\r\n";
}

