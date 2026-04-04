import multer from 'multer'
import { createErrorResponse } from '../models/uploadModel.js'

function getUploadClientError(err) {
    if (!err) return null

    if (err instanceof multer.MulterError) {
        return err.message
    }

    const raw = [err?.message, err?.toString?.()].filter(Boolean).join(' | ')

    if (/multipart/i.test(raw) || /unexpected end of form/i.test(raw) || /unexpected field/i.test(raw)) {
        return err?.message || 'Invalid multipart upload request.'
    }

    if (/only application\/\* files are allowed/i.test(raw)) {
        return err?.message || 'Invalid file type.'
    }

    if (/only image\/\* files are allowed/i.test(raw)) {
        return err?.message || 'Invalid file type.'
    }

    return null
}

function errorHandler(err, _req, res, _next) {
    const uploadClientError = getUploadClientError(err)

    if (uploadClientError) {
        console.warn(`Upload request rejected: ${uploadClientError}`)
        return res.status(400).json(createErrorResponse(uploadClientError))
    }

    if (err?.name === 'SignatureDoesNotMatch' || err?.Code === 'SignatureDoesNotMatch') {
        return res.status(401).json(
            createErrorResponse('AWS signature mismatch. Verify AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY and ensure they belong to the same IAM key pair.')
        )
    }

    if (err?.name === 'AccessDenied' || err?.Code === 'AccessDenied') {
        return res.status(403).json(
            createErrorResponse('AWS denied s3:PutObject for this IAM user. Attach an IAM policy that allows PutObject on this bucket/prefix.')
        )
    }

    console.error(err)

    return res.status(500).json(createErrorResponse(err.message || 'Internal server error'))
}

export { errorHandler }
