import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import AdminNotification from '../models/AdminNotification.js';
import BookComment from '../models/BookComment.js';
import BookReview from '../models/BookReview.js';
import Book from '../models/Books.js';
import Chat from '../models/Chat.js';
import Department from '../models/Department.js';
import EventComment from '../models/EventComment.js';
import EventReview from '../models/EventReview.js';
import Event from '../models/Event.js';
import Message from '../models/Message.js';
import Report from '../models/Report.js';
import Settings from '../models/Settings.js';
import SystemLog from '../models/SystemLog.js';
import User from '../models/User.js';
import { writeSystemLog } from '../services/adminAuditService.js';
import { sendAdminAnnouncementEmail } from '../services/adminEmailService.js';

const clampPage = (value) =>
  Math.max(1, Number.parseInt(String(value || '1'), 10) || 1);
const clampLimit = (value, fallback = 20, max = 100) =>
  Math.min(
    max,
    Math.max(1, Number.parseInt(String(value || fallback), 10) || fallback),
  );

const objectIdOr400 = (id, res) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid id' });
    return null;
  }
  return id;
};

const serializeAdminUser = (u) => ({
  id: String(u._id),
  email: u.email,
  username: u.username ?? '',
  name: u.name ?? '',
  displayName: u.displayName ?? '',
  provider: u.provider,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
  role: u.role ?? 'user',
  permissions: Array.isArray(u.permissions) ? u.permissions : [],
  email_verified: u.email_verified ?? false,
  accountType: u.accountType === 'instructor' ? 'instructor' : 'student',
  department: u.department || '',
  schoolYear: typeof u.schoolYear === 'number' ? u.schoolYear : null,
  platformReadOnly: !!u.platformReadOnly,
  instructorPostingSuspended: !!u.instructorPostingSuspended,
  status: u.status || 'active',
  suspendedReason: u.suspendedReason || '',
  lastSeen: u.lastSeen,
});

export const getAdminStats = asyncHandler(async (_req, res) => {
  const [
    users,
    activeStudents,
    suspendedUsers,
    instructors,
    departments,
    books,
    chats,
    messages,
    reports,
    logs,
    recentLogs,
  ] = await Promise.all([
    User.countDocuments({ status: { $ne: 'deleted' } }),
    User.countDocuments({
      accountType: 'student',
      status: { $ne: 'deleted' },
      role: { $nin: ['admin'] },
    }),
    User.countDocuments({ status: 'suspended' }),
    User.countDocuments({
      accountType: 'instructor',
      status: { $ne: 'deleted' },
    }),
    Department.countDocuments({ active: true }),
    Book.countDocuments(),
    Chat.countDocuments(),
    Message.countDocuments(),
    Report.countDocuments({
      status: { $in: ['pending', 'reviewed', 'open', 'reviewing'] },
    }),
    SystemLog.countDocuments(),
    SystemLog.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('actor', 'name username email')
      .lean(),
  ]);

  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const [userGrowth, activity] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $ne: 'deleted' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    SystemLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    users,
    activeStudents,
    suspendedUsers,
    instructors,
    departments,
    books,
    chats,
    messages,
    reports,
    logs,
    userGrowth,
    activity,
    recentLogs,
  });
});

