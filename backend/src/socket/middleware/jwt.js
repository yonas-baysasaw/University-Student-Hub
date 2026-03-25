import User from '../../models/User.js';

export const authenticateSocket = async (socket, next) => {
  try {
    const session = socket.request?.session;
    const userId = session?.passport?.user;

    if (!userId) {
      throw new Error('Not authenticated');
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new Error('User not found');
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error(error.message || 'Socket authentication failed'));
  }
};
