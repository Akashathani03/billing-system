import User from '../models/User.js';
import { verifyPassword, signToken, getAuthCookieOptions } from '../services/auth.service.js';

export async function login(req, res) {
  const { username, password } = req.body;

  const user = await User.findOne({ username, isActive: true }).select('+passwordHash');
  const isValid = user && (await verifyPassword(password, user.passwordHash));

  if (!isValid) {
    return res.status(401).json({
      error: { message: 'Invalid username or password', code: 'INVALID_CREDENTIALS' },
    });
  }

  const token = signToken({
    id: user._id,
    username: user.username,
    name: user.name,
    role: user.role,
  });
  res.cookie(process.env.COOKIE_NAME, token, getAuthCookieOptions());

  res.json({
    user: { id: user._id, username: user.username, name: user.name, role: user.role },
  });
}

export function logout(req, res) {
  res.clearCookie(process.env.COOKIE_NAME, getAuthCookieOptions());
  res.json({ message: 'Logged out' });
}

export function me(req, res) {
  res.json({ user: req.user });
}
