export const toPublicUser = (user) => {
  if (!user) return null;
  const data = user.toObject ? user.toObject() : { ...user };
  const {
    password,
    resetPasswordToken,
    resetPasswordExpires,
    emailVerificationToken,
    emailVerificationExpires,
    ...publicData
  } = data;
  return publicData;
};

/** Session-safe shape for the SPA (matches GET /api/profile; no secrets). */
export const serializeCurrentUser = (user) => {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : { ...user };
  const hasLocalPassword = !!u.password;
  const geminiConfigured = !!String(u.geminiApiKey || '').trim();
  const role = ['staff', 'admin'].includes(u.role) ? u.role : 'user';

  return {
    id: u._id,
    username: u.username,
    name: u.name,
    email: u.email,
    displayName: u.displayName,
    provider: u.provider,
    photo: u.avatar,
    avatar: u.avatar || null,
    lastSeen: u.lastSeen || null,
    geminiConfigured,
    geminiModelId: u.geminiModelId || '',
    hasLocalPassword,
    role,
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
    isStaff: ['staff', 'admin'].includes(role),
    accountType: u.accountType === 'instructor' ? 'instructor' : 'student',
    department: u.department || '',
    schoolYear: typeof u.schoolYear === 'number' ? u.schoolYear : null,
    emailVerified: !hasLocalPassword || u.email_verified !== false,
    platformReadOnly: !!u.platformReadOnly,
    instructorPostingSuspended: !!u.instructorPostingSuspended,
    status: u.status || 'active',
  };
};
