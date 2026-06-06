import { jsPDF } from "jspdf";

export function downloadPdf(filename: string, lines: string[]) {
  const doc = new jsPDF();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  let y = 20;
  lines.forEach((line) => {
    const chunks = doc.splitTextToSize(line, 170);
    chunks.forEach((c: string) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(c, 20, y);
      y += 7;
    });
  });
  doc.save(filename);
}
