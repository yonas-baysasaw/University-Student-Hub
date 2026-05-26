import asyncHandler from '../middlewares/asyncHandler.js';
import { createReport } from '../services/reportService.js';

export const submitReport = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const targetType = String(body.targetType || '').trim().toLowerCase();
  const targetId = String(body.targetId || '').trim();
  const reasonCode = String(body.reasonCode || '').trim();
  const description = body.description;

  if (!targetType || !targetId || !reasonCode) {
    return res.status(400).json({
      message: 'targetType, targetId, and reasonCode are required',
    });
  }

  const report = await createReport({
    userId: req.user._id,
    targetType,
    targetId,
    reasonCode,
    description,
  });

  res.status(201).json({
    ok: true,
    report: {
      id: String(report._id),
      targetType: report.targetType,
      targetId: report.targetId,
      status: report.status,
      createdAt: report.createdAt,
    },
  });
});
