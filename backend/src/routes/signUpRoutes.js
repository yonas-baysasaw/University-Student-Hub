import express from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import { createLocalUser } from '../services/userService.js';
import { toPublicUser } from '../utils/userSerializer.js';

const router = express.Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;
    const user = await createLocalUser({ username, email, password });
    res.status(201).json({ user: toPublicUser(user) });
  })
);

export default router;
