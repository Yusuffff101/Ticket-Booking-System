import http from 'http';
import { createApp } from './app.js';
import { config } from './config/env.js';
import prisma from './config/prisma.js';
import { initSocketServer } from './sockets/socket.gateway.js';
import { holdExpiryWorker } from './workers/holdExpiry.worker.js';
import { offerExpiryWorker } from './workers/offerExpiry.worker.js';

const app = createApp();
const server = http.createServer(app);

// Initialize Socket.IO on the same HTTP server
initSocketServer(server);

const startServer = async () => {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('✅ PostgreSQL Database connected successfully via Prisma.');

    server.listen(config.port, () => {
      console.log(`🚀 Ticket Booking Server running in [${config.nodeEnv}] on port ${config.port}`);
      console.log(`📡 Healthcheck available at: http://localhost:${config.port}/api/health`);
      console.log(`🔌 Socket.IO real-time engine active on ws://localhost:${config.port}`);
      // Start background hold & offer expiry reconciliation workers
      holdExpiryWorker.start();
      offerExpiryWorker.start();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server and disconnecting Prisma...');
  holdExpiryWorker.stop();
  offerExpiryWorker.stop();
  await prisma.$disconnect();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

startServer();

