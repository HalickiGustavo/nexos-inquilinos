// jsPDF é pesado (~400KB). Importação dinâmica só quando o usuário clica em "baixar PDF".
export async function downloadPdf(filename: string, lines: string[]) {
  const { jsPDF } = await import("jspdf");
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
