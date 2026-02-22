import { NextResponse } from 'next/server';

import { getRoomStore } from '@/lib/rooms/store';
import { toClientRoomState } from '@/lib/rooms/client';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const token = new URL(req.url).searchParams.get('token');
  const store = getRoomStore();
  const room = await store.getRoom(code.toUpperCase());
  if (!room) {
    return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 });
  }
  return NextResponse.json({ room: toClientRoomState(room, token) });
}
