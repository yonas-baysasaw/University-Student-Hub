import Book from '../models/Books.js';
import { createPdfThumbnailBuffer } from '../services/pdfThumbnailService.js';
import { uploadFileToS3 } from '../services/uploadService.js';
import { validateBookCatalogMeta } from '../utils/bookCatalogMeta.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

function createErrorResponse(message) {
  return { message };
}

function getUploadedFile(req) {
  if (req.file) return req.file;
  if (Array.isArray(req.files) && req.files.length > 0) return req.files[0];

  if (req.files && typeof req.files === 'object') {
    const first = Object.values(req.files)[0];
    if (Array.isArray(first) && first.length > 0) return first[0];
  }

  return null;
}

function parseUploadMeta(req) {
  const academicTrack = String(req.body?.academicTrack || '').trim();
  const department = String(req.body?.department || '').trim();
  const title = String(req.body?.title || '').trim();
  const publishYearRaw = req.body?.publishYear;
  const publishYear =
    publishYearRaw === '' || publishYearRaw === undefined || publishYearRaw === null
      ? NaN
      : Number.parseInt(String(publishYearRaw).trim(), 10);
  const courseSubject = String(req.body?.courseSubject || '').trim();
  const description = String(req.body?.description || '').trim();

  return {
    academicTrack,
    department,
    title,
    publishYear,
    courseSubject,
    description,
  };
}

async function uploadController(req, res, next) {
  try {
    assertCanWrite(req.user);
    const id = req.user?._id;
    if (!id) {
      return res.status(401).json(createErrorResponse('Unauthorized'));
    }

    const uploadedFile = getUploadedFile(req);

    if (!uploadedFile) {
      return res.status(400).json(createErrorResponse('No file uploaded.'));
    }

    const meta = parseUploadMeta(req);
    const metaError = validateBookCatalogMeta({
      academicTrack: meta.academicTrack,
      department: meta.department,
      title: meta.title,
      publishYear: meta.publishYear,
      courseSubject: meta.courseSubject,
    });
    if (metaError) {
      return res.status(400).json(createErrorResponse(metaError));
    }

    const uploadResult = await uploadFileToS3(uploadedFile, `${id}/Library`);
    let thumbnailUrl = '';

    const isPdfUpload =
      uploadedFile?.mimetype === 'application/pdf' ||
      uploadedFile?.originalname?.toLowerCase()?.endsWith('.pdf');

    if (isPdfUpload) {
      const thumbnailBuffer = await createPdfThumbnailBuffer(
        uploadedFile.buffer,
      );
      if (thumbnailBuffer) {
        const thumbnailFile = {
          originalname: `${uploadedFile.originalname || 'book'}-cover.png`,
          buffer: thumbnailBuffer,
          mimetype: 'image/png',
        };
        const thumbnailUploadResult = await uploadFileToS3(
          thumbnailFile,
          `${id}/Library/covers`,
        );
        thumbnailUrl = thumbnailUploadResult.location;
      }
    }

    const book = await Book.create({
      userId: id,
      title: meta.title,
      description: meta.description,
      academicTrack: meta.academicTrack,
      department: meta.department,
      publishYear: meta.publishYear,
      courseSubject: meta.courseSubject,
      bookUrl: uploadResult.location,
      thumbnailUrl,
      format: uploadedFile.mimetype,
    });

    return res.status(201).json({
      id: book._id,
      title: book.title,
      description: book.description,
      academicTrack: book.academicTrack,
      department: book.department,
      publishYear: book.publishYear,
      courseSubject: book.courseSubject,
      bookUrl: book.bookUrl,
      thumbnailUrl: book.thumbnailUrl,
      format: book.format,
      visibility: book.visibility,
      createdAt: book.createdAt,
    });
  } catch (error) {
    return next(error);
  }
}

async function uploadProfileController(req, res, next) {
  const id = req.user?._id;
  try {
    assertCanWrite(req.user);
    if (!id) {
      return res.status(401).json(createErrorResponse('Unauthorized'));
    }

    const uploadedFile = getUploadedFile(req);

    if (!uploadedFile) {
      return res.status(400).json(createErrorResponse('No file uploaded.'));
    }

    const uploadResult = await uploadFileToS3(
      uploadedFile,
      `${id}/profile picture`,
    );

    req.user.avatar = uploadResult.location;
    await req.user.save();

    return res.json({
      filename: uploadedFile.originalname,
      location: uploadResult.location,
      key: uploadResult.key,
      user: {
        id: id,
        avatar: req.user.avatar,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export { uploadController, uploadProfileController };
