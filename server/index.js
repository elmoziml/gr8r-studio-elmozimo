import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import { ensureDataDirs } from './config.js';
import { closePool, getPool } from './db/pool.js';
import setupRoutes, { getSetupStatus } from './routes/setup.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBootstrapRoutes } from './routes/bootstrap.js';
import { registerWorkspaceRoutes } from './routes/workspace.js';
import { registerMemberRoutes } from './routes/members.js';

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = path.resolve('dist');
const INDEX_FILE = path.join(DIST_DIR, 'index.html');

export async function buildServer(options = {}) {
  const app = Fastify({
    logger: options.logger ?? { level: process.env.LOG_LEVEL || 'info' },
    trustProxy: process.env.TRUST_PROXY === '1',
    bodyLimit: 5 * 1024 * 1024,
  });

  ensureDataDirs();
  await app.register(fastifyCookie);
  await app.register(setupRoutes);
  await app.register(registerAuthRoutes);
  await app.register(registerBootstrapRoutes);
  await app.register(registerWorkspaceRoutes);
  await app.register(registerMemberRoutes);

  app.get('/api/health', async () => {
    const status = await getSetupStatus();
    return {
      data: {
        ok: true,
        database: status.connected ? 'up' : 'down',
        configured: status.configured,
        initialized: status.initialized,
      },
    };
  });

  app.get('/api/ready', async (request, reply) => {
    const status = await getSetupStatus();
    if (!status.connected) return reply.code(503).send({ data: { ready: false, database: 'down' } });
    try {
      await getPool().query('select 1');
      return { data: { ready: true, database: 'up' } };
    } catch {
      return reply.code(503).send({ data: { ready: false, database: 'down' } });
    }
  });

  if (fs.existsSync(DIST_DIR)) {
    await app.register(fastifyStatic, { root: DIST_DIR, prefix: '/' });
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) return reply.code(404).send({ message: 'Endpoint not found' });
    if (fs.existsSync(INDEX_FILE)) return reply.type('text/html').send(fs.createReadStream(INDEX_FILE));
    return reply.code(404).send({ message: 'Frontend build not found. Run npm run build.' });
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) request.log.error(error);
    return reply.code(statusCode).send({ message: error.message || 'Internal server error' });
  });

  return app;
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  const app = await buildServer();
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Gr8r Studio server listening on http://${HOST}:${PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  const shutdown = async signal => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
