import { createUploadSuccessResponse, createErrorResponse } from '../models/uploadModel.js'
import { uploadFileToS3 } from '../services/uploadService.js'

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
        const uploadedFile = getUploadedFile(req)

        if (!uploadedFile) {
            return res.status(400).json(createErrorResponse('No file uploaded.'))
        }

        const uploadResult = await uploadFileToS3(uploadedFile)

        req.user.avatar = uploadResult.location
        await req.user.save()
        console.log("ddlfksjd")

        return res.json({
            name:"yonas"
            // ...createUploadSuccessResponse({
            //     filename: uploadedFile.originalname,
            //     location: uploadResult.location,
            //     key: uploadResult.key,
            //     name:"yonas"
            // }),
            // user: {
            //     id: req.user._id,
            //     avatar: req.user.avatar
            // }
        })
    } catch (error) {
        return next(error)
    }
}

export {uploadProfileController }
