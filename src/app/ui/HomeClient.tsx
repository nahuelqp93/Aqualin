'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import styles from './home.module.css';

type CreateRoomResponse = {
  code: string;
  token: string;
};

type JoinRoomResponse = {
  code: string;
  token: string;
};

function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export default function HomeClient() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedJoinCode = useMemo(() => normalizeCode(joinCode), [joinCode]);

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creatorRole: 'color' }),
      });
      const data = (await res.json()) as CreateRoomResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'No se pudo crear la sala');
      localStorage.setItem(`aqualin:token:${data.code}`, data.token);
      router.push(`/room/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: normalizedJoinCode }),
      });
      const data = (await res.json()) as JoinRoomResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'No se pudo unir a la sala');
      localStorage.setItem(`aqualin:token:${data.code}`, data.token);
      router.push(`/room/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <h1 className={styles.title}>Aqualin online</h1>
        <p className={styles.subtitle}>Crear una sala o unirse con código (2 jugadores).</p>

        <div className={styles.row}>
          <button onClick={createRoom} disabled={busy} className={styles.cta}>
            Crear sala
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.row}>
          <label>
            Código de sala
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="ABC123"
              disabled={busy}
              inputMode="text"
            />
          </label>
          <button
            onClick={joinRoom}
            disabled={busy || normalizedJoinCode.length === 0}
            className={styles.ghost}
          >
            Unirse a sala
          </button>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
    </div>
  );
}
