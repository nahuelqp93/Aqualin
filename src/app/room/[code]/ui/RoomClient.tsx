'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ClientRoomState } from '@/lib/rooms/client';
import { parseTileId } from '@/lib/aqualin/game';
import type { Coord, TurnMove, TurnPlacement } from '@/lib/aqualin/types';

import styles from './tiles.module.css';
import roomStyles from './room.module.css';

const COLOR_ROW: Record<string, number> = {
  blue: 0,
  green: 1,
  purple: 2,
  orange: 3,
  red: 4,
  yellow: 5,
};

const ANIMAL_COL: Record<string, number> = {
  crab: 0,
  fish: 1,
  jellyfish: 2,
  seahorse: 3,
  starfish: 4,
  turtle: 5,
};

function coordKey(c: Coord): string {
  return `${c.row},${c.col}`;
}

function eqCoord(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

function computeSlideDestinations(board: Array<Array<string | null>>, from: Coord): Coord[] {
  const dirs: Coord[] = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  const res: Coord[] = [];
  for (const d of dirs) {
    let r = from.row;
    let c = from.col;
    while (true) {
      const nr = r + d.row;
      const nc = c + d.col;
      if (nr < 0 || nr >= 6 || nc < 0 || nc >= 6) break;
      if (board[nr][nc] !== null) break;
      r = nr;
      c = nc;
      res.push({ row: r, col: c });
    }
  }
  return res;
}

function applyPreviewMove(board: Array<Array<string | null>>, move: TurnMove | null): Array<Array<string | null>> {
  const next = board.map((row) => row.slice());
  if (!move) return next;
  const tile = next[move.from.row][move.from.col];
  if (!tile) return next;
  next[move.from.row][move.from.col] = null;
  next[move.to.row][move.to.col] = tile;
  return next;
}

export default function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const [room, setRoom] = useState<ClientRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tokenRef = useRef<string | null>(null);

  const [selectedOfferIndex, setSelectedOfferIndex] = useState<number | null>(null);
  const [selectedPlacement, setSelectedPlacement] = useState<Coord | null>(null);

  const [moveFrom, setMoveFrom] = useState<Coord | null>(null);
  const [moveTo, setMoveTo] = useState<Coord | null>(null);
  const [moveConfirmed, setMoveConfirmed] = useState(false);

  useEffect(() => {
    tokenRef.current = localStorage.getItem(`aqualin:token:${code}`);
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = tokenRef.current;
        const url = token ? `/api/rooms/${code}/state?token=${encodeURIComponent(token)}` : `/api/rooms/${code}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = (await res.json()) as { room?: ClientRoomState; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Error al cargar sala');
        if (!cancelled) {
          setRoom(data.room ?? null);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error');
      }
    }

    load();
    const id = setInterval(load, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [code]);

  const you = room?.you;
  const isYourTurn = Boolean(room && you && room.currentPlayerId === you.id && room.status === 'in_progress');
  const isFirstTurn = (room?.placedCount ?? 0) === 0;
  const moveRequired = Boolean(room && room.status === 'in_progress' && !isFirstTurn);

  const previewBoard = useMemo(() => {
    if (!room) return null;
    const mv = moveFrom && moveTo ? ({ from: moveFrom, to: moveTo } satisfies TurnMove) : null;
    return applyPreviewMove(room.board, mv);
  }, [room, moveFrom, moveTo]);

  const legalMoveDestinations = useMemo(() => {
    if (!room || !moveFrom) return [];
    return computeSlideDestinations(room.board, moveFrom);
  }, [room, moveFrom]);

  const canConfirmMove =
    Boolean(isYourTurn) &&
    Boolean(tokenRef.current) &&
    Boolean(moveRequired) &&
    Boolean(moveFrom && moveTo) &&
    !moveConfirmed;

  const canConfirmPlacement =
    Boolean(isYourTurn) &&
    Boolean(tokenRef.current) &&
    selectedOfferIndex !== null &&
    selectedPlacement !== null &&
    (!moveRequired || moveConfirmed);

  async function confirmTurn() {
    if (!room) return;
    const token = tokenRef.current;
    if (!token) {
      setError('No hay token para esta sala (abrí la sala desde crear/unirse)');
      return;
    }

    if (moveRequired) {
      if (!moveConfirmed) {
        setError('Primero confirmá el MOVIMIENTO y recién después colocá una ficha.');
        return;
      }
      if (!moveFrom || !moveTo) {
        setError('Falta elegir origen/destino del movimiento');
        return;
      }
    }

    if (selectedOfferIndex === null || !selectedPlacement) {
      setError('Falta seleccionar ficha de oferta y casilla de colocación');
      return;
    }

    const placement: TurnPlacement = { offerIndex: selectedOfferIndex, at: selectedPlacement };
    const move: TurnMove | undefined = moveFrom && moveTo ? { from: moveFrom, to: moveTo } : undefined;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/turn`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, move, placement }),
      });
      const data = (await res.json()) as { room?: ClientRoomState; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'No se pudo enviar el turno');
      setRoom(data.room ?? null);
      setSelectedOfferIndex(null);
      setSelectedPlacement(null);
      setMoveFrom(null);
      setMoveTo(null);
      setMoveConfirmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  function confirmMoveStep() {
    if (!moveRequired) return;
    if (!moveFrom || !moveTo) {
      setError('Elegí una ficha para mover y un destino legal antes de confirmar.');
      return;
    }
    setError(null);
    setMoveConfirmed(true);
  }

  function resetSelections() {
    setSelectedOfferIndex(null);
    setSelectedPlacement(null);
    setMoveFrom(null);
    setMoveTo(null);
    setMoveConfirmed(false);
  }

  function tileSpriteVars(tileId: string): CSSProperties {
    const { color, animal } = parseTileId(tileId);
    const row = COLOR_ROW[color] ?? 0;
    const col = ANIMAL_COL[animal] ?? 0;
    return { ['--row' as any]: String(row), ['--col' as any]: String(col) };
  }

  if (error) {
    return (
      <div className={roomStyles.page}>
        <div className={roomStyles.wrap}>
          <div className={roomStyles.topBar}>
            <button onClick={() => router.push('/')} className={roomStyles.back}>
              Volver
            </button>
          </div>
          <div className={roomStyles.panel}>
            <p className={roomStyles.error}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!room || !previewBoard) {
    return (
      <div className={roomStyles.page}>
        <div className={roomStyles.wrap}>
          <div className={roomStyles.topBar}>
            <button onClick={() => router.push('/')} className={roomStyles.back}>
              Volver
            </button>
          </div>
          <div className={roomStyles.panel}>
            <p className={roomStyles.meta}>Cargando sala...</p>
          </div>
        </div>
      </div>
    );
  }

  const needsOffer = selectedOfferIndex === null;
  const needsPlacement = selectedPlacement === null;
  const moveStatus = isFirstTurn
    ? 'omitido'
    : moveFrom
      ? moveTo
        ? 'listo'
        : 'elegir-destino'
      : 'opcional';

  const stepText =
    room.status !== 'in_progress'
      ? room.status === 'lobby'
        ? 'Esperando al segundo jugador…'
        : 'Partida finalizada.'
      : !you
        ? 'Estás como espectador.'
        : !isYourTurn
          ? 'Esperando el turno del otro jugador…'
          : isFirstTurn
            ? needsOffer
              ? 'Paso 1/2: elegí una ficha de la OFERTA.'
              : needsPlacement
                ? 'Paso 2/2: elegí una casilla vacía para COLOCAR y confirmá.'
                : 'Listo: confirmá la colocación.'
            : !moveConfirmed
              ? !moveFrom
                ? 'Paso 1/4: elegí una ficha del TABLERO para mover.'
                : !moveTo
                  ? 'Paso 2/4: elegí un destino legal (resaltado).' 
                  : 'Paso 3/4: confirmá el MOVIMIENTO.'
              : needsOffer
                ? 'Paso 4/4: elegí una ficha de la OFERTA.'
                : needsPlacement
                  ? 'Paso 4/4: elegí una casilla vacía para COLOCAR.'
                  : 'Confirmá la colocación para terminar el turno.';

  return (
    <div className={roomStyles.page}>
      <div className={roomStyles.wrap}>
        <div className={roomStyles.topBar}>
          <button onClick={() => router.push('/')} className={roomStyles.back}>
            Volver
          </button>
          <h2 className={roomStyles.title}>Sala {room.code}</h2>
          <div />
        </div>

        <p className={roomStyles.meta}>
          Jugadores {room.players.length}/2 · Reserva {room.reserveCount} · Colocadas {room.placedCount}/36
        </p>

        <div className={roomStyles.panel}>
          <div className={roomStyles.pillRow}>
            <span className={`${roomStyles.pill} ${isYourTurn ? roomStyles.pillOn : ''}`}>
              {you ? `Rol: ${you.role.toUpperCase()}` : 'Espectador'}
            </span>
            <span className={`${roomStyles.pill} ${isYourTurn ? roomStyles.pillOn : ''}`}>
              {isYourTurn ? 'Tu turno' : 'Turno del rival'}
            </span>
            <span className={roomStyles.pill}>Movimiento: {moveStatus}</span>
            <span className={`${roomStyles.pill} ${needsOffer ? roomStyles.pillOn : ''}`}>Oferta: {needsOffer ? 'pendiente' : 'ok'}</span>
            <span className={`${roomStyles.pill} ${needsPlacement ? roomStyles.pillOn : ''}`}>
              Colocación: {needsPlacement ? 'pendiente' : 'ok'}
            </span>
          </div>
          <p className={roomStyles.hint} style={{ marginTop: 10 }}>
            {stepText}
          </p>
          {room.lastError ? <p className={roomStyles.error}>{room.lastError}</p> : null}
        </div>

        <div className={roomStyles.grid}>
          <div className={roomStyles.boardWrap}>
            <div className={styles.board}>
              {previewBoard.map((row, r) =>
                row.map((cell, c) => {
                  const coord: Coord = { row: r, col: c };
                  const isEmpty = cell === null;
                  const isMoveFrom = moveFrom && eqCoord(moveFrom, coord);
                  const isMoveTo = moveTo && eqCoord(moveTo, coord);
                  const isLegalMoveTo = moveFrom
                    ? legalMoveDestinations.some((d) => d.row === coord.row && d.col === coord.col)
                    : false;
                  const isPlacement = selectedPlacement && eqCoord(selectedPlacement, coord);

                  const showMovePickHint =
                    isYourTurn &&
                    room.status === 'in_progress' &&
                    !isFirstTurn &&
                    !moveFrom &&
                    cell !== null;
                  const showPlaceHint =
                    isYourTurn &&
                    room.status === 'in_progress' &&
                    selectedOfferIndex !== null &&
                    !selectedPlacement &&
                    isEmpty;

                  const frameClass = [
                    styles.cellFrame,
                    isEmpty ? styles.cellFrameEmpty : '',
                    isMoveFrom ? styles.cellFrameSelectedFrom : '',
                    isMoveTo ? styles.cellFrameSelectedTo : '',
                    isPlacement ? styles.cellFrameSelectedPlacement : '',
                    isLegalMoveTo ? styles.cellFrameLegalMove : '',
                    showMovePickHint || showPlaceHint ? styles.cellFrameHint : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <button
                      key={coordKey(coord)}
                      className={styles.cellButton}
                      disabled={busy || room.status === 'finished'}
                      onClick={() => {
                        if (!isYourTurn || room.status !== 'in_progress') return;

                        if (!isEmpty) {
                          if (isFirstTurn) return;
                          if (moveConfirmed) return;
                          setMoveFrom(coord);
                          setMoveTo(null);
                          setError(null);
                          return;
                        }

                        if (!moveConfirmed && moveFrom && isLegalMoveTo) {
                          setMoveTo(coord);
                          setError(null);
                          return;
                        }

                        // Si estás en medio de elegir el destino del movimiento,
                        // no mezclarlo con la selección de colocación.
                        if (!moveConfirmed && moveFrom && !moveTo) {
                          return;
                        }

                        if ((!moveRequired || moveConfirmed) && selectedOfferIndex !== null && isEmpty) {
                          setSelectedPlacement(coord);
                          setError(null);
                          return;
                        }
                      }}
                      title={cell ?? ''}
                    >
                      <div className={frameClass}>
                        {cell ? (
                          <div className={styles.tile} style={tileSpriteVars(cell) as CSSProperties} />
                        ) : null}
                      </div>
                    </button>
                  );
                }),
              )}
            </div>
          </div>

          <div className={roomStyles.panel}>
            <h3 className={roomStyles.sideTitle}>Oferta</h3>
            <p className={roomStyles.hint}>
              {needsOffer ? 'Elegí 1 de las 6 fichas.' : 'Ficha elegida. Ahora colocá en una casilla vacía.'}
            </p>
            <div className={styles.offer}>
              {room.offer.map((t, idx) => {
                const isSelected = selectedOfferIndex === idx;
                const hint = isYourTurn && room.status === 'in_progress' && needsOffer;
                return (
                  <button
                    key={`${t}-${idx}`}
                    onClick={() => setSelectedOfferIndex(idx)}
                    disabled={!isYourTurn || busy || room.status !== 'in_progress' || (moveRequired && !moveConfirmed)}
                    aria-pressed={isSelected}
                    title={t}
                    className={styles.offerButton}
                  >
                    <div
                      className={
                        `${styles.offerFrame} ` +
                        `${isSelected ? styles.offerFrameSelected : ''} ` +
                        `${hint && !isSelected ? styles.offerFrameHint : ''}`
                      }
                    >
                      <div className={styles.tile} style={tileSpriteVars(t) as CSSProperties} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className={roomStyles.ctaRow}>
              <button
                onClick={moveRequired && !moveConfirmed ? confirmMoveStep : confirmTurn}
                disabled={(moveRequired && !moveConfirmed ? !canConfirmMove : !canConfirmPlacement) || busy || room.status !== 'in_progress'}
                className={`${roomStyles.confirm} ${(moveRequired && !moveConfirmed ? canConfirmMove : canConfirmPlacement) ? roomStyles.confirmReady : ''}`}
              >
                {moveRequired && !moveConfirmed ? 'CONFIRMAR MOVIMIENTO' : 'CONFIRMAR COLOCACIÓN'}
              </button>
              <button onClick={resetSelections} disabled={busy} className={roomStyles.secondary}>
                Limpiar selección
              </button>
            </div>
          </div>
        </div>

        {room.status === 'finished' && room.scores ? (
          <div className={roomStyles.panel}>
            <h3 className={roomStyles.sideTitle}>Fin del juego</h3>
            <p className={roomStyles.meta}>
              Color: {room.scores.color.total} (grupo más grande {room.scores.color.biggestGroup})
            </p>
            <p className={roomStyles.meta}>
              Animal: {room.scores.animal.total} (grupo más grande {room.scores.animal.biggestGroup})
            </p>
            <p className={roomStyles.meta}>Ganador: {room.scores.winner.toUpperCase()}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
