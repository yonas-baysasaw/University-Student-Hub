export const toPublicUser = (user) => {
  if (!user) return null;
  const data = user.toObject ? user.toObject() : { ...user };
  const { password, resetPasswordToken, resetPasswordExpires, ...publicData } =
    data;
  return publicData;
};
