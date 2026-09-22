# Drone Race · VMS

Cliente VMS (live view) para 4 cámaras Janus/WebRTC, pensado para la carrera de drones.
Muestra hasta 4 streams simultáneos en grillas **1×1**, **2×1** o **2×2**.

## Requisitos

Cada Raspberry expone su propio Janus en `http://<IP>:8088/janus` con un stream ID
(`janus.plugin.streaming`).

## Uso

```bash
npm install
npm run dev
```

Abrir `http://localhost:5173`. La app conecta los 4 canales automáticamente y reconecta
sola ante caídas (backoff exponencial por canal).

- `npm run build` → build de producción (`dist/`).
- `npm run preview` → sirve el build (también incluye la API de config).
- `npm run server` → API de config standalone (opcional; puerto 3001).

### CORS y proxy de Janus

El Janus de las Raspberry no acepta peticiones desde `http://localhost:5173` (devuelve
`403` en el preflight), así que el navegador **no** puede hablarle directo. Para evitarlo,
Vite reenvía el signalling por un proxy del mismo origen:

```
navegador → /janus-api/<canal>/janus → http://<IP-raspberry>:<puerto>/janus
```

El destino se lee de `public/config/channels.json` en cada request, por lo que cambiar
una IP desde la UI aplica sin reiniciar. Esto funciona en `dev` y `preview`; un build
estático servido sin Vite necesitaría habilitar CORS en Janus.

## Configuración de canales (IPs)

Las IPs viven en **`public/config/channels.json`**, una carpeta del proyecto:

```json
{
  "channels": [
    { "id": 1, "name": "Cámara 1", "host": "192.168.0.197", "port": 8088, "path": "/janus", "streamId": 99, "enabled": true }
  ]
}
```

Se puede editar de dos formas:

1. **Desde la UI**: botón `⚙ Canales` → editar host/puerto/path/stream ID → `Guardar`.
   Vite corre la API de config internamente, así que se escribe directo el JSON en disco.
2. **A mano**: editar `public/config/channels.json` y recargar.

Variables `VITE_CAM*` en `.env` son solo defaults compilados de respaldo (ver `.env.example`);
el JSON siempre tiene prioridad.

## Layout

- `1×1`: un canal (se elige con los tabs CH1–CH4).
- `2×1`: dos columnas, canales 1 y 2.
- `2×2`: los 4 canales.