export const listAdminUsers = asyncHandler(async (req, res) => {
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit, 20, 100);
  const skip = (page - 1) * limit;
  const q = String(req.query.q || '').trim();
  const accountTypeRaw = req.query.accountType;
  const statusRaw = req.query.status;
  const roleRaw = req.query.role;

  const filter = { status: { $ne: 'deleted' } };
  if (accountTypeRaw === 'student') {
    filter.$or = [
      { accountType: 'student' },
      { accountType: { $exists: false } },
    ];
    filter.role = { $nin: ['admin'] };
  } else if (accountTypeRaw === 'instructor') {
    filter.accountType = 'instructor';
  }
  if (statusRaw && ['active', 'suspended', 'deleted'].includes(statusRaw)) {
    filter.status = statusRaw;
  }
  if (roleRaw && ['user', 'admin', 'lecturer'].includes(roleRaw)) {
    filter.role = roleRaw;
  }
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    filter.$and = [
      {
        $or: [
          { email: re },
          { username: re },
          { name: re },
          { displayName: re },
        ],
      },
    ];
  }

  const [total, docs] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        'email username name displayName provider createdAt updatedAt role permissions email_verified accountType department schoolYear platformReadOnly instructorPostingSuspended status suspendedReason lastSeen',
      )
      .lean(),
  ]);

  res.json({
    users: docs.map(serializeAdminUser),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

export const getAdminUser = asyncHandler(async (req, res) => {
  if (!objectIdOr400(req.params.userId, res)) return;
  const user = await User.findById(req.params.userId).lean();
  if (!user || user.status === 'deleted') {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ user: serializeAdminUser(user) });
});

export const patchAdminUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!objectIdOr400(userId, res)) return;

  const target = await User.findById(userId);
  if (!target || target.status === 'deleted') {
    return res.status(404).json({ message: 'User not found' });
  }

  const body = req.body ?? {};
  const allowed = [
    'name',
    'displayName',
    'department',
    'schoolYear',
    'accountType',
  ];
  for (const field of allowed) {
    if (body[field] !== undefined) {
      target[field] =
        field === 'schoolYear' && body[field] !== null
          ? Number(body[field])
          : body[field];
    }
  }
  if (body.role !== undefined) {
    if (!['user', 'admin', 'lecturer'].includes(body.role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const demotingAdmin =
      target.role === 'admin' && body.role !== 'admin';
    if (demotingAdmin) {
      if (String(target._id) === String(req.user._id)) {
        return res
          .status(400)
          .json({ message: 'You cannot remove your own admin access' });
      }
      const adminCount = await User.countDocuments({
        role: 'admin',
        status: { $ne: 'deleted' },
      });
      if (adminCount <= 1) {
        return res
          .status(400)
          .json({ message: 'At least one administrator must remain' });
      }
    }
    target.role = body.role;
  }
  if (body.permissions !== undefined) {
    if (!Array.isArray(body.permissions)) {
      return res.status(400).json({ message: 'permissions must be an array' });
    }
    target.permissions = body.permissions
      .map((p) => String(p).trim())
      .filter(Boolean);
  }
  if (body.platformReadOnly !== undefined) {
    if (typeof body.platformReadOnly !== 'boolean') {
      return res
        .status(400)
        .json({ message: 'platformReadOnly must be boolean' });
    }
    target.platformReadOnly = body.platformReadOnly;
  }
  if (body.instructorPostingSuspended !== undefined) {
    if (typeof body.instructorPostingSuspended !== 'boolean') {
      return res
        .status(400)
        .json({ message: 'instructorPostingSuspended must be boolean' });
    }
    target.instructorPostingSuspended = body.instructorPostingSuspended;
  }
  if (body.accountType === 'student') {
    target.instructorPostingSuspended = false;
  }

  await target.save();
  await writeSystemLog(req, 'admin.user.update', {
    entity: 'User',
    entityId: target._id,
    metadata: { fields: Object.keys(body) },
  });

  res.json({ user: serializeAdminUser(target) });
});

export const softDeleteAdminUser = asyncHandler(async (req, res) => {
  if (!objectIdOr400(req.params.userId, res)) return;
  const target = await User.findById(req.params.userId);
  if (!target || target.status === 'deleted') {
    return res.status(404).json({ message: 'User not found' });
  }
  if (String(target._id) === String(req.user._id)) {
    return res
      .status(400)
      .json({ message: 'You cannot delete your own admin account' });
  }
  target.status = 'deleted';
  target.deletedAt = new Date();
  target.platformReadOnly = true;
  await target.save();
  await writeSystemLog(req, 'admin.user.delete', {
    entity: 'User',
    entityId: target._id,
  });
  res.json({ success: true, user: serializeAdminUser(target) });
});

