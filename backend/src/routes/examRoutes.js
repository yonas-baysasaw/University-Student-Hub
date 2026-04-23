import { Router } from 'express';
import multer from 'multer';
import {
  deleteExamController,
  getAttemptsController,
  getExamController,
  getQuestionsController,
  listExamsController,
  submitAttemptController,
  updateExamController,
  uploadExamController,
} from '../controllers/examController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const storage = multer.memoryStorage();
const pdfUpload = multer({
  storage,
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    return cb(new Error('Only PDF files are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const router = Router();
router.use(isAuthenticated);

router.post('/upload', pdfUpload.single('pdf'), uploadExamController);
router.get('/', listExamsController);
router.get('/:examId', getExamController);
router.patch('/:examId', updateExamController);
router.delete('/:examId', deleteExamController);
router.get('/:examId/questions', getQuestionsController);
router.post('/:examId/attempts', submitAttemptController);
router.get('/:examId/attempts', getAttemptsController);

export default router;
