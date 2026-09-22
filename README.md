# Drone Race · VMS

Cliente VMS (live view) para 4 cámaras Janus/WebRTC, pensado para la carrera de drones.
Muestra hasta 4 streams simultáneos en grillas **1×1**, **2×1** o **2×2**.

## Requisitos

Cada Raspberry expone su propio Janus con el plugin `janus.plugin.streaming` y un stream ID.
El transporte por defecto es **WebSocket** (`ws://<IP>:8188/janus`), que es el que funciona
sin problemas de CORS; también soporta HTTP REST (`http://<IP>:8088/janus`).

## Uso

```bash
npm install
npm run dev
```

Abrir `http://localhost:5173`. La app conecta los canales activos automáticamente y
reconecta sola ante caídas (backoff exponencial por canal).

- `npm run build` → build de producción (`dist/`).
- `npm run preview` → sirve el build (también incluye la API de config).
- `npm run server` → API de config standalone (opcional; puerto 3001).

### Transporte y CORS

- **WebSocket (`ws`)**: conexión directa al Janus de la Raspberry. Es el modo probado y no
  está sujeto a CORS.
- **HTTP (`http`)**: el navegador no puede hablarle directo (el Janus devuelve `403` en el
  preflight), así que Vite lo reenvía por un proxy del mismo origen:

  ```
  navegador → /janus-api/<canal>/janus → http://<IP-raspberry>:<puerto>/janus
  ```

  El destino se lee de `public/config/channels.json` en cada request, así cambiar la IP
  desde la UI aplica sin reiniciar. Si sirves el `dist/` sin Vite, para HTTP necesitarías
  habilitar CORS en Janus.

## Configuración de canales (IPs)

Las IPs viven en **`public/config/channels.json`**, una carpeta del proyecto:

```json
{
  "channels": [
    {
      "id": 1,
      "name": "Cámara 1",
      "host": "10.100.0.129",
      "port": 8188,
      "path": "/janus",
      "streamId": 100,
      "transport": "ws",
      "enabled": true
    }
  ]
}
```

`transport` es `"ws"` (puerto típico 8188) o `"http"` (puerto típico 8088).

Se puede editar de dos formas:

1. **Desde la UI**: botón `⚙ Canales` → editar host/puerto/transporte/path/stream ID → `Guardar`.
   Vite corre la API de config internamente, así que se escribe directo el JSON en disco.
2. **A mano**: editar `public/config/channels.json` y recargar.

Variables `VITE_CAM*` en `.env` son solo defaults compilados de respaldo (ver `.env.example`);
el JSON siempre tiene prioridad.

### Bitrate del SDP

Para forzar un bitrate de video en el SDP del answer (algunas RPi negocian muy bajo):

```
VITE_FORCE_SDP_VIDEO_BITRATE=true
VITE_SDP_VIDEO_BITRATE_KBPS=4000
```

## Layout

- `1×1`: un canal (se elige con los tabs CH1–CH4).
- `2×1`: dos columnas, canales 1 y 2.
- `2×2`: los 4 canales.
