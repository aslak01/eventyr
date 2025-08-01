import type { createPathHelper } from "../utils/paths";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

interface TableColumn {
  title: string;
}

interface TableRow {
  [key: string]: string | number;
}

export function sortableTableGenerator(
  columns: TableColumn[],
  rows: TableRow[],
  pathHelper: PathHelper,
  rowRenderer: (row: TableRow) => string,
): string {
  const tableHeaders = columns
    .map((column) => `<th>${column.title}</th>`)
    .join("");

  const tableRows = rows.map((row) => rowRenderer(row)).join("");

  return templateEngine.render("sortable-table.html", {
    tableHeaders,
    tableRows,
  });
}
