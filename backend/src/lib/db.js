/**
 * Shared Prisma client (singleton).
 */
import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('warn', (e) => logger.warn({ prisma: e }, 'prisma warn'));
prisma.$on('error', (e) => logger.error({ prisma: e }, 'prisma error'));
