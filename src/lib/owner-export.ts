import { formatBRL, formatDate } from "@/lib/format";
import { downloadPdf } from "@/lib/pdf";

export type StatementEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  kind: "receita" | "taxa" | "manutencao" | "repasse";
  method?: "pix" | "boleto" | null;
  description: string;
  propertyName?: string;
  amount: number; // signed: + entrada, - saída
};

const KIND_LABEL: Record<StatementEntry["kind"], string> = {
  receita: "Receita",
  taxa: "Taxa",
  manutencao: "Manutenção",
  repasse: "Repasse",
};

function csvEscape(v: string) {
  if (/[",\n;]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function downloadStatementCsv(filename: string, entries: StatementEntry[]) {
  const header = ["Data", "Tipo", "Descrição", "Imóvel", "Método", "Valor"];
  const lines = [header.join(";")];
  for (const e of entries) {
    lines.push(
      [
        formatDate(e.date),
        KIND_LABEL[e.kind],
        csvEscape(e.description),
        csvEscape(e.propertyName ?? ""),
        e.method ?? "",
        e.amount.toFixed(2).replace(".", ","),
      ].join(";"),
    );
  }
  const blob = new Blob(["\ufeff" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadStatementPdf(
  filename: string,
  title: string,
  entries: StatementEntry[],
) {
  const lines: string[] = [];
  lines.push(title);
  lines.push("");
  const total = entries.reduce((s, e) => s + e.amount, 0);
  lines.push(`Total de lançamentos: ${entries.length}`);
  lines.push(`Saldo do período: ${formatBRL(total)}`);
  lines.push("");
  lines.push("Data       | Tipo        | Imóvel                | Descrição                | Valor");
  lines.push("-".repeat(100));
  for (const e of entries) {
    const row = [
      formatDate(e.date).padEnd(10),
      KIND_LABEL[e.kind].padEnd(11),
      (e.propertyName ?? "—").slice(0, 21).padEnd(22),
      e.description.slice(0, 24).padEnd(25),
      (e.amount >= 0 ? "+ " : "- ") + formatBRL(Math.abs(e.amount)),
    ].join(" | ");
    lines.push(row);
  }
  await downloadPdf(filename, lines);
}
