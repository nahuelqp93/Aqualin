import type {
  AqualinRoomState,
  PlayerId,
  PlayerRole,
  RoomCode,
  TileId,
} from '@/lib/aqualin/types';

export type ClientPlayer = { id: PlayerId; role: PlayerRole };

export type ClientRoomState = {
  code: RoomCode;
  status: AqualinRoomState['status'];
  players: ClientPlayer[];
  you: ClientPlayer | null;
  currentPlayerId: PlayerId | null;
  board: AqualinRoomState['board'];
  offer: TileId[];
  reserveCount: number;
  placedCount: number;
  scores?: AqualinRoomState['scores'];
  lastError?: string;
};

export function toClientRoomState(room: AqualinRoomState, token: string | null): ClientRoomState {
  const players = room.players.map((p) => ({ id: p.id, role: p.role }));
  const you = token
    ? (() => {
        const me = room.players.find((p) => p.token === token);
        return me ? { id: me.id, role: me.role } : null;
      })()
    : null;

  return {
    code: room.code,
    status: room.status,
    players,
    you,
    currentPlayerId: room.currentPlayerId,
    board: room.board,
    offer: room.offer,
    reserveCount: room.reserve.length,
    placedCount: room.placedCount,
    scores: room.scores,
    lastError: room.lastError,
  };
}
