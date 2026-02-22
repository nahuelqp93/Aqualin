import type { AqualinRoomState, Board, GameScores, ScoreBreakdown, TileId } from './types';
import { parseTileId } from './game';

const POINTS_BY_SIZE: Record<number, number> = {
  1: 0,
  2: 1,
  3: 3,
  4: 6,
  5: 10,
  6: 15,
};

function neighbors(row: number, col: number): Array<{ row: number; col: number }> {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ];
}

function scoreByKey(board: Board, keyOf: (tile: TileId) => string): ScoreBreakdown {
  const seen = new Set<string>();
  let total = 0;
  let biggestGroup = 0;

  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const tile = board[r][c];
      if (!tile) continue;
      const visitKey = `${r},${c}`;
      if (seen.has(visitKey)) continue;

      const groupKey = keyOf(tile);
      const queue: Array<{ row: number; col: number }> = [{ row: r, col: c }];
      const group: Array<{ row: number; col: number }> = [];
      seen.add(visitKey);

      while (queue.length > 0) {
        const cur = queue.shift() as { row: number; col: number };
        const curTile = board[cur.row][cur.col];
        if (!curTile) continue;
        if (keyOf(curTile) !== groupKey) continue;
        group.push(cur);

        for (const n of neighbors(cur.row, cur.col)) {
          if (n.row < 0 || n.row >= board.length) continue;
          if (n.col < 0 || n.col >= board[n.row].length) continue;
          const nk = `${n.row},${n.col}`;
          if (seen.has(nk)) continue;
          const nt = board[n.row][n.col];
          if (!nt) continue;
          if (keyOf(nt) !== groupKey) continue;
          seen.add(nk);
          queue.push(n);
        }
      }

      const size = group.length;
      biggestGroup = Math.max(biggestGroup, size);
      total += POINTS_BY_SIZE[size] ?? 0;
    }
  }

  return { total, biggestGroup };
}

export function computeScores(room: AqualinRoomState): GameScores {
  const color = scoreByKey(room.board, (tile) => parseTileId(tile).color);
  const animal = scoreByKey(room.board, (tile) => parseTileId(tile).animal);

  let winner: 'color' | 'animal' | 'draw' = 'draw';
  if (color.total > animal.total) winner = 'color';
  if (animal.total > color.total) winner = 'animal';
  if (color.total === animal.total) {
    if (color.biggestGroup > animal.biggestGroup) winner = 'color';
    else if (animal.biggestGroup > color.biggestGroup) winner = 'animal';
    else winner = 'draw';
  }

  return { color, animal, winner };
}
