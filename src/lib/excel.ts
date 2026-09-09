import * as XLSX from "xlsx";
import type { Payment, ZakatYear } from "./types";
import { longDate, stamp, yearTag, yearRange } from "./format";

type Bundle = { year: ZakatYear; payments: Payment[] };

/**
 * Three views of the same data: totals per year, every line item across all
 * years in one sortable list, and a tab per year for reading one at a time.
 */
export function downloadWorkbook(who: string, bundles: Bundle[]) {
  const book = XLSX.utils.book_new();

  /* ---- Summary ---- */
  const summary = bundles.map(({ year, payments }) => {
    const given = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const due = Number(year.due_amount);
    return {
      "Zakat year": yearTag(year.start_date, year.end_date),
      Period: yearRange(year.start_date, year.end_date),
      "Amount due (PKR)": due,
      "Amount given (PKR)": given,
      "Remaining (PKR)": Math.max(0, due - given),
      Status: given >= due && due > 0 ? "Fully paid" : "Pending",
      Entries: payments.length,
    };
  });

  const totalDue = bundles.reduce((s, b) => s + Number(b.year.due_amount), 0);
  const totalGiven = bundles.reduce(
    (s, b) => s + b.payments.reduce((x, p) => x + Number(p.amount), 0),
    0
  );
  summary.push({
    "Zakat year": "All years",
    Period: "",
    "Amount due (PKR)": totalDue,
    "Amount given (PKR)": totalGiven,
    "Remaining (PKR)": Math.max(0, totalDue - totalGiven),
    Status: "",
    Entries: bundles.reduce((s, b) => s + b.payments.length, 0),
  });

  const summarySheet = XLSX.utils.json_to_sheet(summary);
  summarySheet["!cols"] = [
    { wch: 13 }, { wch: 30 }, { wch: 18 },
    { wch: 19 }, { wch: 17 }, { wch: 12 }, { wch: 9 },
  ];
  XLSX.utils.book_append_sheet(book, summarySheet, "Summary");

  /* ---- Every line item, all years ---- */
  const all = bundles.flatMap(({ year, payments }) =>
    payments.map((p) => ({
      "Zakat year": yearTag(year.start_date, year.end_date),
      "Date given": longDate(p.paid_on),
      "Amount (PKR)": Number(p.amount),
      "Given to": p.description ?? "",
      "Year starts": longDate(year.start_date),
      "Year ends": longDate(year.end_date),
      "Recorded at": stamp(p.created_at),
      "Recorded from": p.device ?? "",
    }))
  );

  const allSheet = XLSX.utils.json_to_sheet(
    all.length
      ? all
      : [{
          "Zakat year": "", "Date given": "", "Amount (PKR)": "",
          "Given to": "", "Year starts": "", "Year ends": "",
          "Recorded at": "", "Recorded from": "",
        }]
  );
  allSheet["!cols"] = [
    { wch: 13 }, { wch: 15 }, { wch: 15 }, { wch: 42 },
    { wch: 15 }, { wch: 15 }, { wch: 22 }, { wch: 20 },
  ];
  allSheet["!autofilter"] = { ref: XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(1, all.length), c: 7 },
  }) };
  XLSX.utils.book_append_sheet(book, allSheet, "All entries");

  /* ---- One tab per year ---- */
  for (const { year, payments } of bundles) {
    const due = Number(year.due_amount);
    const given = payments.reduce((s, p) => s + Number(p.amount), 0);

    const rows: Record<string, string | number>[] = payments.map((p) => ({
      "Date given": longDate(p.paid_on),
      "Amount (PKR)": Number(p.amount),
      "Given to": p.description ?? "",
      "Recorded at": stamp(p.created_at),
      "Recorded from": p.device ?? "",
    }));

    rows.push({ "Date given": "", "Amount (PKR)": "", "Given to": "" });
    rows.push({ "Date given": "Total given", "Amount (PKR)": given, "Given to": "" });
    rows.push({ "Date given": "Amount due", "Amount (PKR)": due, "Given to": "" });
    rows.push({
      "Date given": "Remaining",
      "Amount (PKR)": Math.max(0, due - given),
      "Given to": given >= due && due > 0 ? "Fully paid" : "Pending",
    });

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 16 }, { wch: 15 }, { wch: 44 }, { wch: 22 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(
      book,
      sheet,
      yearTag(year.start_date, year.end_date).replace("–", "-")
    );
  }

  const today = new Date().toLocaleDateString("en-CA");
  const slug = who.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  XLSX.writeFile(book, `zakat-${slug || "ledger"}-${today}.xlsx`);
}
