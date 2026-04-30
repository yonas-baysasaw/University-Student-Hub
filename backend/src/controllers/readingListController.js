import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import Book from '../models/Books.js';
import ReadingList from '../models/ReadingList.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

async function thumbnailUrlsForListBookIds(bookIds, max = 3) {
  const slice = (Array.isArray(bookIds) ? bookIds : []).slice(0, max);
  if (!slice.length) return [];
  const books = await Book.find({ _id: { $in: slice } })
    .select('thumbnailUrl')
    .lean();
  const byId = new Map(books.map((b) => [String(b._id), b.thumbnailUrl || '']));
  return slice.map((id) => byId.get(String(id)) || '');
}

const listToJson = (doc) => {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    name: o.name,
    description: o.description || '',
    bookIds: Array.isArray(o.bookIds) ? o.bookIds.map((id) => String(id)) : [],
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
};

export const listReadingLists = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const lists = await ReadingList.find({ userId: req.user._id })
    .sort({ updatedAt: -1 })
    .lean();

  const allPreviewIds = [];
  for (const L of lists) {
    for (const id of (L.bookIds || []).slice(0, 3)) {
      allPreviewIds.push(id);
    }
  }
  const uniqueIds = [
    ...new Set(
      allPreviewIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => String(id)),
    ),
  ];
  const thumbById = new Map();
  if (uniqueIds.length) {
    const books = await Book.find({
      _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select('thumbnailUrl')
      .lean();
    for (const b of books) {
      thumbById.set(String(b._id), b.thumbnailUrl || '');
    }
  }

  res.status(200).json({
    success: true,
    lists: lists.map((L) => {
      const bookIds = Array.isArray(L.bookIds) ? L.bookIds.map((id) => String(id)) : [];
      const previewThumbnails = (L.bookIds || [])
        .slice(0, 3)
        .map((id) => (mongoose.Types.ObjectId.isValid(id) ? thumbById.get(String(id)) || '' : ''));
      return {
        id: String(L._id),
        name: L.name,
        description: L.description || '',
        bookIds,
        previewThumbnails,
        updatedAt: L.updatedAt,
      };
    }),
  });
});

export const createReadingList = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const name = String(req.body?.name || '').trim();
  if (!name) {
    return res.status(400).json({ success: false, message: 'Name is required.' });
  }
  const description = String(req.body?.description || '').trim().slice(0, 500);
  const rawIds = Array.isArray(req.body?.bookIds) ? req.body.bookIds : [];
  const bookIds = rawIds
    .map((id) => (mongoose.Types.ObjectId.isValid(id) ? id : null))
    .filter(Boolean);

  try {
    const list = await ReadingList.create({
      userId: req.user._id,
      name,
      description,
      bookIds,
    });
    res.status(201).json({ success: true, list: listToJson(list) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You already have a list with this name.',
      });
    }
    throw err;
  }
});

export const getReadingList = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { listId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(listId)) {
    return res.status(400).json({ success: false, message: 'Invalid list id' });
  }
  const list = await ReadingList.findOne({
    _id: listId,
    userId: req.user._id,
  }).lean();
  if (!list) {
    return res.status(404).json({ success: false, message: 'List not found' });
  }
  const bookIds = Array.isArray(list.bookIds) ? list.bookIds : [];
  const previewThumbnails = await thumbnailUrlsForListBookIds(bookIds, 3);
  let booksPreview = [];
  if (bookIds.length) {
    const valid = bookIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const books = await Book.find({ _id: { $in: valid } })
      .select('title thumbnailUrl')
      .lean();
    const meta = new Map(
      books.map((b) => [
        String(b._id),
        { title: b.title || 'Untitled', thumbnailUrl: b.thumbnailUrl || '' },
      ]),
    );
    booksPreview = bookIds.map((id) => {
      const sid = String(id);
      const m = meta.get(sid);
      return {
        id: sid,
        title: m?.title || 'Untitled',
        thumbnailUrl: m?.thumbnailUrl || '',
      };
    });
  }
  res.status(200).json({
    success: true,
    list: { ...listToJson(list), previewThumbnails, booksPreview },
  });
});

export const updateReadingList = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { listId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(listId)) {
    return res.status(400).json({ success: false, message: 'Invalid list id' });
  }
  const list = await ReadingList.findOne({
    _id: listId,
    userId: req.user._id,
  });
  if (!list) {
    return res.status(404).json({ success: false, message: 'List not found' });
  }

  if (req.body.name !== undefined) {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    list.name = name;
  }
  if (req.body.description !== undefined) {
    list.description = String(req.body.description || '').trim().slice(0, 500);
  }
  if (Array.isArray(req.body.bookIds)) {
    list.bookIds = req.body.bookIds
      .map((id) => (mongoose.Types.ObjectId.isValid(id) ? id : null))
      .filter(Boolean);
  }

  try {
    await list.save();
    res.status(200).json({ success: true, list: listToJson(list) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You already have a list with this name.',
      });
    }
    throw err;
  }
});

export const deleteReadingList = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { listId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(listId)) {
    return res.status(400).json({ success: false, message: 'Invalid list id' });
  }
  const deleted = await ReadingList.findOneAndDelete({
    _id: listId,
    userId: req.user._id,
  });
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'List not found' });
  }
  res.status(200).json({ success: true, message: 'List deleted' });
});

export const addBookToReadingList = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { listId } = req.params;
  const bookId = req.body?.bookId;
  if (!mongoose.Types.ObjectId.isValid(listId)) {
    return res.status(400).json({ success: false, message: 'Invalid list id' });
  }
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ success: false, message: 'Invalid book id' });
  }
  const list = await ReadingList.findOne({
    _id: listId,
    userId: req.user._id,
  });
  if (!list) {
    return res.status(404).json({ success: false, message: 'List not found' });
  }
  const sid = String(bookId);
  const has = (list.bookIds || []).some((id) => String(id) === sid);
  if (!has) list.bookIds = [...(list.bookIds || []), bookId];
  await list.save();
  res.status(200).json({ success: true, list: listToJson(list) });
});

export const removeBookFromReadingList = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { listId, bookId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(listId)) {
    return res.status(400).json({ success: false, message: 'Invalid list id' });
  }
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ success: false, message: 'Invalid book id' });
  }
  const list = await ReadingList.findOne({
    _id: listId,
    userId: req.user._id,
  });
  if (!list) {
    return res.status(404).json({ success: false, message: 'List not found' });
  }
  const sid = String(bookId);
  list.bookIds = (list.bookIds || []).filter((id) => String(id) !== sid);
  await list.save();
  res.status(200).json({ success: true, list: listToJson(list) });
});
