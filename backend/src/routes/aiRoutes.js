import { Router } from 'express';
import {
  chatController,
  deleteSessionController,
  getSessionController,
  listModelsController,
  listSessionsController,
} from '../controllers/aiController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(isAuthenticated);

router.post('/chat', chatController);
router.get('/models', listModelsController);
router.get('/sessions', listSessionsController);
router.get('/sessions/:sessionId', getSessionController);
router.delete('/sessions/:sessionId', deleteSessionController);

export default router;
