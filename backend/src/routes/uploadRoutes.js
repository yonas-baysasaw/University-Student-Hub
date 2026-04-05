import { Router } from 'express'
import { uploadProfileController, uploadController } from '../controllers/uploadController.js'
import { uploadApplicationMiddleware, uploadImageMiddleware } from '../middlewares/uploadMiddleware.js'
import { isAuthenticated } from '../middlewares/authMiddleware.js'

const routes = Router()
routes.use(isAuthenticated)

routes.post('/profile', uploadImageMiddleware, uploadProfileController)
routes.post('/file', uploadApplicationMiddleware, uploadController)


export default routes 
