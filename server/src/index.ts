import { app } from './app';
import { config } from './config';
import { pool } from './db';

const server = app.listen(config.port, () => {
  console.log(`🚀 Server running in ${config.nodeEnv} mode on port ${config.port}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down server...');
  server.close(async () => {
    console.log('HTTP server closed');
    await pool.end();
    console.log('Database pool closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
