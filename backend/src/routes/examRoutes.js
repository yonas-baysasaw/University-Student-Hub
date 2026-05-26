import { Router } from 'express';
import multer from 'multer';
import {
  deleteExamController,
  getAttemptsController,
  getExamController,
  getQuestionsController,
  listExamsController,
  reactToExamController,
  reprocessFailedExamController,
  submitAttemptController,
  toggleSaveExamController,
  updateExamController,
  uploadExamController,
} from '../controllers/examController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import {
  EXAM_IMPORT_MAX_BYTES,
  examImportRejectionMessage,
  isAllowedExamImportFile,
  isLegacyOfficeFile,
  legacyOfficeRejectionMessage,
} from '../utils/examImportFormats.js';

const storage = multer.memoryStorage();

function examImportFileFilter(_req, file, cb) {
  const name = file?.originalname || '';
  const mime = file?.mimetype || '';
  if (isLegacyOfficeFile(name, mime)) {
    return cb(new Error(legacyOfficeRejectionMessage()));
  }
  if (!isAllowedExamImportFile(name, mime)) {
    return cb(new Error(examImportRejectionMessage()));
  }
  return cb(null, true);
}

const examImportUpload = multer({
  storage,
  fileFilter: examImportFileFilter,
  limits: { fileSize: EXAM_IMPORT_MAX_BYTES },
});

const router = Router();
router.use(isAuthenticated);

router.post('/upload', examImportUpload.single('file'), uploadExamController);
router.post('/:examId/react', reactToExamController);
router.post('/:examId/save', toggleSaveExamController);
router.post('/:examId/reprocess', reprocessFailedExamController);
router.get('/', listExamsController);
router.get('/:examId', getExamController);
router.patch('/:examId', updateExamController);
router.delete('/:examId', deleteExamController);
router.get('/:examId/questions', getQuestionsController);
router.post('/:examId/attempts', submitAttemptController);
router.get('/:examId/attempts', getAttemptsController);

export default router;
