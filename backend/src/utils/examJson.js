/**
 * Single JSON shape for exam list/detail/upload responses (parity with library viewerState pattern).
 */
export function formatExamForClient(req, exam) {
  const e =
    exam && typeof exam.toObject === 'function' ? exam.toObject() : { ...exam };
  if (!e || e._id == null) return null;

  const viewerId = req?.user?._id ? String(req.user._id) : null;

  const likedBy = Array.isArray(e.likedBy)
    ? e.likedBy.map((id) => String(id))
    : [];
  const dislikedBy = Array.isArray(e.dislikedBy)
    ? e.dislikedBy.map((id) => String(id))
    : [];
  const savedBy = Array.isArray(e.savedBy)
    ? e.savedBy.map((id) => String(id))
    : [];

  let uploadedByFmt = e.uploadedBy;
  const upl = e.uploadedBy;
  if (upl && typeof upl === 'object' && upl._id != null) {
    const subs = Array.isArray(upl.subscribers) ? upl.subscribers : [];
    const sid = String(upl._id);
    uploadedByFmt = {
      _id: upl._id,
      id: sid,
      username: upl.username,
      name: upl.name,
      avatar: upl.avatar,
      subscribersCount: subs.length,
      viewerSubscribed: viewerId
        ? subs.some((id) => String(id) === viewerId)
        : false,
    };
  }

  return {
    id: e._id,
    filename: e.filename,
    fileSize: e.fileSize,
    fileUrl: e.fileUrl,
    processingStatus: e.processingStatus,
    processingError: e.processingError,
    totalQuestions: e.totalQuestions,
    subject: e.subject ?? '',
    topic: e.topic ?? '',
    visibility: e.visibility,
    isDuplicate: e.isDuplicate,
    examKind: e.examKind ?? 'pdf',
    academicTrack: e.academicTrack ?? '',
    department: e.department ?? '',
    courseSubject: e.courseSubject ?? '',
    paperType: e.paperType ?? 'other',
    likesCount:
      typeof e.likesCount === 'number' ? e.likesCount : likedBy.length,
    dislikesCount:
      typeof e.dislikesCount === 'number'
        ? e.dislikesCount
        : dislikedBy.length,
    savesCount:
      typeof e.savesCount === 'number' ? e.savesCount : savedBy.length,
    uploadedBy: uploadedByFmt,
    viewerState: {
      liked: viewerId ? likedBy.includes(viewerId) : false,
      disliked: viewerId ? dislikedBy.includes(viewerId) : false,
      saved: viewerId ? savedBy.includes(viewerId) : false,
    },
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}
