// jsPDF é pesado (~400KB). Importação dinâmica só quando o usuário clica em "baixar PDF".
export async function downloadPdf(filename: string, lines: string[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  
  // NEXO Header
  doc.setFillColor(59, 130, 246); // Primary blue
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("NEXO", 20, 25);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório Administrativo Gerencial", 20, 32);
  
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(11);
  let y = 55;
  
  lines.forEach((line) => {
    if (line.startsWith("---")) {
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(59, 130, 246);
      doc.text(line.replace(/-/g, ""), 20, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      return;
    }

    if (!line.trim()) {
      y += 5;
      return;
    }

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
  
  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} | Página ${i} de ${pageCount}`, 20, 290);
  }
  
  doc.save(filename);
}

