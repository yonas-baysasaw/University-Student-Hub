import express from 'express';
import { getDashboardSummary } from '../controllers/dashboardController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(isAuthenticated);

router.get('/summary', getDashboardSummary);

export default router;
