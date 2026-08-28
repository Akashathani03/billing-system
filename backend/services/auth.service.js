import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

const DURATION_UNITS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDurationToMs(duration) {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration);
  if (!match) {
    throw new Error(`Unsupported duration format: "${duration}"`);
  }
  const [, amount, unit] = match;
  return Number(amount) * DURATION_UNITS[unit];
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    path: '/',
    maxAge: parseDurationToMs(process.env.JWT_EXPIRES_IN),
  };
}
