import readXlsxFile from "read-excel-file/browser";
import { sheetKindFor } from "./mapping";
import type { SheetData } from "./validate";

/**
 * Reading a workbook in the browser.
 *
 * Here rather than in the wizard for two reasons. It is not component code —
 * nothing about it renders — and the library needs describing before it can be
 * called: `getSheets` is part of its runtime API and absent from its own
 * `Options` type, and the package has no root export, only `./browser`,
 * `./node`, `./universal` and `./web-worker`.
 *
 * One call returns every tab with its rows: `[{ sheet, data }]`, where
 * `data[0]` is the header row.
 */

interface WorkbookSheet {
  sheet: string;
  data: unknown[][];
}

type ReadWorkbook = (
  file: File,
  options: { getSheets: true },
) => Promise<WorkbookSheet[]>;

const readWorkbook = readXlsxFile as unknown as ReadWorkbook;

/**
 * The tabs we recognise, with their rows. A tab we do not recognise is left
 * out rather than guessed at — `sheetKindFor` answers null and that is an
 * answer, not a failure.
 */
export async function readImportSheets(file: File): Promise<SheetData[]> {
  const workbook = await readWorkbook(file, { getSheets: true });

  const sheets: SheetData[] = [];
  for (const entry of workbook) {
    const kind = sheetKindFor(entry.sheet);
    if (!kind) continue;
    const [header = [], ...rows] = entry.data;
    sheets.push({ kind, headers: header.map(String), rows });
  }
  return sheets;
}
