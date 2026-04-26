import asyncHandler from '../middlewares/asyncHandler.js';
import User from '../models/User.js';
import { getOnlineUsers } from '../services/presenceService.js';

export const listOnlineUsers = asyncHandler(async (_req, res) => {
  const ids = await getOnlineUsers();
  const users = await User.find({ _id: { $in: ids } })
    .select('username avatar lastSeen')
    .lean();

  res.json({
    count: users.length,
    users,
  });
});
