import { Router } from 'express'
import { uploadProfileController } from '../controllers/uploadController.js'
import { uploadApplicationMiddleware, uploadImageMiddleware } from '../middlewares/uploadMiddleware.js'
import { isAuthenticated } from '../middlewares/authMiddleware.js'

const routes = Router()
routes.use(isAuthenticated)

routes.post('/upload/profile', uploadImageMiddleware, uploadProfileController)
// routes.post('/upload/file', uploadApplicationMiddleware, uploadController)


export default routes 
