import request from 'supertest';
import User from '../../models/User.js';
import { hashPassword } from '../../services/auth.service.js';

export async function loginAsOwner(app, overrides = {}) {
  const username = overrides.username || 'owner';
  const password = overrides.password || 'secret123';

  const passwordHash = await hashPassword(password);
  await User.create({
    username,
    passwordHash,
    name: overrides.name || 'Owner',
    role: overrides.role || 'owner',
  });

  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username, password });
  return agent;
}
