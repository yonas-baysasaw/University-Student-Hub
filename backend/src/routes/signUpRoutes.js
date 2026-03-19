import express from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      provider: "local"
    });
    res.json(user);
  } catch (err) {
    res.status(500).json(err);
  }
});

export default router;