import { Router } from 'express';
import {
  createVaultQuestion,
  deleteVaultQuestion,
  listVaultQuestions,
  practiceBatch,
  publishVaultToBank,
  updateVaultQuestion,
} from '../controllers/vaultController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = Router();
router.use(isAuthenticated);

router.get('/questions', listVaultQuestions);
router.post('/questions', createVaultQuestion);
router.patch('/questions/:id', updateVaultQuestion);
router.delete('/questions/:id', deleteVaultQuestion);
router.post('/questions/publish', publishVaultToBank);
router.post('/questions/practice-batch', practiceBatch);

export default router;
