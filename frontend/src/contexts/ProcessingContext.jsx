// @refresh reset
import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSocket } from './SocketContext';

/**
 * Tracks which exams are currently processing.
 * Map<examId, { batchNumber, totalBatches, totalQuestions, filename? }>
 */
const ProcessingContext = createContext(new Map());

export function ProcessingProvider({ children }) {
  const socket = useSocket();
  const [processing, setProcessing] = useState(new Map());

  useEffect(() => {
    if (!socket) return;

    function onProcessingStarted({
      examId,
      totalBatches,
      filename,
    }) {
      setProcessing((prev) => {
        const next = new Map(prev);
        next.set(examId, {
          batchNumber: 0,
          totalBatches: totalBatches || 1,
          totalQuestions: 0,
          filename: filename || '',
        });
        return next;
      });
    }

    function onBatchComplete({
      examId,
      batchNumber,
      totalBatches,
      newQuestionCount,
      totalQuestions,
    }) {
      setProcessing((prev) => {
        const next = new Map(prev);
        const cur = next.get(examId) || {};
        next.set(examId, {
          ...cur,
          batchNumber,
          totalBatches,
          totalQuestions: totalQuestions ?? cur.totalQuestions ?? 0,
        });
        return next;
      });
      if (newQuestionCount > 0) {
        toast.success(
          `+${newQuestionCount} questions extracted (batch ${batchNumber}/${totalBatches})`,
          { id: `batch-${examId}-${batchNumber}`, duration: 3000 },
        );
      }
    }

    function onProcessingComplete({ examId, totalQuestions }) {
      setProcessing((prev) => {
        const next = new Map(prev);
        next.delete(examId);
        return next;
      });
      toast.success(`Exam ready — ${totalQuestions} questions`, {
        id: `done-${examId}`,
        duration: 4000,
      });
    }

    function onProcessingFailed({ examId, error }) {
      setProcessing((prev) => {
        const next = new Map(prev);
        next.delete(examId);
        return next;
      });
      toast.error(`Processing failed: ${error || 'Unknown error'}`, {
        id: `fail-${examId}`,
        duration: 5000,
      });
    }

    socket.on('exam:processingStarted', onProcessingStarted);
    socket.on('exam:batchComplete', onBatchComplete);
    socket.on('exam:processingComplete', onProcessingComplete);
    socket.on('exam:processingFailed', onProcessingFailed);

    return () => {
      socket.off('exam:processingStarted', onProcessingStarted);
      socket.off('exam:batchComplete', onBatchComplete);
      socket.off('exam:processingComplete', onProcessingComplete);
      socket.off('exam:processingFailed', onProcessingFailed);
    };
  }, [socket]);

  return (
    <ProcessingContext.Provider value={processing}>
      {children}
      <GlobalProcessingIndicator processing={processing} />
    </ProcessingContext.Provider>
  );
}

export function useProcessing() {
  return useContext(ProcessingContext);
}

function GlobalProcessingIndicator({ processing }) {
  if (processing.size === 0) return null;

  const items = Array.from(processing.entries());

  return (
    <div className="fixed bottom-4 right-4 z-[99998] flex flex-col gap-2">
      {items.map(([examId, { batchNumber, totalBatches, totalQuestions, filename }]) => {
        const pct =
          totalBatches > 0
            ? Math.round((batchNumber / totalBatches) * 100)
            : 0;
        return (
          <div
            key={examId}
            className="flex min-w-[220px] flex-col gap-1.5 rounded-2xl border border-cyan-200 bg-white px-4 py-2.5 shadow-lg text-xs font-medium text-slate-700 dark:border-cyan-800/50 dark:bg-slate-900 dark:text-slate-200"
          >
            <div className="flex items-center gap-2">
              <span className="loading loading-spinner loading-xs text-cyan-600" />
              <span className="min-w-0 truncate">
                {filename ? filename : 'Processing exam…'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
              <span>
                Batch {batchNumber}/{totalBatches}
                {totalQuestions > 0 ? ` · ${totalQuestions} ready` : ''}
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
