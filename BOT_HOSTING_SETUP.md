# Guía de Instalación en bot-hosting.net 🚀

Esta guía te explica cómo subir y ejecutar el **GenAi Discord TTS Bot** en **[bot-hosting.net](https://bot-hosting.net/)** (o cualquier hosting basado en Pterodactyl Panel).

---

## Paso 1: Crear el Servidor en bot-hosting.net
1. Entrá a tu panel de **bot-hosting.net**.
2. Creá un nuevo servidor:
   * **Nombre:** `GenAi-TTS-Loquendo-Bot` (o el que quieras)
   * **Plataforma / Lenguaje:** **Node.js**
   * **Versión de Node.js:** Seleccioná **Node.js 26** (o la más reciente que tenga disponible).

---

## Paso 2: Subir los Archivos
1. Descargá o tomá el archivo zip limpio:
   `GENAI_TTS_BOT_BOTHOSTING.zip`
2. En el panel de bot-hosting, andá a la pestaña **Files (Archivos)**.
3. Arrastrá el archivo `.zip` a la ventana para subirlo.
4. Hacé clic en los tres puntitos del archivo subido y seleccioná **Unarchive (Descomprimir)**.
5. *(Opcional)* Podés borrar el archivo `.zip` una vez descomprimido.

---

## Paso 3: Configurar el Token de Discord
1. En la pestaña **Files**, buscá el archivo `.env` (si no aparece o querés crearlo, hacé clic en *New File* y guardalo como `.env`).
2. Asegurate de que tenga tu token:
   ```env
   DISCORD_TOKEN=tu_token_aqui_sin_comillas
   PREFIX=!
   GENAI_BOT_ID=337518526030315520
   DEFAULT_VOICE=jorge
   ```
3. Guardá los cambios (**Save Content**).

---

## Paso 4: Configuración de Inicio (Startup)
1. Andá a la pestaña **Startup (Inicio)** en el menú lateral.
2. Verificá que los campos estén así:
   * **Main File / JS File:** `index.js`
   * **Startup Command:**
     ```bash
     if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; /usr/local/bin/node /home/container/index.js
     ```
     *(El comando por defecto que trae el panel funciona perfecto).*

---

## Paso 5: Iniciar el Bot
1. Andá a la pestaña **Console (Consola)**.
2. Hacé clic en el botón verde **Start**.
3. El panel ejecutará `npm install` automáticamente para instalar las dependencias nativas en Linux y luego verás el mensaje:
   ```text
   ====================================================
   [BOT INICIADO] Conectado como TuBot#1234
   [GENAI TARGET] Escuchando al bot con ID: 337518526030315520
   [PREFIJO] Comandos activos con: !
   [VOZ POR DEFECTO] Jorge (Loquendo Clásico / CJ)
   ====================================================
   ```

---

## 🎮 Comandos para Probar en Discord
1. Entrá a cualquier canal de voz de tu servidor.
2. Escribí en el chat de texto:
   * `!join`: El bot entrará al canal de voz y saludará con la voz de Loquendo.
   * `!voces`: Verás la lista de personajes (CJ, Ryder, Tenpenny, Cesar, Catalina, Tío Gilipollas, etc.).
   * `!voz ryder` o `!voz cj`: Cambia de personaje al instante.
   * Cada vez que `genai.bot` escriba (incluyendo menciones a usuarios como `@tu_usuario`), el bot lo leerá en vivo por voz.
