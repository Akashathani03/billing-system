export function viewPdfBlob(blob) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return Boolean(win);
}

/**
 * Opens the PDF in a new tab and best-effort triggers the browser's print
 * dialog on it — "Prefer opening the generated PDF ... and allowing the
 * device/browser print flow" rather than a custom print engine. If the
 * viewer can't be scripted (some mobile browsers), its own print control
 * still works — this never blocks that fallback.
 */
export function printPdfBlob(blob) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');

  if (win) {
    let printed = false;
    const tryPrint = () => {
      if (printed) return;
      printed = true;
      try {
        win.focus();
        win.print();
      } catch {
        // Not scriptable in this browser — the PDF viewer's own print
        // button is still available to the user.
      }
    };
    win.addEventListener('load', tryPrint);
    setTimeout(tryPrint, 800);
  }

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return Boolean(win);
}

export function downloadPdfBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Web Share API capability detection per spec: check navigator.share AND
 * navigator.canShare({files}) before attempting a file share — not every
 * browser that has navigator.share can share files. Returns whether it
 * actually shared, so the caller can fall back to download without ever
 * claiming a fake success.
 */
export async function sharePdfBlob(blob, filename, title) {
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return { shared: true, cancelled: false };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { shared: false, cancelled: true };
      }
      throw err;
    }
  }

  return { shared: false, cancelled: false };
}
