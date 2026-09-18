import { verifyToken } from '../services/auth.service.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.[process.env.COOKIE_NAME];

  if (!token) {
    return res.status(401).json({
      error: { message: 'Not authenticated', code: 'UNAUTHENTICATED' },
    });
  }

  try {
    const payload = verifyToken(token);
    // shopId is the authorization boundary for every protected route below —
    // it comes from the signed JWT payload only, never from anything the
    // client supplies on the request itself.
    req.user = {
      id: payload.id,
      username: payload.username,
      name: payload.name,
      role: payload.role,
      shopId: payload.shopId,
    };
    next();
  } catch {
    return res.status(401).json({
      error: { message: 'Not authenticated', code: 'UNAUTHENTICATED' },
    });
  }
}
