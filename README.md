Proyecto: Aqualin (online) — 2 jugadores por sala.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Abrí http://localhost:3000

## Cómo jugar (MVP)

- Pantalla inicial: crear sala o unirse con un código.
- Cada sala acepta exactamente 2 jugadores.
- La sala muestra tablero 6x6, oferta de fichas (arranca con 6) y un botón `CONFIRMAR MOVIMIENTO`.
- En tu turno:
	- Movimiento opcional: seleccioná una ficha del tablero y elegí un destino legal (misma fila/columna, se desliza hasta chocar con borde u otra ficha).
	- Colocación obligatoria: elegí una ficha de la oferta y luego una casilla vacía.
	- Confirmación: con `CONFIRMAR MOVIMIENTO` se envía el turno y la oferta se repone automáticamente (si quedan fichas en reserva).

Al finalizar (36 fichas colocadas) se calcula puntaje para jugador de Color y jugador de Animales.

## Spritesheet de piezas

Para que el tablero y las piezas se vean como en tu imagen, agregá el PNG del spritesheet en:

- public/aqualin-tiles.png

La UI lo usa como una grilla 6x6. Si al pegar tu PNG quedara desalineado, ajustá `--sheet-cell` en:

- src/app/room/[code]/ui/tiles.module.css

## Deploy en Vercel (persistencia)

## Fondo del tablero

Para el fondo del tablero, agregá la imagen en:

- public/img/piezas.png

La UI la usa como background del área del tablero.

En local, si no configurás Redis/KV, el estado de las salas vive en memoria (sirve para desarrollo pero no es confiable en serverless).

Para producción en Vercel, configurá una de estas opciones:

1) Upstash Redis (preferido)

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

2) Vercel KV (compatibilidad)

- `KV_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`


## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
