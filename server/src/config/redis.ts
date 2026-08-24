import { Redis } from 'ioredis';
import { config } from './env.js';

class InMemoryRedisFallback {
  private store: Map<string, string> = new Map();
  private expirations: Map<string, NodeJS.Timeout> = new Map();

  async set(key: string, value: string, modeOrCondition?: string, duration?: number | string, conditionOrMode?: string): Promise<'OK' | null> {
    const isNX = modeOrCondition === 'NX' || conditionOrMode === 'NX';
    if (isNX && this.store.has(key)) {
      return null;
    }

    this.store.set(key, value);

    if (this.expirations.has(key)) {
      clearTimeout(this.expirations.get(key)!);
      this.expirations.delete(key);
    }

    const numDuration = typeof duration === 'number' ? duration : typeof duration === 'string' ? parseInt(duration, 10) : 0;
    const isPX = modeOrCondition === 'PX' || conditionOrMode === 'PX';
    const isEX = modeOrCondition === 'EX' || conditionOrMode === 'EX';

    if (numDuration > 0) {
      const ttlMs = isPX ? numDuration : isEX ? numDuration * 1000 : numDuration;
      const timeout = setTimeout(() => {
        this.store.delete(key);
        this.expirations.delete(key);
      }, ttlMs);
      this.expirations.set(key, timeout);
    }

    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.has(key)) {
        this.store.delete(key);
        if (this.expirations.has(key)) {
          clearTimeout(this.expirations.get(key)!);
          this.expirations.delete(key);
        }
        deleted++;
      }
    }
    return deleted;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter((k) => regex.test(k));
  }
}

const fallback = new InMemoryRedisFallback();
let realClient: Redis | null = null;
let isConnected = false;

try {
  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => (times > 2 ? null : 500),
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on('error', () => {
    isConnected = false;
  });

  client.connect().then(() => {
    isConnected = true;
    realClient = client;
    console.log('⚡ Connected to Redis instance successfully.');
  }).catch(() => {
    isConnected = false;
    console.info('ℹ️ Redis instance not detected at ' + config.redisUrl + '. Using high-performance in-memory lock engine.');
  });
} catch {
  isConnected = false;
}

export const redis = {
  async set(key: string, value: string, ...args: any[]): Promise<'OK' | null> {
    if (isConnected && realClient && realClient.status === 'ready') {
      try {
        return (await (realClient as any).set(key, value, ...args)) as 'OK' | null;
      } catch {
        // Fallback on unexpected transient error
        return (fallback as any).set(key, value, ...args);
      }
    }
    return (fallback as any).set(key, value, ...args);
  },

  async get(key: string): Promise<string | null> {
    if (isConnected && realClient && realClient.status === 'ready') {
      try {
        return await realClient.get(key);
      } catch {
        return fallback.get(key);
      }
    }
    return fallback.get(key);
  },

  async del(...keys: string[]): Promise<number> {
    if (isConnected && realClient && realClient.status === 'ready') {
      try {
        return await realClient.del(...keys);
      } catch {
        return fallback.del(...keys);
      }
    }
    return fallback.del(...keys);
  },

  async keys(pattern: string): Promise<string[]> {
    if (isConnected && realClient && realClient.status === 'ready') {
      try {
        return await realClient.keys(pattern);
      } catch {
        return fallback.keys(pattern);
      }
    }
    return fallback.keys(pattern);
  },
};

export default redis;
