import multer from 'multer'

const storage = multer.memoryStorage()


function applicationFileFilter(_req, file, cb) {
    if (file?.mimetype?.startsWith('application/')) {
        return cb(null, true)
    }

    return cb(new Error('Only application/* files are allowed.'))
}

function imageFileFilter(_req, file, cb) {
    console.log(file)
    if (file?.mimetype?.split('/')[0] ==="image") {
        return cb(null, true)
    }

    return cb(new Error('Only image/* files are allowed.'))
}

const applicationUpload = multer({
    storage,
    fileFilter: applicationFileFilter
})

const imageUpload = multer({
    storage,
    fileFilter: imageFileFilter
})


const uploadApplicationMiddleware = applicationUpload.any()
const uploadImageMiddleware = imageUpload.any()


export {uploadApplicationMiddleware, uploadImageMiddleware }
