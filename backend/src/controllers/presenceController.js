import User from '../models/User.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { getOnlineUsers } from '../services/presenceService.js';

export const listOnlineUsers = asyncHandler(async (req, res) => {
  const ids = await getOnlineUsers();
  const users = await User.find({ _id: { $in: ids } })
    .select('username avatar lastSeen')
    .lean();

  res.json({
    count: users.length,
    users,
  });
});
