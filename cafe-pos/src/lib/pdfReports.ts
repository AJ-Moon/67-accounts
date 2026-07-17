'use client';

/**
 * Client-side PDF generation for reports (jsPDF + autotable).
 * Fetches /api/reports/export and downloads a formatted PDF.
 */
export async function downloadReportPdf(
  type: 'sales_daily' | 'sales_monthly' | 'sales_orders' | 'ledger' | 'expenses' | 'wastage',
  opts: { from?: string; to?: string; shopName?: string } = {}
) {
  const params = new URLSearchParams({ type });
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);

  const res = await fetch(`/api/reports/export?${params.toString()}`);
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || 'Failed to fetch report data');
  }
  const report = await res.json();

  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16).setFont('helvetica', 'bold');
  doc.text(opts.shopName || '67 Café', 40, 46);
  doc.setFontSize(11).setFont('helvetica', 'normal');
  doc.text(report.title, 40, 64);
  doc.setFontSize(8).setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageWidth - 40, 46, { align: 'right' });
  doc.setTextColor(0);

  // Table
  autoTable(doc, {
    startY: 80,
    head: [report.columns],
    body: report.rows.length > 0 ? report.rows : [['— No data in this range —']],
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 248, 250] },
    margin: { left: 40, right: 40 },
  });

  // Summary
  const endY = (doc as any).lastAutoTable?.finalY || 90;
  let y = endY + 18;
  doc.setFontSize(9).setFont('helvetica', 'bold');
  doc.text('Summary', 40, y);
  doc.setFont('helvetica', 'normal');
  const countKeys = ['Orders', 'Entries', 'Records', 'Expenses'];
  Object.entries(report.summary || {}).forEach(([k, v]) => {
    y += 14;
    doc.text(`${k}:`, 40, y);
    const isCount = countKeys.includes(k);
    const num = Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
    doc.text(isCount ? String(v) : `Rs ${num}`, 140, y);
  });

  // Page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(150);
    doc.text(`Page ${i} of ${pages}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`${type}-${stamp}.pdf`);
}
