import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import Report from '../models/Report.js';
import { writeSystemLog } from '../services/adminAuditService.js';
import { loadTargetSummary } from '../services/reportService.js';

const clampPage = (value) =>
  Math.max(1, Number.parseInt(String(value || '1'), 10) || 1);
const clampLimit = (value, fallback = 20, max = 100) =>
  Math.min(
    max,
    Math.max(1, Number.parseInt(String(value || fallback), 10) || fallback),
  );

function serializeReport(doc, targetSummary = null) {
  const adminNote = doc.adminNote || doc.resolution || '';
  return {
    id: String(doc._id),
    reporter: doc.reporter
      ? {
          id: String(doc.reporter._id || doc.reporter.id),
          username: doc.reporter.username ?? '',
          name: doc.reporter.name ?? '',
          email: doc.reporter.email ?? '',
        }
      : null,
    targetType: doc.targetType,
    targetId: doc.targetId,
    reasonCode: doc.reasonCode || '',
    reasonLabel: doc.reasonLabel || '',
    description: doc.description || '',
    reason: doc.reason || '',
    status: doc.status,
    adminNote,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    targetSummary,
  };
}

export const listAdminReports = asyncHandler(async (req, res) => {
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit, 20, 100);
  const skip = (page - 1) * limit;

  const filter = {};

  const typeRaw = String(req.query.targetType || '').trim().toLowerCase();
  if (typeRaw && ['book', 'event', 'user', 'message', 'classroom'].includes(typeRaw)) {
    filter.targetType = typeRaw;
  }

  const statusRaw = String(req.query.status || '').trim().toLowerCase();
  if (statusRaw) {
    const legacyMap = {
      pending: ['pending', 'open'],
      reviewed: ['reviewed', 'reviewing'],
      resolved: ['resolved'],
      rejected: ['rejected', 'dismissed'],
    };
    const variants = legacyMap[statusRaw];
    if (variants) {
      filter.status = variants.length === 1 ? variants[0] : { $in: variants };
    }
  }

  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) filter.createdAt = { ...filter.createdAt, $gte: d };
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) filter.createdAt = { ...filter.createdAt, $lte: d };
  }

  const q = String(req.query.q || '').trim();
  if (q) {
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { targetId: new RegExp(esc, 'i') },
      { description: new RegExp(esc, 'i') },
      { reasonLabel: new RegExp(esc, 'i') },
      { reason: new RegExp(esc, 'i') },
    ];
  }

  const [total, docs] = await Promise.all([
    Report.countDocuments(filter),
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('reporter', 'username name email')
      .lean(),
  ]);

  const targetSummaries = await Promise.all(
    docs.map((d) => loadTargetSummary(d.targetType, d.targetId)),
  );

  res.json({
    reports: docs.map((d, i) => serializeReport(d, targetSummaries[i])),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

export const patchAdminReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    return res.status(400).json({ message: 'Invalid report id' });
  }

  const doc = await Report.findById(reportId);
  if (!doc) return res.status(404).json({ message: 'Report not found' });

  const body = req.body ?? {};

  if (body.status !== undefined) {
    const s = String(body.status || '').trim().toLowerCase();
    const allowed = [
      'pending',
      'reviewed',
      'resolved',
      'rejected',
      'open',
      'reviewing',
      'dismissed',
    ];
    if (!allowed.includes(s)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    doc.status = s;
  }

  if (body.adminNote !== undefined) {
    const note = String(body.adminNote ?? '').trim().slice(0, 1000);
    doc.adminNote = note;
  }

  await doc.save();

  await writeSystemLog(req, 'admin.report.update', {
    entity: 'Report',
    entityId: doc._id,
    metadata: { status: doc.status },
  });

  const targetSummary = await loadTargetSummary(doc.targetType, doc.targetId);
  const populated = await Report.findById(doc._id)
    .populate('reporter', 'username name email')
    .lean();

  res.json({ report: serializeReport(populated, targetSummary) });
});

export const deleteAdminReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    return res.status(400).json({ message: 'Invalid report id' });
  }

  const doc = await Report.findById(reportId);
  if (!doc) return res.status(404).json({ message: 'Report not found' });

  await Report.deleteOne({ _id: doc._id });

  await writeSystemLog(req, 'admin.report.delete', {
    entity: 'Report',
    entityId: doc._id,
  });

  res.json({ ok: true });
});
