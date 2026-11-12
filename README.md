# Multi-TTS OpenAI-Compatible API

Servidor HTTP en Node.js y Express que expone una API REST compatible con el estándar `/v1/audio/speech` de OpenAI, diseñado para integrarse en **Open WebUI** mediante **Docker**.

Combina tres motores de síntesis de voz en un único endpoint con respaldo automático (**fallback**) hacia **Kokoro TTS**:
- **Fish Audio (`s2.1-pro-free`):** 14 voces clonadas por IA (soporta `reference_id` y clonación zero-shot local mediante MessagePack).
- **Loquendo Clásico (Oddcast Engine 2):** 11 voces clásicas en español con post-procesado de audio mediante `ffmpeg`.
- **Edge TTS:** 8 voces internacionales en distintos idiomas.
- **Fallback automático:** Si Fish Audio falla o alcanza el límite de cuota, redirige la petición automáticamente a una instancia local de Kokoro TTS.

---

## Endpoints disponibles

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `POST` | `/v1/audio/speech` | Genera audio MP3 a partir de texto (`input`, `voice`, `model`). |
| `GET` | `/v1/models` | Lista los motores/voces disponibles en formato compatible con OpenAI. |
| `GET` | `/v1/audio/voices` | Devuelve el catálogo completo de voces y alias configurados. |

### Ejemplo de petición

```bash
curl -X POST http://localhost:5004/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input": "Hola mundo, probando el servidor TTS.", "voice": "jorge"}' \
  --output salida.mp3
```

---

## Catálogo de voces soportadas

* **IA (Fish Audio):** `bananero`, `arnold`, `latorre`, `peloconcha`, `peluca`, `narrador`, `joker`, `heman`, `momo`, `sonic`, `dross`, `alonso`, `optimus`, `babidi`.
* **Loquendo:** `jorge` (`cj`), `juan` (`ryder`), `carlos` (`tenpenny`), `carmen` (`catalina`), `diego` (`cesar`), `esperanza`, `soledad`, `francisca`, `leonor`, `tio`, `loquendero`.
* **Internacionales:** `ingles` (`en`), `japones` (`ja`), `portugues` (`pt`), `frances` (`fr`), `aleman` (`de`), `italiano` (`it`), `ruso` (`ru`), `coreano` (`ko`).

---

## Variables de entorno

| Variable | Requerida | Descripción |
| :--- | :---: | :--- |
| `PORT` | No | Puerto interno del servidor Express (por defecto `5000`). |
| `FISH_AUDIO_API_KEY` | Sí* | Clave de API de Fish Audio (*si se omite, deriva a Kokoro). |
| `KOKORO_API_URL` | No | URL del endpoint de respaldo (por defecto `http://kokoro-api:5000/v1/audio/speech`). |
| `DEFAULT_VOICE` | No | Voz predeterminada si no se especifica una en la petición (`jorge`). |

---

## Despliegue con Docker Compose

```yaml
services:
  fishaudio-tts:
    build: ./fishaudio-tts
    container_name: fishaudio_tts
    restart: unless-stopped
    ports:
      - "5004:5000"
    environment:
      - FISH_AUDIO_API_KEY=${FISH_AUDIO_API_KEY}
      - KOKORO_API_URL=http://kokoro-api:5000/v1/audio/speech
```

### Configuración en Open WebUI

En **Admin Panel → Settings → Audio**:
* **Text-to-Speech Engine:** `OpenAI`
* **API Base URL:** `http://fishaudio-tts:5000/v1`
* **API Key:** `dummy-key`
* **TTS Voice:** `jorge` (o cualquier alias del catálogo)

---

## Créditos

Adaptado y contenedorizado a partir del proyecto original de [Vik2k15/BOTPORONGA](https://github.com/Vik2k15/BOTPORONGA).
