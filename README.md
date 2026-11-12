# BOTPORONGA
No se, no tenia novia, me sentia muy solo así que me clave una paja en el monitor y así salió el bot.

---

## Bot de Discord TTS (33 voces: IA + Loquendo + Internacionales)

Bot de Discord en Node.js que se une a canales de voz y reproduce por **Text-To-Speech** mensajes manuales (`/say`, `!say`) o respuestas en vivo de bots configurados (`GENAI_BOT_ID`) resolviendo menciones (`@usuario`) e integrando **33 voces**:

- **14 voces IA clonadas (Fish Audio `s2.1-pro-free`):**
  `bananero`, `arnold`, `latorre`, `peloconcha`, `peluca`, `narrador`, `joker`, `heman`, `momo`, `sonic`, `dross`, `alonso`, `optimus`, `babidi`
- **11 voces Loquendo clásicas (GTA San Andreas):**
  `jorge` (`cj`), `juan` (`ryder`), `carlos` (`tenpenny`), `carmen` (`catalina`), `diego` (`cesar` / `arg`), `esperanza`, `soledad`, `francisca`, `leonor`, `tio`, `loquendero`
- **8 idiomas internacionales (Edge TTS):**
  `ingles` (`en`), `japones` (`ja`), `portugues` (`pt`), `frances` (`fr`), `aleman` (`de`), `italiano` (`it`), `ruso` (`ru`), `coreano` (`ko`)

## Comandos principales

Slash commands (con buscador/autocompletado dinámico en `/voz` y `/vozserver`):
- `/join` / `!join` — Conecta el bot a tu canal de voz actual
- `/leave` / `!leave` — Desconecta el bot del canal de voz
- `/voz [personaje]` / `!voz <nombre>` — Cambia tu voz personal (soporta alias y nombres con espacios/acentos)
- `/vozserver <personaje>` — Define la voz predeterminada del servidor y de GenAi
- `/voces` / `!voces` — Lista las voces disponibles en Discord
- `/say <texto>` / `!say <texto>` — Lee un texto en voz alta en el canal de voz
- `/canal activar|desactivar|estado` (`!bind` / `!unbind`) — Configura lectura automática (Auto-TTS) en un canal
- `/test` — Prueba rápida de audio con tu voz activa
- `/help` / `!help` — Muestra la ayuda de comandos

## Configuración y ejecución

1. En tu .env hace esta garcha:
   ```env
   DISCORD_TOKEN=tu_token_de_discord
   PREFIX=!
   GENAI_BOT_ID=337518526030315520
   DEFAULT_LANG=es
   FISH_AUDIO_API_KEY=tu_api_key_de_fish_audio
   ```
2. Activá los **Privileged Gateway Intents** en Discord choto Portal
3. Instalá dependencias y ejecutá el bot:
   ```bash
   npm install
   npm start
   ```

Desplegalo en tu host mas feliz y pajeate con los pendejos crudos y un poco mas haces orgia.

