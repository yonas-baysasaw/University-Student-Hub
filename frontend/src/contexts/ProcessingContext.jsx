// @refresh reset
import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSocket } from './SocketContext';

/**
 * Tracks which exams are currently processing.
 * Map<examId, { batchNumber, totalBatches, totalQuestions }>
 */
const ProcessingContext = createContext(new Map());

export function ProcessingProvider({ children }) {
  const socket = useSocket();
  const [processing, setProcessing] = useState(new Map());

  useEffect(() => {
    if (!socket) return;

    function onBatchComplete({ examId, batchNumber, totalBatches, newQuestionCount, totalQuestions }) {
      setProcessing((prev) => {
        const next = new Map(prev);
        next.set(examId, { batchNumber, totalBatches, totalQuestions });
        return next;
      });
      toast.success(
        `+${newQuestionCount} questions extracted (batch ${batchNumber}/${totalBatches})`,
        { id: `batch-${examId}-${batchNumber}`, duration: 3000 },
      );
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

    socket.on('exam:batchComplete', onBatchComplete);
    socket.on('exam:processingComplete', onProcessingComplete);
    socket.on('exam:processingFailed', onProcessingFailed);

    return () => {
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

// ── Fixed bottom-right indicator (ported from did-exit #processing-indicator) ─

function GlobalProcessingIndicator({ processing }) {
  if (processing.size === 0) return null;

  const items = Array.from(processing.entries());

  return (
    <div className="fixed bottom-4 right-4 z-[99998] flex flex-col gap-2">
      {items.map(([examId, { batchNumber, totalBatches }]) => (
        <div
          key={examId}
          className="flex items-center gap-2 rounded-2xl border border-cyan-200 bg-white px-4 py-2.5 shadow-lg text-xs font-medium text-slate-700"
        >
          <span className="loading loading-spinner loading-xs text-cyan-600" />
          <span>
            Processing exam…{' '}
            <span className="text-cyan-700">
              batch {batchNumber}/{totalBatches}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
