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
      const current = await kv.get<AqualinRoomState>(key);
      if (!current) throw new Error('Room not found');
      const next = updater(current);
      await kv.set(key, next);
      return next;
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
      const raw = await redis.get<string>(key);
      if (!raw) throw new Error('Room not found');
      const current = JSON.parse(raw) as AqualinRoomState;
      const next = updater(current);
      await redis.set(key, JSON.stringify(next));
      return next;
    },
  };
}

export function getRoomStore(): RoomStore {
  if (hasUpstashEnv()) return upstashStore();
  if (hasKvEnv()) return kvStore();
  return memoryStore();
}