export const suspendAdminUsers = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids
    : [req.body?.id].filter(Boolean);
  const reason = String(req.body?.reason || '')
    .trim()
    .slice(0, 240);
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validIds.length) {
    return res.status(400).json({ message: 'No valid user ids supplied' });
  }
  await User.updateMany(
    { _id: { $in: validIds }, role: { $nin: ['admin'] } },
    {
      $set: {
        status: 'suspended',
        suspendedAt: new Date(),
        suspendedReason: reason,
        platformReadOnly: true,
      },
    },
  );
  await writeSystemLog(req, 'admin.user.suspend', {
    entity: 'User',
    metadata: { ids: validIds, reason },
  });
  res.json({ success: true, count: validIds.length });
});

export const activateAdminUsers = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids
    : [req.body?.id].filter(Boolean);
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validIds.length) {
    return res.status(400).json({ message: 'No valid user ids supplied' });
  }
  await User.updateMany(
    { _id: { $in: validIds }, status: 'suspended' },
    {
      $set: { status: 'active', platformReadOnly: false },
      $unset: { suspendedAt: '', suspendedReason: '' },
    },
  );
  await writeSystemLog(req, 'admin.user.activate', {
    entity: 'User',
    metadata: { ids: validIds },
  });
  res.json({ success: true, count: validIds.length });
});

export const listDepartments = asyncHandler(async (_req, res) => {
  const departments = await Department.find({})
    .sort({ name: 1 })
    .populate('head', 'name email')
    .lean();
  res.json({ departments });
});

export const createDepartment = asyncHandler(async (req, res) => {
  const { name, code, description = '', head } = req.body || {};
  if (!name || !code) {
    return res.status(400).json({ message: 'Name and code are required' });
  }
  const department = await Department.create({
    name: String(name).trim(),
    code: String(code).trim().toUpperCase(),
    description: String(description || '').trim(),
    head: mongoose.Types.ObjectId.isValid(head) ? head : undefined,
  });
  await writeSystemLog(req, 'admin.department.create', {
    entity: 'Department',
    entityId: department._id,
  });
  res.status(201).json({ department });
});

export const updateDepartment = asyncHandler(async (req, res) => {
  if (!objectIdOr400(req.params.departmentId, res)) return;
  const department = await Department.findById(req.params.departmentId);
  if (!department)
    return res.status(404).json({ message: 'Department not found' });
  for (const field of ['name', 'code', 'description', 'active']) {
    if (req.body?.[field] !== undefined) {
      department[field] =
        field === 'code'
          ? String(req.body[field]).toUpperCase()
          : req.body[field];
    }
  }
  if (req.body?.head !== undefined) {
    department.head = mongoose.Types.ObjectId.isValid(req.body.head)
      ? req.body.head
      : undefined;
  }
  await department.save();
  await writeSystemLog(req, 'admin.department.update', {
    entity: 'Department',
    entityId: department._id,
  });
  res.json({ department });
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  if (!objectIdOr400(req.params.departmentId, res)) return;
  const department = await Department.findById(req.params.departmentId);
  if (!department)
    return res.status(404).json({ message: 'Department not found' });
  department.active = false;
  await department.save();
  await writeSystemLog(req, 'admin.department.disable', {
    entity: 'Department',
    entityId: department._id,
  });
  res.json({ success: true, department });
});

export const assignDepartmentStudents = asyncHandler(async (req, res) => {
  if (!objectIdOr400(req.params.departmentId, res)) return;
  const department = await Department.findById(req.params.departmentId);
  if (!department)
    return res.status(404).json({ message: 'Department not found' });
  const ids = Array.isArray(req.body?.studentIds) ? req.body.studentIds : [];
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validIds.length)
    return res.status(400).json({ message: 'No students selected' });
  await User.updateMany(
    { _id: { $in: validIds }, accountType: 'student' },
    { $set: { department: department.name } },
  );
  department.studentCount = await User.countDocuments({
    department: department.name,
    status: { $ne: 'deleted' },
  });
  await department.save();
  await writeSystemLog(req, 'admin.department.assign_students', {
    entity: 'Department',
    entityId: department._id,
    metadata: { studentIds: validIds },
  });
  res.json({ success: true, department });
});

