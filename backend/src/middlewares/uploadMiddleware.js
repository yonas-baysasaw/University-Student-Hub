import multer from 'multer';

const storage = multer.memoryStorage();

function applicationFileFilter(_req, file, cb) {
  if (file?.mimetype?.startsWith('application/')) {
    return cb(null, true);
  }

  return cb(new Error('Only application/* files are allowed.'));
}

function imageFileFilter(_req, file, cb) {
  console.log(file);
  if (file?.mimetype?.split('/')[0] === 'image') {
    return cb(null, true);
  }

  return cb(new Error('Only image/* files are allowed.'));
}

const applicationUpload = multer({
  storage,
  fileFilter: applicationFileFilter,
});

const imageUpload = multer({
  storage,
  fileFilter: imageFileFilter,
});

const uploadApplicationMiddleware = applicationUpload.any();
const uploadImageMiddleware = imageUpload.any();

function classroomResourceFileFilter(_req, file, cb) {
  const m = (file?.mimetype || '').toLowerCase();
  if (
    m.startsWith('application/') ||
    m.startsWith('image/') ||
    m.startsWith('text/') ||
    m.startsWith('video/') ||
    m.startsWith('audio/')
  ) {
    return cb(null, true);
  }
  return cb(new Error('File type not allowed for this resource.'));
}

const classroomResourceUpload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: classroomResourceFileFilter,
});

/** Optional single `file` field; title/link in same multipart body. */
const uploadClassroomResourceSingle = classroomResourceUpload.single('file');

export {
  uploadApplicationMiddleware,
  uploadClassroomResourceSingle,
  uploadImageMiddleware,
};
