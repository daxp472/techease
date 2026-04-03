const escapeCSVCell = (value: unknown) => {
  const stringValue = String(value ?? '');
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const exportToCSV = (
  fileName: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
) => {
  const csvContent = [headers.map(escapeCSVCell).join(','), ...rows.map((row) => row.map(escapeCSVCell).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.setAttribute('download', fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportTableAsPrintPDF = (title: string, tableHTML: string) => {
  const popup = window.open('', '_blank', 'width=900,height=700');
  if (!popup) {
    return;
  }

  popup.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
          h1 { font-size: 20px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background: #f1f5f9; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${tableHTML}
      </body>
    </html>
  `);

  popup.document.close();
  popup.focus();
  popup.print();
};
