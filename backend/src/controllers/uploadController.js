import { uploadFileToS3 } from '../services/uploadService.js'
import Book from '../models/Books.js'

function createErrorResponse(message) {
    return { message }
}


function getUploadedFile(req) {
    if (req.file) return req.file
    if (Array.isArray(req.files) && req.files.length > 0) return req.files[0]

    if (req.files && typeof req.files === 'object') {
        const first = Object.values(req.files)[0]
        if (Array.isArray(first) && first.length > 0) return first[0]
    }

    return null
}

async function uploadController(req, res, next) {
    try {
        const id = req.user?._id
        if (!id) {
            return res.status(401).json(createErrorResponse('Unauthorized'))
        }
        const uploadedFile = getUploadedFile(req)

        if (!uploadedFile) {
            return res.status(400).json(createErrorResponse('No file uploaded.'))
        }

        const uploadResult = await uploadFileToS3(uploadedFile, `${id}/Library`)

        const book = await Book.create({
            userId: id,
            title: req.body?.title?.trim() || uploadedFile.originalname,
            description: req.body?.description || "",
            bookUrl: uploadResult.location,
            format: uploadedFile.mimetype,
          })

        return res.status(201).json({
            id: book._id,
            title: book.title,
            description: book.description,
            bookUrl: book.bookUrl,
            format: book.format,
            visibility: book.visibility,
            createdAt: book.createdAt,
        })


    } catch (error) {
        return next(error)
    }
}

async function uploadProfileController(req, res, next) {
    const id = req.user?._id
    try {
        if (!id) {
            return res.status(401).json(createErrorResponse('Unauthorized'))
        }

        const uploadedFile = getUploadedFile(req)

        if (!uploadedFile) {
            return res.status(400).json(createErrorResponse('No file uploaded.'))
        }

        const uploadResult = await uploadFileToS3(uploadedFile, `${id}/profile picture`)

        req.user.avatar = uploadResult.location
        await req.user.save()

        return res.json({
            filename: uploadedFile.originalname,
            location: uploadResult.location,
            key: uploadResult.key,  
            user: {
                id: id,
                avatar: req.user.avatar
            }
        })
    } catch (error) {
        return next(error)
    }
}

export {uploadProfileController, uploadController }
