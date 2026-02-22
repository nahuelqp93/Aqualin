import { NextResponse } from 'next/server';

import type { SubmitTurnRequest } from '@/lib/aqualin/types';
import { validateAndApplyTurn } from '@/lib/aqualin/game';
import { getRoomStore } from '@/lib/rooms/store';
import { toClientRoomState } from '@/lib/rooms/client';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const now = Date.now();
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => null)) as SubmitTurnRequest | null;
  if (!body?.token || !body.placement) {
    return NextResponse.json({ error: 'Request inválido' }, { status: 400 });
  }

  const store = getRoomStore();
  try {
    const updated = await store.updateRoom(code.toUpperCase(), (current) => {
      try {
        return validateAndApplyTurn(current, {
          playerToken: body.token,
          move: body.move,
          placement: body.placement,
          now,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Turno inválido';
        return { ...current, updatedAt: now, lastError: msg };
      }
    });

    return NextResponse.json({ room: toClientRoomState(updated, body.token) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo procesar el turno';
    const status = msg === 'Room not found' ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
