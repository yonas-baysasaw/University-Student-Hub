function createUploadSuccessResponse({ filename, location, key }) {
    return {
        status: 'success',
        filename,
        location,
        key
    }
}

function createErrorResponse(message) {
    return {
        status: 'error',
        message
    }
}

export { createUploadSuccessResponse, createErrorResponse }
