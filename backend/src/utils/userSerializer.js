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
  const role = u.role === 'admin' ? 'admin' : 'user';

  return {
    id: u._id,
    username: u.username,
    name: u.name,
    email: u.email,
    showEmailPublic: !!u.showEmailPublic,
    phone: u.phone || '',
    campus: u.campus || '',
    emergencyContact: u.emergencyContact || '',
    displayName: u.displayName,
    provider: u.provider,
    photo: u.avatar,
    avatar: u.avatar || null,
    lastSeen: u.lastSeen || null,
    hasLocalPassword,
    role,
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
    isAdmin: u.role === 'admin',
    accountType: u.accountType === 'instructor' ? 'instructor' : 'student',
    department: u.department || '',
    schoolYear: typeof u.schoolYear === 'number' ? u.schoolYear : null,
    bio: u.bio || '',
    interests: u.interests || '',
    careerGoals: u.careerGoals || '',
    skills: u.skills || '',
    socialTelegram: u.socialTelegram || '',
    socialLinkedIn: u.socialLinkedIn || '',
    socialInstagram: u.socialInstagram || '',
    socialFacebook: u.socialFacebook || '',
    socialUpwork: u.socialUpwork || '',
    socialGitHub: u.socialGitHub || '',
    emailVerified: !hasLocalPassword || u.email_verified !== false,
    platformReadOnly: !!u.platformReadOnly,
    instructorPostingSuspended: !!u.instructorPostingSuspended,
    status: u.status || 'active',
    geminiConfigured: !!u.geminiKeySet,
    geminiModelId: u.geminiModelId || '',
  };
};
