import 'server-only';

import type { AqualinRoomState, RoomCode } from '@/lib/aqualin/types';

export type RoomStore = {
  getRoom: (code: RoomCode) => Promise<AqualinRoomState | null>;
  createRoom: (room: AqualinRoomState) => Promise<void>;
  updateRoom: (
    code: RoomCode,
    updater: (current: AqualinRoomState) => AqualinRoomState,
  ) => Promise<AqualinRoomState>;
};

function roomKey(code: RoomCode): string {
  return `room:${code}`;
}

function hasKvEnv(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN &&
    process.env.KV_URL,
  );
}

function hasUpstashEnv(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function getGlobalMemoryStore(): Map<string, AqualinRoomState> {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    const missingKv = [
      !process.env.KV_REST_API_URL && 'KV_REST_API_URL',
      !process.env.KV_REST_API_TOKEN && 'KV_REST_API_TOKEN',
      !process.env.KV_URL && 'KV_URL',
    ].filter(Boolean);

    const missingUpstash = [
      !process.env.UPSTASH_REDIS_REST_URL && 'UPSTASH_REDIS_REST_URL',
      !process.env.UPSTASH_REDIS_REST_TOKEN && 'UPSTASH_REDIS_REST_TOKEN',
    ].filter(Boolean);

    console.warn(
      '⚠️ [AQUALIN] Usando memoryStore en producción/Vercel. ' +
      'Las salas se perderán cuando la instancia se reinicie. ' +
      'Faltan variables: ' +
      (missingKv.length > 0 ? `[KV: ${missingKv.join(', ')}] ` : '') +
      (missingUpstash.length > 0 ? `[Upstash: ${missingUpstash.join(', ')}]` : ''),
    );
  }
  const g = globalThis as unknown as { __aqualinRooms?: Map<string, AqualinRoomState> };
  if (!g.__aqualinRooms) g.__aqualinRooms = new Map();
  return g.__aqualinRooms;
}

function memoryStore(): RoomStore {
  const map = getGlobalMemoryStore();
  return {
    async getRoom(code) {
      return map.get(roomKey(code)) ?? null;
    },
    async createRoom(room) {
      const key = roomKey(room.code);
      if (map.has(key)) throw new Error('Room already exists');
      map.set(key, room);
    },
    async updateRoom(code, updater) {
      const key = roomKey(code);
      const current = map.get(key);
      if (!current) throw new Error('Room not found');
      const next = updater(current);
      map.set(key, next);
      return next;
    },
  };
}

function kvStore(): RoomStore {
  return {
    async getRoom(code) {
      const { kv } = await import('@vercel/kv');
      const val = await kv.get<AqualinRoomState>(roomKey(code));
      return val ?? null;
    },
    async createRoom(room) {
      const { kv } = await import('@vercel/kv');
      const key = roomKey(room.code);
      const ok = await kv.set(key, room, { nx: true });
      if (ok !== 'OK') throw new Error('Room already exists');
    },
    async updateRoom(code, updater) {
      const { kv } = await import('@vercel/kv');
      const key = roomKey(code);

      for (let i = 0; i < 5; i++) {
        const current = await kv.get<AqualinRoomState>(key);
        if (!current) throw new Error('Room not found');

        const next = updater({ ...current });
        const lastUpdateAt = current.updatedAt;
        next.updatedAt = Date.now();

        // Atomic Check-and-Set using Lua
        const script = `
          local current = redis.call('get', KEYS[1])
          if not current then return -1 end
          local decoded = cjson.decode(current)
          if tonumber(decoded.updatedAt) == tonumber(ARGV[1]) then
            redis.call('set', KEYS[1], ARGV[2])
            return 1
          else
            return 0
          end
        `;

        const result = await (kv.eval as any)(
          script,
          [key],
          [String(lastUpdateAt), JSON.stringify(next)],
        );

        if (result === 1) return next;
        if (result === -1) throw new Error('Room disappeared during update');

        // Conflict - retry after small delay
        await new Promise((r) => setTimeout(r, 50 * (i + 1)));
      }

      throw new Error('Too many conflicts updating room');
    },
  };
}

function upstashStore(): RoomStore {
  return {
    async getRoom(code) {
      const { Redis } = await import('@upstash/redis');
      const redis = Redis.fromEnv();
      const raw = await redis.get<string>(roomKey(code));
      if (!raw) return null;
      return JSON.parse(raw) as AqualinRoomState;
    },
    async createRoom(room) {
      const { Redis } = await import('@upstash/redis');
      const redis = Redis.fromEnv();
      const ok = await redis.set(roomKey(room.code), JSON.stringify(room), { nx: true });
      if (ok !== 'OK') throw new Error('Room already exists');
    },
    async updateRoom(code, updater) {
      const { Redis } = await import('@upstash/redis');
      const redis = Redis.fromEnv();
      const key = roomKey(code);

      for (let i = 0; i < 5; i++) {
        const raw = await redis.get<string>(key);
        if (!raw) throw new Error('Room not found');
        const current = typeof raw === 'string' ? JSON.parse(raw) as AqualinRoomState : raw as AqualinRoomState;

        const next = updater({ ...current });
        const lastUpdateAt = current.updatedAt;
        next.updatedAt = Date.now();

        const script = `
          local current = redis.call('get', KEYS[1])
          if not current then return -1 end
          local decoded = cjson.decode(current)
          if tonumber(decoded.updatedAt) == tonumber(ARGV[1]) then
            redis.call('set', KEYS[1], ARGV[2])
            return 1
          else
            return 0
          end
        `;

        const result = await (redis.eval as any)(
          script,
          [key],
          [String(lastUpdateAt), JSON.stringify(next)],
        );

        if (result === 1) return next;
        if (result === -1) throw new Error('Room disappeared during update');

        await new Promise((r) => setTimeout(r, 50 * (i + 1)));
      }

      throw new Error('Too many conflicts updating room');
    },
  };
}

export function getRoomStore(): RoomStore {
  if (hasUpstashEnv()) return upstashStore();
  if (hasKvEnv()) return kvStore();
  return memoryStore();
}
