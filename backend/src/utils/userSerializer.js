export const toPublicUser = (user) => {
  if (!user) return null;
  const data = user.toObject ? user.toObject() : { ...user };
  const { password, resetPasswordToken, resetPasswordExpires, ...publicData } =
    data;
  return publicData;
};

/** Session-safe shape for the SPA (matches GET /api/profile; no secrets). */
export const serializeCurrentUser = (user) => {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : { ...user };
  const hasLocalPassword = !!u.password;
  const geminiConfigured = !!String(u.geminiApiKey || '').trim();
  const role = u.role === 'staff' ? 'staff' : 'user';

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
    isStaff: role === 'staff',
    accountType: u.accountType === 'instructor' ? 'instructor' : 'student',
    platformReadOnly: !!u.platformReadOnly,
    instructorPostingSuspended: !!u.instructorPostingSuspended,
  };
};
