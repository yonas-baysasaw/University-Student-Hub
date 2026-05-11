import Exam from '../models/Exam.js';

function isFatalAIError(_error) {
  return false;
}

function createTextChunks(textContent) {
  const content = typeof textContent === 'string' ? textContent : '';
  return [
    {
      content,
      batchNumber: 1,
      wordsCount: content.split(/\s+/).filter(Boolean).length,
    },
  ];
}

async function processExamInBatches(examId, content, uploaderId) {
  void content;
  void uploaderId;
  await Exam.findByIdAndUpdate(examId, {
    processingStatus: 'failed',
    processingError: 'AI exam processing has been disabled on this server.',
  });
}

export { createTextChunks, isFatalAIError, processExamInBatches };
