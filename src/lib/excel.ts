import * as XLSX from "xlsx";
import type { Payment, ZakatYear } from "./types";
import { longDate } from "./format";

type Bundle = { year: ZakatYear; payments: Payment[] };

/**
 * One sheet per Zakat year plus a summary tab, so the download is useful
 * on its own without needing the app open beside it.
 */
export function downloadWorkbook(username: string, bundles: Bundle[]) {
  const book = XLSX.utils.book_new();

  const summary = bundles.map(({ year, payments }) => {
    const given = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    return {
      Year: `Year ${year.year_number}`,
      "Starts on": longDate(year.start_date),
      "Ends on": longDate(year.end_date),
      "Amount due (PKR)": Number(year.due_amount),
      "Amount given (PKR)": given,
      "Remaining (PKR)": Math.max(0, Number(year.due_amount) - given),
      Entries: payments.length,
    };
  });

  const summarySheet = XLSX.utils.json_to_sheet(summary);
  summarySheet["!cols"] = [
    { wch: 10 }, { wch: 15 }, { wch: 15 },
    { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 9 },
  ];
  XLSX.utils.book_append_sheet(book, summarySheet, "Summary");

  for (const { year, payments } of bundles) {
    const rows = payments.map((p) => ({
      Date: longDate(p.paid_on),
      "Amount (PKR)": Number(p.amount),
      Description: p.description ?? "",
    }));
    const sheet = XLSX.utils.json_to_sheet(
      rows.length ? rows : [{ Date: "", "Amount (PKR)": "", Description: "" }]
    );
    sheet["!cols"] = [{ wch: 15 }, { wch: 15 }, { wch: 46 }];
    XLSX.utils.book_append_sheet(book, sheet, `Year ${year.year_number}`);
  }

  const stamp = new Date().toLocaleDateString("en-CA");
  XLSX.writeFile(book, `zakat-${username}-${stamp}.xlsx`);
}
