import { templateEngine } from "../utils/template-engine";

interface TableColumn {
  title: string;
}

export function sortableTableGenerator<Row>(
  columns: TableColumn[],
  rows: Row[],
  rowRenderer: (row: Row) => string,
): string {
  const tableHeaders = columns
    .map((column) => `<th class="${column.title}">${column.title}</th>`)
    .join("");

  const tableRows = rows.map((row) => rowRenderer(row)).join("");

  return templateEngine.render("sortable-table.html", {
    tableHeaders,
    tableRows,
  });
}
