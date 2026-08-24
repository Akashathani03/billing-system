import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    db: dbStates[mongoose.connection.readyState] || 'unknown',
  });
});

export default router;
