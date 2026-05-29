import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function isPdfUrl(url) {
  const u = String(url || '').toLowerCase();
  return (
    u.includes('.pdf') ||
    u.includes('application/pdf') ||
    u.includes('/file')
  );
}

/**
 * PDF.js reader with page sync and text selection for Study Buddy.
 */
function BookPdfViewer({
  url,
  title = 'Book',
  page = 1,
  onPageChange,
  onTextSelected,
  className = '',
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const pdfRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectionAnchor, setSelectionAnchor] = useState(null);

  const renderPage = useCallback(async (pdf, pageNum) => {
    if (!pdf || !canvasRef.current) return;
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        /* ignore */
      }
    }
    const safePage = Math.min(Math.max(1, pageNum), pdf.numPages);
    const pdfPage = await pdf.getPage(safePage);
    const viewport = pdfPage.getViewport({ scale: 1.2 });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const task = pdfPage.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    await task.promise;
  }, []);

  useEffect(() => {
    if (!url || !isPdfUrl(url)) return undefined;
    let active = true;
    setLoading(true);
    setError('');

    const load = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url,
          withCredentials: true,
        });
        const pdf = await loadingTask.promise;
        if (!active) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        await renderPage(pdf, page);
      } catch (e) {
        if (!active) return;
        setError(e?.message || 'Could not open this PDF.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          /* ignore */
        }
      }
    };
  }, [url, renderPage]);

  useEffect(() => {
    const pdf = pdfRef.current;
    if (!pdf || loading) return;
    void renderPage(pdf, page);
  }, [page, loading, renderPage]);

  const goPage = (next) => {
    const n = Math.min(Math.max(1, next), numPages || 1);
    onPageChange?.(n);
  };

  const handleMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString?.().trim() || '';
    if (text.length >= 8) {
      setSelectionAnchor({ text, page });
      onTextSelected?.({ text, page });
    } else {
      setSelectionAnchor(null);
    }
  };

  if (!url) {
    return (
      <div className={`flex flex-1 items-center justify-center text-sm text-slate-500 ${className}`}>
        No file to display.
      </div>
    );
  }

  if (!isPdfUrl(url)) {
    return (
      <iframe
        src={url}
        title={`${title} reader`}
        className={`min-h-[12rem] w-full flex-1 border-0 bg-white dark:bg-slate-950 ${className}`}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}
      onMouseUp={handleMouseUp}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/90">
        <button
          type="button"
          onClick={() => goPage(page - 1)}
          disabled={page <= 1 || loading}
          className="rounded-md p-1 text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={numPages || 1}
            value={page}
            onChange={(e) => goPage(Number(e.target.value) || 1)}
            className="w-12 rounded border border-slate-200 bg-white px-1 py-0.5 text-center dark:border-slate-600 dark:bg-slate-800"
          />
          <span>of {numPages || '—'}</span>
        </div>
        <button
          type="button"
          onClick={() => goPage(page + 1)}
          disabled={page >= numPages || loading}
          className="rounded-md p-1 text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-2 dark:bg-slate-950">
        {loading ? (
          <p className="p-4 text-center text-sm text-slate-500">Opening PDF…</p>
        ) : error ? (
          <p className="p-4 text-center text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : (
          <canvas ref={canvasRef} className="mx-auto max-w-full shadow-sm" />
        )}
      </div>

      {selectionAnchor ? (
        <div className="shrink-0 border-t border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900">
          <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
            Selected: &ldquo;{selectionAnchor.text.slice(0, 80)}
            {selectionAnchor.text.length > 80 ? '…' : ''}&rdquo;
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default BookPdfViewer;
