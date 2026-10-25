const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  return `"${(/^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
};
export function downloadDatasetCsv(
  name: string,
  records: Record<string, unknown>[],
  metadata: Record<string, unknown>,
) {
  const rows = records.map((record) => ({ ...metadata, ...record }));
  const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const content = [
    fields,
    ...rows.map((row) => fields.map((field) => row[field as keyof typeof row])),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `ops-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
