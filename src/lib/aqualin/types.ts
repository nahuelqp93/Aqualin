export type Animal =
  | 'starfish'
  | 'crab'
  | 'turtle'
  | 'fish'
  | 'seahorse'
  | 'jellyfish';

export type Color = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';

export type PlayerRole = 'color' | 'animal';

export type PlayerId = string;
export type PlayerToken = string;

export type TileId = string;

export type Coord = { row: number; col: number };

export type Board = Array<Array<TileId | null>>;

export type GameStatus = 'lobby' | 'in_progress' | 'finished';

export type RoomCode = string;

export type AqualinPlayer = {
  id: PlayerId;
  token: PlayerToken;
  role: PlayerRole;
  joinedAt: number;
};

export type TurnMove = {
  from: Coord;
  to: Coord;
};

export type TurnPlacement = {
  offerIndex: number;
  at: Coord;
};

export type SubmitTurnRequest = {
  token: PlayerToken;
  move?: TurnMove;
  placement: TurnPlacement;
};

export type ScoreBreakdown = {
  total: number;
  biggestGroup: number;
};

export type GameScores = {
  color: ScoreBreakdown;
  animal: ScoreBreakdown;
  winner: 'color' | 'animal' | 'draw';
};

export type AqualinRoomState = {
  code: RoomCode;
  status: GameStatus;
  createdAt: number;
  updatedAt: number;

  players: AqualinPlayer[];
  currentPlayerId: PlayerId | null;

  board: Board;
  offer: TileId[];
  reserve: TileId[];
  placedCount: number;

  lastError?: string;
  scores?: GameScores;
};