export const removeDepartmentStudent = asyncHandler(async (req, res) => {
  if (
    !objectIdOr400(req.params.departmentId, res) ||
    !objectIdOr400(req.params.userId, res)
  )
    return;
  const department = await Department.findById(req.params.departmentId);
  if (!department)
    return res.status(404).json({ message: 'Department not found' });
  await User.findByIdAndUpdate(req.params.userId, { $set: { department: '' } });
  department.studentCount = await User.countDocuments({
    department: department.name,
    status: { $ne: 'deleted' },
  });
  await department.save();
  await writeSystemLog(req, 'admin.department.remove_student', {
    entity: 'Department',
    entityId: department._id,
    metadata: { userId: req.params.userId },
  });
  res.json({ success: true, department });
});

export const listLogs = asyncHandler(async (req, res) => {
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit, 30, 100);
  const q = String(req.query.q || '').trim();
  const filter = {};
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    filter.$or = [
      { action: re },
      { actorEmail: re },
      { entity: re },
      { entityId: re },
    ];
  }
  const [total, logs] = await Promise.all([
    SystemLog.countDocuments(filter),
    SystemLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', 'name username email')
      .lean(),
  ]);
  res.json({
    logs,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

export const sendAnnouncement = asyncHandler(async (req, res) => {
  const {
    title,
    message,
    audience = 'all',
    department = '',
    channel = 'email',
  } = req.body || {};
  if (!title || !message)
    return res.status(400).json({ message: 'Title and message are required' });
  const filter = {
    status: { $ne: 'deleted' },
    email: { $exists: true, $ne: '' },
  };
  if (audience === 'students') filter.accountType = 'student';
  if (audience === 'instructors') filter.accountType = 'instructor';
  if (audience === 'department') filter.department = String(department).trim();
  const recipients = await User.find(filter).select('email').lean();
  const emails = recipients.map((u) => u.email).filter(Boolean);
  let emailResult = { sent: 0, skipped: emails.length, configured: false };
  if (['email', 'both'].includes(channel)) {
    emailResult = await sendAdminAnnouncementEmail({
      recipients: emails,
      title,
      message,
    });
  }
  const notification = await AdminNotification.create({
    title,
    message,
    audience,
    department,
    channel,
    sentBy: req.user._id,
    recipientCount: emails.length,
    status: 'sent',
  });
  await writeSystemLog(req, 'admin.notification.send', {
    entity: 'AdminNotification',
    entityId: notification._id,
    metadata: {
      audience,
      department,
      recipientCount: emails.length,
      emailResult,
    },
  });
  res.status(201).json({ notification, emailResult });
});

export const listNotifications = asyncHandler(async (_req, res) => {
  const notifications = await AdminNotification.find({})
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('sentBy', 'name email')
    .lean();
  res.json({ notifications });
});

export const getAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 180);
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const groupByDay = (field = '$createdAt') => ({
    _id: { $dateToString: { format: '%Y-%m-%d', date: field } },
    count: { $sum: 1 },
  });
  const [usersByDay, logsByDay, usersByDepartment, usersByStatus] =
    await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: groupByDay() },
        { $sort: { _id: 1 } },
      ]),
      SystemLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: groupByDay() },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $match: { status: { $ne: 'deleted' } } },
        {
          $group: {
            _id: { $ifNull: ['$department', 'Unassigned'] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      User.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
  res.json({ usersByDay, logsByDay, usersByDepartment, usersByStatus });
});

export const getSettings = asyncHandler(async (_req, res) => {
  const doc = await Settings.findOne({ key: 'system' }).lean();
  res.json({
    settings: doc?.value || {
      maintenanceMode: false,
      registrationEnabled: true,
      emailAnnouncementsEnabled: true,
      defaultUserRole: 'user',
      supportEmail: '',
    },
  });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const current = await Settings.findOne({ key: 'system' }).lean();
  const value = {
    ...(current?.value || {}),
    ...(req.body || {}),
  };
  const doc = await Settings.findOneAndUpdate(
    { key: 'system' },
    { $set: { value, updatedBy: req.user._id } },
    { returnDocument: 'after', upsert: true },
  );
  await writeSystemLog(req, 'admin.settings.update', {
    entity: 'Settings',
    entityId: doc._id,
  });
  res.json({ settings: doc.value });
});

export const listAdminBooks = asyncHandler(async (req, res) => {
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit, 20, 50);
  const [total, docs] = await Promise.all([
    Book.countDocuments({}),
    Book.find({})
      .sort({ dislikesCount: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'username name email avatar')
      .lean(),
  ]);
  res.json({
    books: docs.map((b) => ({
      id: String(b._id),
      title: b.title,
      visibility: b.visibility,
      likesCount: b.likesCount ?? 0,
      dislikesCount: b.dislikesCount ?? 0,
      createdAt: b.createdAt,
      uploader: b.userId
        ? {
            id: String(b.userId._id),
            name: b.userId.name || b.userId.username || '',
            email: b.userId.email || '',
          }
        : null,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

export const deleteAdminBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!objectIdOr400(bookId, res)) return;
  const deleted = await Book.findById(bookId);
  if (!deleted) return res.status(404).json({ message: 'Book not found' });
  await BookReview.deleteMany({ bookId: deleted._id });
  await BookComment.deleteMany({ bookId: deleted._id });
  await Book.findByIdAndDelete(bookId);
  await writeSystemLog(req, 'admin.book.delete', {
    entity: 'Book',
    entityId: bookId,
  });
  res.json({ success: true, message: 'Book deleted' });
});

export const patchAdminBookVisibility = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!objectIdOr400(bookId, res)) return;
  const visibility = String(req.body?.visibility || '').trim();
  if (!['public', 'private', 'unlisted'].includes(visibility)) {
    return res.status(400).json({ message: 'Invalid visibility' });
  }
  const book = await Book.findById(bookId);
  if (!book) return res.status(404).json({ message: 'Book not found' });
  book.visibility = visibility;
  await book.save();
  await writeSystemLog(req, 'admin.book.visibility', {
    entity: 'Book',
    entityId: bookId,
    metadata: { visibility },
  });
  res.json({ ok: true, id: String(book._id), visibility: book.visibility });
});

export const deleteAdminEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  if (!objectIdOr400(eventId, res)) return;
  const ev = await Event.findById(eventId);
  if (!ev) return res.status(404).json({ message: 'Event not found' });
  const bid = ev._id;
  await Promise.all([
    EventReview.deleteMany({ eventId: bid }),
    EventComment.deleteMany({ eventId: bid }),
  ]);
  await ev.deleteOne();
  await writeSystemLog(req, 'admin.event.delete', {
    entity: 'Event',
    entityId: eventId,
  });
  res.json({ ok: true, message: 'Event deleted' });
});

export const patchAdminEventVisibility = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  if (!objectIdOr400(eventId, res)) return;
  const visibility = String(req.body?.visibility || '').trim();
  if (!['public', 'private', 'unlisted'].includes(visibility)) {
    return res.status(400).json({ message: 'Invalid visibility' });
  }
  const ev = await Event.findById(eventId);
  if (!ev) return res.status(404).json({ message: 'Event not found' });
  ev.visibility = visibility;
  await ev.save();
  await writeSystemLog(req, 'admin.event.visibility', {
    entity: 'Event',
    entityId: eventId,
    metadata: { visibility },
  });
  res.json({ ok: true, id: String(ev._id), visibility: ev.visibility });
});
