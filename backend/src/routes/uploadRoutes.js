import { Router } from 'express';
import {
  uploadController,
  uploadProfileController,
} from '../controllers/uploadController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import {
  uploadApplicationMiddleware,
  uploadImageMiddleware,
} from '../middlewares/uploadMiddleware.js';

const routes = Router();
routes.use(isAuthenticated);

routes.post('/profile', uploadImageMiddleware, uploadProfileController);
routes.post('/file', uploadApplicationMiddleware, uploadController);

export default routes;
