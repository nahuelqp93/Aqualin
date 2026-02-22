import type {
  Animal,
  AqualinRoomState,
  Board,
  Color,
  Coord,
  PlayerId,
  PlayerRole,
  TileId,
  TurnMove,
  TurnPlacement,
} from './types';
import { computeScores } from './score';

const BOARD_SIZE = 6;

export const COLORS: Color[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
export const ANIMALS: Animal[] = [
  'starfish',
  'crab',
  'turtle',
  'fish',
  'seahorse',
  'jellyfish',
];

export function makeEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
}

export function isCoordInBounds(coord: Coord): boolean {
  return (
    coord.row >= 0 &&
    coord.row < BOARD_SIZE &&
    coord.col >= 0 &&
    coord.col < BOARD_SIZE
  );
}

export function tileId(color: Color, animal: Animal): TileId {
  return `${color}:${animal}`;
}

export function parseTileId(id: TileId): { color: Color; animal: Animal } {
  const [color, animal] = id.split(':');
  if (!color || !animal) throw new Error('Invalid tile id');
  return { color: color as Color, animal: animal as Animal };
}

export function generateAllTiles(): TileId[] {
  const tiles: TileId[] = [];
  for (const c of COLORS) {
    for (const a of ANIMALS) {
      tiles.push(tileId(c, a));
    }
  }
  return tiles;
}

function hashToUint32(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function makeRng(seed: string): () => number {
  let state = hashToUint32(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const u = state >>> 0;
    return u / 0xffffffff;
  };
}

export function shuffle<T>(items: T[], seed: string): T[] {
  const rng = makeRng(seed);
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function randomToken(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function computeSlideEnd(board: Board, from: Coord, to: Coord): Coord {
  if (from.row !== to.row && from.col !== to.col) {
    throw new Error('Move must be orthogonal');
  }
  const dRow = Math.sign(to.row - from.row);
  const dCol = Math.sign(to.col - from.col);
  if (dRow === 0 && dCol === 0) throw new Error('Move must change position');

  let row = from.row;
  let col = from.col;

  while (true) {
    const next = { row: row + dRow, col: col + dCol };
    if (!isCoordInBounds(next)) return { row, col };
    if (board[next.row]?.[next.col] !== null) return { row, col };
    row = next.row;
    col = next.col;
  }
}

function isClearOrthogonalPath(board: Board, from: Coord, to: Coord): boolean {
  if (from.row !== to.row && from.col !== to.col) return false;
  const dRow = Math.sign(to.row - from.row);
  const dCol = Math.sign(to.col - from.col);
  if (dRow === 0 && dCol === 0) return false;

  let row = from.row + dRow;
  let col = from.col + dCol;
  while (row !== to.row || col !== to.col) {
    if (board[row]?.[col] !== null) return false;
    row += dRow;
    col += dCol;
  }

  return true;
}

export function otherPlayerId(room: AqualinRoomState, playerId: PlayerId): PlayerId | null {
  const other = room.players.find((p) => p.id !== playerId);
  return other?.id ?? null;
}

export function createInitialRoomState(params: {
  code: string;
  creatorRole: PlayerRole;
  creatorId: PlayerId;
  creatorToken: string;
  seed: string;
  now: number;
}): AqualinRoomState {
  const tiles = shuffle(generateAllTiles(), params.seed);
  const offer = tiles.slice(0, 6);
  const reserve = tiles.slice(6);

  return {
    code: params.code,
    status: 'lobby',
    createdAt: params.now,
    updatedAt: params.now,
    players: [
      {
        id: params.creatorId,
        token: params.creatorToken,
        role: params.creatorRole,
        joinedAt: params.now,
      },
    ],
    currentPlayerId: params.creatorId,
    board: makeEmptyBoard(),
    offer,
    reserve,
    placedCount: 0,
  };
}

export function addSecondPlayer(room: AqualinRoomState, params: {
  id: PlayerId;
  token: string;
  role: PlayerRole;
  now: number;
}): AqualinRoomState {
  if (room.players.length >= 2) throw new Error('Room is full');
  const next: AqualinRoomState = {
    ...room,
    updatedAt: params.now,
    players: room.players.concat({
      id: params.id,
      token: params.token,
      role: params.role,
      joinedAt: params.now,
    }),
    status: 'in_progress',
  };
  return next;
}

export function validateAndApplyTurn(room: AqualinRoomState, params: {
  playerToken: string;
  move?: TurnMove;
  placement: TurnPlacement;
  now: number;
}): AqualinRoomState {
  if (room.status !== 'in_progress') throw new Error('Game is not in progress');
  if (room.players.length !== 2) throw new Error('Room needs 2 players');
  if (!room.currentPlayerId) throw new Error('No current player');

  const currentPlayer = room.players.find((p) => p.id === room.currentPlayerId);
  if (!currentPlayer) throw new Error('Current player not found');
  if (currentPlayer.token !== params.playerToken) throw new Error('Not your turn');

  const board = room.board.map((row) => row.slice());

  if (params.move) {
    if (room.placedCount === 0) {
      throw new Error('First turn cannot move a tile');
    }
    const { from, to } = params.move;
    if (!isCoordInBounds(from) || !isCoordInBounds(to)) throw new Error('Out of bounds');
    const movingTile = board[from.row][from.col];
    if (!movingTile) throw new Error('No tile at from');
    if (board[to.row][to.col] !== null) throw new Error('Destination not empty');

    if (!isClearOrthogonalPath(board, from, to)) {
      throw new Error('Invalid move path');
    }

    board[from.row][from.col] = null;
    board[to.row][to.col] = movingTile;
  }

  const { offerIndex, at } = params.placement;
  if (!isCoordInBounds(at)) throw new Error('Out of bounds');
  if (board[at.row][at.col] !== null) throw new Error('Cell not empty');
  if (!Number.isInteger(offerIndex) || offerIndex < 0 || offerIndex >= room.offer.length) {
    throw new Error('Invalid offer index');
  }

  const chosenTile = room.offer[offerIndex];
  const nextOffer = room.offer.slice();
  nextOffer.splice(offerIndex, 1);
  const nextReserve = room.reserve.slice();

  board[at.row][at.col] = chosenTile;
  let offerAfterReplenish = nextOffer;
  if (nextReserve.length > 0) {
    offerAfterReplenish = offerAfterReplenish.concat(nextReserve.shift() as TileId);
  }

  const nextPlacedCount = room.placedCount + 1;
  const isFinished = nextPlacedCount >= 36;

  const nextCurrentPlayerId = isFinished
    ? null
    : (otherPlayerId(room, room.currentPlayerId) as PlayerId);

  const nextRoom: AqualinRoomState = {
    ...room,
    updatedAt: params.now,
    board,
    offer: offerAfterReplenish,
    reserve: nextReserve,
    placedCount: nextPlacedCount,
    currentPlayerId: nextCurrentPlayerId,
    status: isFinished ? 'finished' : room.status,
    lastError: undefined,
  };

  if (isFinished) {
    nextRoom.scores = computeScores(nextRoom);
  }

  return nextRoom;
}
