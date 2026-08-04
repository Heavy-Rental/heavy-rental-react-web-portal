'use strict';

const { MockServer } = require('@r35007/mock-server');

const host = process.env.MOCK_API_HOST || '127.0.0.1';
const port = Number(process.env.MOCK_API_PORT) || 4010;

const mockServer = MockServer.Create({
  root: __dirname,
  base: '/api',
  host,
  port,
  homePage: false,
});

// Registered before the db resources so it responds outside the /api base,
// letting CI poll it for readiness (MOCK_API_HEALTH_PATH=/health).
mockServer.app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

mockServer.launchServer('./db.json').catch((err) => {
  console.error('Failed to start mock server:', err);
  process.exit(1);
});
