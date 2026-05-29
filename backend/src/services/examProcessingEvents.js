import { getIo } from '../socket/index.js';

function examRoom(examId) {
  return `exam:${String(examId)}`;
}

function userRoom(userId) {
  return `user:${String(userId)}`;
}

function emitToExamAndUser(examId, userId, event, payload) {
  const io = getIo();
  if (!io) return;
  const data = { examId: String(examId), ...payload };
  io.to(examRoom(examId)).emit(event, data);
  if (userId) {
    io.to(userRoom(userId)).emit(event, data);
  }
}

export function emitExamProcessingStarted({
  examId,
  userId,
  totalBatches,
  filename,
}) {
  emitToExamAndUser(examId, userId, 'exam:processingStarted', {
    totalBatches,
    filename: filename || '',
  });
}

export function emitExamBatchComplete({
  examId,
  userId,
  batchNumber,
  totalBatches,
  newQuestionCount,
  totalQuestions,
}) {
  emitToExamAndUser(examId, userId, 'exam:batchComplete', {
    batchNumber,
    totalBatches,
    newQuestionCount,
    totalQuestions,
  });
}

export function emitExamProcessingComplete({
  examId,
  userId,
  totalQuestions,
  totalBatches,
}) {
  emitToExamAndUser(examId, userId, 'exam:processingComplete', {
    totalQuestions,
    totalBatches,
  });
}

export function emitExamProcessingFailed({ examId, userId, error }) {
  emitToExamAndUser(examId, userId, 'exam:processingFailed', {
    error: error || 'Processing failed',
  });
}
