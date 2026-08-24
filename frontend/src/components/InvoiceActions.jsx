import { useState } from 'react';
import { fetchInvoicePdfBlob } from '../api/invoices';
import { viewPdfBlob, printPdfBlob, downloadPdfBlob, sharePdfBlob } from '../utils/pdfActions';

export function InvoiceActions({ invoice }) {
  const [activeAction, setActiveAction] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const filename = `${invoice.invoiceNumber}.pdf`;

  async function run(action, handler) {
    setError('');
    setNotice('');
    setActiveAction(action);
    try {
      await handler();
    } catch (err) {
      setError(err.message);
    } finally {
      setActiveAction(null);
    }
  }

  const handleView = () =>
    run('view', async () => {
      const blob = await fetchInvoicePdfBlob(invoice._id);
      if (!viewPdfBlob(blob)) {
        setError('Your browser blocked the popup — please allow popups to view the PDF.');
      }
    });

  const handleDownload = () =>
    run('download', async () => {
      const blob = await fetchInvoicePdfBlob(invoice._id);
      downloadPdfBlob(blob, filename);
    });

  const handlePrint = () =>
    run('print', async () => {
      const blob = await fetchInvoicePdfBlob(invoice._id);
      if (!printPdfBlob(blob)) {
        setError('Your browser blocked the popup — please allow popups to print.');
      }
    });

  const handleShare = () =>
    run('share', async () => {
      const blob = await fetchInvoicePdfBlob(invoice._id);
      const result = await sharePdfBlob(blob, filename, invoice.invoiceNumber);
      if (result.cancelled) return;
      if (!result.shared) {
        downloadPdfBlob(blob, filename);
        setNotice('Share not supported on this browser — PDF downloaded instead.');
      }
    });

  const buttons = [
    { key: 'view', label: 'View PDF', busyLabel: 'Opening…', onClick: handleView },
    { key: 'download', label: 'Download', busyLabel: 'Downloading…', onClick: handleDownload },
    { key: 'print', label: 'Print', busyLabel: 'Preparing…', onClick: handlePrint },
    { key: 'share', label: 'Share', busyLabel: 'Sharing…', onClick: handleShare },
  ];

  return (
    <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-700">Invoice PDF</h2>

      {error && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {notice && (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {notice}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {buttons.map((btn) => (
          <button
            key={btn.key}
            onClick={btn.onClick}
            disabled={activeAction !== null}
            className="rounded-md border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-700 disabled:opacity-60"
          >
            {activeAction === btn.key ? btn.busyLabel : btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
