import { NextResponse } from 'next/server';

import { addSecondPlayer, randomToken } from '@/lib/aqualin/game';
import type { PlayerRole } from '@/lib/aqualin/types';
import { getRoomStore } from '@/lib/rooms/store';
import { toClientRoomState } from '@/lib/rooms/client';

export async function POST(req: Request) {
  const now = Date.now();
  const store = getRoomStore();
  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: 'Falta el código de sala' }, { status: 400 });
  }

  try {
    const room = await store.updateRoom(code, (current) => {
      if (current.players.length >= 2) throw new Error('Room is full');

      const usedRoles = new Set(current.players.map((p) => p.role));
      const role: PlayerRole = usedRoles.has('color') ? 'animal' : 'color';
      return addSecondPlayer(current, {
        id: randomToken(),
        token: randomToken(),
        role,
        now,
      });
    });

    const me = room.players[1];
    return NextResponse.json({
      code,
      token: me.token,
      playerId: me.id,
      role: me.role,
      room: toClientRoomState(room, me.token),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo unir a la sala';
    const status = msg === 'Room not found' ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
