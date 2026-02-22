import { NextResponse } from 'next/server';

import { createInitialRoomState, randomToken } from '@/lib/aqualin/game';
import type { PlayerRole } from '@/lib/aqualin/types';
import { getRoomStore } from '@/lib/rooms/store';
import { toClientRoomState } from '@/lib/rooms/client';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export async function POST(req: Request) {
  const now = Date.now();
  const store = getRoomStore();

  const body = (await req.json().catch(() => ({}))) as { creatorRole?: PlayerRole };
  const creatorRole: PlayerRole = body.creatorRole ?? 'color';

  const creatorId = randomToken();
  const creatorToken = randomToken();

  for (let i = 0; i < 20; i++) {
    const code = randomCode(6);
    const seed = `${code}:${now}:${randomToken()}`;
    const room = createInitialRoomState({
      code,
      creatorRole,
      creatorId,
      creatorToken,
      seed,
      now,
    });
    try {
      await store.createRoom(room);
      return NextResponse.json({
        code,
        token: creatorToken,
        playerId: creatorId,
        role: creatorRole,
        room: toClientRoomState(room, creatorToken),
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: 'No se pudo crear la sala' }, { status: 500 });
}
