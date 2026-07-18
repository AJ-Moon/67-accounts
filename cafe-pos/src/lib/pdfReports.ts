'use client';

/**
 * Client-side report exports (PDF via jsPDF, Excel via SheetJS).
 * Both fetch the same /api/reports/export data.
 */
export type ReportType = 'sales_daily' | 'sales_monthly' | 'sales_orders' | 'ledger' | 'expenses' | 'wastage';
export type ReportOpts = { from?: string; to?: string; shopName?: string; account?: string };

async function fetchReport(type: ReportType, opts: ReportOpts) {
  const params = new URLSearchParams({ type });
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.account) params.set('account', opts.account);

  const res = await fetch(`/api/reports/export?${params.toString()}`);
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || 'Failed to fetch report data');
  }
  return res.json();
}

function fileStamp(type: ReportType, opts: ReportOpts, ext: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${type}${opts.account ? `-${opts.account}` : ''}-${stamp}.${ext}`;
}

/** Download the report as an Excel (.xlsx) file. */
export async function downloadReportXlsx(type: ReportType, opts: ReportOpts = {}) {
  const report = await fetchReport(type, opts);
  const XLSX = await import('xlsx');

  const aoa: any[][] = [
    [opts.shopName || '67 Café'],
    [report.title],
    [`Generated ${new Date().toLocaleString()}`],
    [],
    report.columns,
    ...report.rows,
    [],
    ['SUMMARY'],
    ...Object.entries(report.summary || {}).map(([k, v]) => [k, v]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = report.columns.map((c: string, i: number) => ({
    wch: Math.max(c.length + 2, ...report.rows.map((r: any[]) => String(r[i] ?? '').length + 2), 10),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, report.title.slice(0, 31).replace(/[\\/?*[\]:]/g, '-'));
  XLSX.writeFile(wb, fileStamp(type, opts, 'xlsx'));
}

/** Download the report as a formatted PDF. */
export async function downloadReportPdf(type: ReportType, opts: ReportOpts = {}) {
  const report = await fetchReport(type, opts);

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

  doc.save(fileStamp(type, opts, 'pdf'));
}
