require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
} = require('discord.js');
const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const tts = require('./tts');
const { registerSlashCommands, getAutocompleteVoiceChoices } = require('./commands');

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.PREFIX || '!';
const GENAI_BOT_ID = process.env.GENAI_BOT_ID || '337518526030315520';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

/**
 * Resuelve las menciones de Discord (<@id>, <@!id>, <@&id>, <#id>)
 * convirtiéndolas en nombres legibles para que el TTS las pronuncie en voz alta.
 */
async function formatMentions(message) {
  let text = message.content;
  if (!text) return '';

  // 1. Menciones de usuarios (<@12345> o <@!12345>)
  const userMatches = [...text.matchAll(/<@!?(\d+)>/g)];
  for (const match of userMatches) {
    const rawTag = match[0];
    const userId = match[1];
    let displayName = 'usuario';

    try {
      const member =
        message.guild?.members.cache.get(userId) ||
        (await message.guild?.members.fetch(userId).catch(() => null));

      if (member) {
        displayName = member.displayName || member.user.username;
      } else {
        const user =
          message.client.users.cache.get(userId) ||
          (await message.client.users.fetch(userId).catch(() => null));
        if (user) displayName = user.displayName || user.username;
      }
    } catch {
      displayName = 'usuario';
    }

    text = text.split(rawTag).join(`@${displayName}`);
  }

  // 2. Menciones de roles (<@&12345>)
  const roleMatches = [...text.matchAll(/<@&(\d+)>/g)];
  for (const match of roleMatches) {
    const rawTag = match[0];
    const roleId = match[1];
    const role = message.guild?.roles.cache.get(roleId);
    const roleName = role ? role.name : 'rol';
    text = text.split(rawTag).join(`@${roleName}`);
  }

  // 3. Menciones de canales (<#12345>)
  const chanMatches = [...text.matchAll(/<#(\d+)>/g)];
  for (const match of chanMatches) {
    const rawTag = match[0];
    const chanId = match[1];
    const channel = message.guild?.channels.cache.get(chanId);
    const chanName = channel ? channel.name : 'canal';
    text = text.split(rawTag).join(`#${chanName}`);
  }

  return text;
}

function getVocesMessage() {
  const aiVoices = [
    '• **El Bananero** (`bananero` / `sape`) · **Arnold** (`arnold`) · **Narrador** (`narrador`)',
    '• **Joker Bananero** (`joker` / `joken`) · **He-Man / Iván** (`heman` / `ivan`)',
    '• **El Peluca** (`peluca` / `harry`) · **Peloconcha** (`peloconcha` / `pelo`)',
    '• **Diego Latorre** (`latorre` / `gambeta`) · **Momo** (`momo`) · **Sonic** (`sonic`)',
    '• **Dross** (`dross`) · **Fernando Alonso** (`alonso` / `nano`)',
    '• **Optimus Prime** (`optimus` / `prime`) · **Babidi** (`babidi` / `dbz`)',
  ].join('\n');

  const gtaLoquendo = [
    '• **Jorge** (`cj` / `jorge`): Loquendo Clásico · **Juan** (`ryder` / `juan`) · **Carlos** (`tenpenny`)',
    '• **Carmen** (`catalina` / `carmen`) · **Diego** (`cesar` / `arg`) · **Tío Gilipollas** (`tio`)',
    '• **Esperanza** (`esperanza`) · **Soledad** (`soledad`) · **Francisca** (`francisca`) · **Leonor** (`leonor`)',
    '• **Loquendero Rápido** (`loquendero`): Jorge acelerado',
  ].join('\n');

  const international = [
    '• **Japonés** (`ja`) · **Inglés** (`en`) · **Portugués** (`pt`) · **Francés** (`fr`)',
    '• **Alemán** (`de`) · **Italiano** (`it`) · **Ruso** (`ru`) · **Coreano** (`ko`)',
  ].join('\n');

  return (
    `🎭 **VOCES DISPONIBLES EN EL BOT:**\n\n` +
    `⭐ **Voces IA Originales (Clonación Auténtica):**\n${aiVoices}\n\n` +
    `🎤 **Loquendo Real (GTA San Andreas):**\n${gtaLoquendo}\n\n` +
    `🌐 **Internacionales:**\n${international}\n\n` +
    `👉 *Elegí tu voz con:* \`/voz [personaje]\` (con buscador) o \`${PREFIX}voz <nombre>\``
  );
}

function getHelpMessage() {
  return (
    `🤖 **Comandos del Bot de Voz Loquendo (Compatibles con \`/\` y \`!\`):**\n\n` +
    `• \`/join\` o \`${PREFIX}join\`: Conecta el bot a tu canal de voz actual.\n` +
    `• \`/leave\` o \`${PREFIX}leave\`: Desconecta el bot del canal de voz.\n` +
    `• \`/canal activar\` o \`${PREFIX}canal\`: **Activa el canal TTS automático**. Todo lo que se escriba se lee por voz.\n` +
    `• \`/canal desactivar\` o \`${PREFIX}canal off\`: Desactiva la lectura automática del canal.\n` +
    `• \`/voz [personaje]\` o \`${PREFIX}voz <nombre>\`: **Elige tu voz personal** (con menú desplegable en \`/\`).\n` +
    `• \`/voces\` o \`${PREFIX}voces\`: Lista completa de voces de Loquendo e internacionales.\n` +
    `• \`/say [texto]\` o \`${PREFIX}say <texto>\`: Pronuncia un texto con tu voz elegida.\n` +
    `• \`/test\` o \`${PREFIX}test\`: Prueba inmediata de audio con tu voz activa.\n` +
    `• \`/vozserver [personaje]\`: Cambia la voz predeterminada del servidor y de GenAi.\n\n` +
    `⏳ *Cuenta con cola de espera automática y cooldown natural entre mensajes.*`
  );
}

function createSafeVoiceConnection(voiceChannel, guild) {
  const guildId = guild.id;
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  connection.on('error', (err) => {
    console.warn(`[VOICE CONN WARN] [Guild ${guildId}]:`, err.message);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      connection.destroy();
      tts.destroy(guildId);
    }
  });

  return connection;
}

function getTestPhrase(userVoice) {
  if (userVoice.type === 'loquendo' || userVoice.type === 'fish_audio') {
    return `Hola, soy ${userVoice.name}. El sistema de audio está funcionando correctamente.`;
  }
  return `Audio test for ${userVoice.name}. Everything is working fine.`;
}

// Prevenir cierres inesperados del proceso
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]:', err);
});

let readyExecuted = false;
const onReady = async () => {
  if (readyExecuted) return;
  readyExecuted = true;
  console.log('====================================================');
  console.log(`[BOT INICIADO] Conectado como ${client.user.tag}`);
  console.log(`[GENAI TARGET] Escuchando al bot con ID: ${GENAI_BOT_ID}`);
  console.log(`[PREFIJO] Comandos activos con: ${PREFIX} y Slash Commands (/)`);
  console.log(`[MOTOR LOQUENDO] Loquendo Oficial 7 (Jorge, Juan, Carlos, Tío Gilipollas...)`);
  console.log(`[AUDIO ENGINE] FFmpeg configurado en: ${process.env.FFMPEG_PATH}`);
  console.log('====================================================');

  // Registrar comandos de barra diagonal (/) automáticamente (en cada servidor al instante y global)
  await registerSlashCommands(TOKEN, client.user.id, client.guilds.cache.values());
};

client.once('clientReady', onReady);

// ==========================================
// 1. MANEJO DE COMANDOS DE BARRA DIAGONAL (/)
// ==========================================
client.on('interactionCreate', async (interaction) => {
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === 'voz' || interaction.commandName === 'vozserver') {
      const focused = interaction.options.getFocused() || '';
      await interaction.respond(getAutocompleteVoiceChoices(focused)).catch(() => {});
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId } = interaction;
  if (!guildId) return;

  // /join
  if (commandName === 'join') {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content: '⚠️ ¡Tenés que estar en un canal de voz para que el bot se una!',
        ephemeral: true,
      });
    }

    try {
      createSafeVoiceConnection(voiceChannel, interaction.guild);

      const activeTtsChannel = tts.getTtsChannel(guildId);
      const myVoice = tts.getUserVoice(interaction.user.id, guildId);

      return interaction.reply(
        `✅ **Conectado a ${voiceChannel.name}**\n` +
        `• **Canal TTS:** ${activeTtsChannel ? `<#${activeTtsChannel}>` : `*Ninguno (usá \`/canal activar\`)*`}\n` +
        `• **Tu voz personal:** **${myVoice.name}**\n` +
        `• **GenAi:** Escuchando 24/7 en el servidor.`
      );
    } catch (err) {
      console.error('[JOIN ERROR]:', err);
      return interaction.reply({ content: '❌ No se pudo conectar al canal de voz.', ephemeral: true });
    }
  }

  // /leave
  if (commandName === 'leave') {
    const connection = getVoiceConnection(guildId);
    if (connection) {
      tts.clearQueue(guildId);
      tts.destroy(guildId);
      connection.destroy();
      return interaction.reply('👋 Desconectado del canal de voz.');
    } else {
      return interaction.reply({ content: '⚠️ No estoy conectado a ningún canal de voz.', ephemeral: true });
    }
  }

  // /canal
  if (commandName === 'canal') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'desactivar') {
      tts.removeTtsChannel(guildId);
      return interaction.reply('🔇 **Canal TTS desactivado:** Los mensajes normales ya no se leerán por voz (solo GenAi o `/say`).');
    }

    if (sub === 'estado') {
      const currentChannel = tts.getTtsChannel(guildId);
      if (currentChannel) {
        return interaction.reply(`🔊 **Canal TTS actual:** <#${currentChannel}>\n*(Todos los textos escritos allí se leen en vivo)*`);
      } else {
        return interaction.reply('ℹ️ No hay ningún canal TTS activo. Usá `/canal activar` para configurar uno.');
      }
    }

    if (sub === 'activar') {
      const targetChannel = interaction.options.getChannel('canal') || interaction.channel;
      tts.setTtsChannel(guildId, targetChannel.id);

      return interaction.reply(
        `🔊 **¡Canal TTS activado en <#${targetChannel.id}>!**\n` +
        `• Cada mensaje que se escriba en este canal se leerá por voz automáticamente.\n` +
        `• Cada usuario hablará con su **voz preferida** (elegila con \`/voz\`).\n` +
        `• Para desactivarlo usá: \`/canal desactivar\``
      );
    }
  }

  // /voz
  if (commandName === 'voz') {
    const requested = interaction.options.getString('personaje');

    if (!requested) {
      const myVoice = tts.getUserVoice(interaction.user.id, guildId);
      const serverVoice = tts.getServerVoice(guildId);
      return interaction.reply(
        `🎙️ **Tu voz personal:** **${myVoice.name}**\n` +
        `🌐 **Voz predeterminada del servidor:** **${serverVoice.name}**\n\n` +
        `👉 *Elegí tu voz usando:* \`/voz [personaje]\`\n` +
        `📜 *Mirá todas las opciones con:* \`/voces\``
      );
    }

    const updated = tts.setUserVoice(interaction.user.id, requested);
    if (updated) {
      return interaction.reply(
        `✅ **Tu voz personal fue configurada a: ${updated.name}**\n` +
        `*(Cada vez que escribas en el canal TTS o uses \`/say\`, hablarás con este personaje)*`
      );
    } else {
      return interaction.reply({ content: `⚠️ No se encontró la voz "${requested}".`, ephemeral: true });
    }
  }

  // /vozserver
  if (commandName === 'vozserver') {
    const requested = interaction.options.getString('personaje');
    const updated = tts.setServerVoice(guildId, requested);
    if (updated) {
      return interaction.reply(`🌐 **Voz predeterminada del servidor actualizada a:** **${updated.name}**`);
    } else {
      return interaction.reply({ content: '⚠️ Voz no encontrada.', ephemeral: true });
    }
  }

  // /voces
  if (commandName === 'voces') {
    return interaction.reply(getVocesMessage());
  }

  // /test
  if (commandName === 'test') {
    const connection = getVoiceConnection(guildId);
    if (!connection) {
      return interaction.reply({
        content: '⚠️ El bot no está en ningún canal de voz. Usá primero `/join`.',
        ephemeral: true,
      });
    }

    const userVoice = tts.getUserVoice(interaction.user.id, guildId);
    const testPhrase = getTestPhrase(userVoice);

    await tts.enqueue(guildId, connection, testPhrase, userVoice.key, interaction.user.id);
    return interaction.reply(`🗣️ Probando tu voz de **${userVoice.name}** en el canal de voz...`);
  }

  // /say
  if (commandName === 'say') {
    const text = interaction.options.getString('texto');
    const connection = getVoiceConnection(guildId);
    if (!connection) {
      return interaction.reply({
        content: '⚠️ El bot no está en ningún canal de voz. Usá primero `/join`.',
        ephemeral: true,
      });
    }

    const userVoice = tts.getUserVoice(interaction.user.id, guildId);
    const res = await tts.enqueue(guildId, connection, text, userVoice.key, interaction.user.id);

    if (res.success) {
      const statusText = res.queued
        ? `*(⏳ En cola de espera)*`
        : `*(🎙️ Reproduciendo)*`;
      return interaction.reply(`🗣️ **${interaction.user.displayName || interaction.user.username}** [${userVoice.name}]: "${text}" ${statusText}`);
    }
  }

  // /help
  if (commandName === 'help') {
    return interaction.reply(getHelpMessage());
  }
});

// ==========================================
// 2. MANEJO DE COMANDOS CLÁSICOS CON PREFIJO (!)
// ==========================================
client.on('messageCreate', async (message) => {
  if (!message.guild) return;

  const guildId = message.guild.id;
  const content = message.content.trim();

  // COMANDOS DEL USUARIO CON PREFIJO (!)
  if (content.startsWith(PREFIX)) {
    const args = content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    // !join / !conectar
    if (command === 'join' || command === 'conectar' || command === 'entrar') {
      const voiceChannel = message.member?.voice?.channel;
      if (!voiceChannel) {
        return message.reply('⚠️ ¡Tenés que estar en un canal de voz para que el bot se una!');
      }

      try {
        createSafeVoiceConnection(voiceChannel, message.guild);

        const activeTtsChannel = tts.getTtsChannel(guildId);
        const myVoice = tts.getUserVoice(message.author.id, guildId);

        return message.reply(
          `✅ **Conectado a ${voiceChannel.name}**\n` +
          `• **Canal TTS:** ${activeTtsChannel ? `<#${activeTtsChannel}>` : `*Ninguno (usá \`${PREFIX}canal\`)*`}\n` +
          `• **Tu voz personal:** **${myVoice.name}**\n` +
          `• **GenAi:** Escuchando 24/7 en el servidor.`
        );
      } catch (err) {
        console.error('[JOIN ERROR]:', err);
        return message.reply('❌ No se pudo conectar al canal de voz.');
      }
    }

    // !leave / !stop
    if (command === 'leave' || command === 'desconectar' || command === 'salir' || command === 'stop') {
      const connection = getVoiceConnection(guildId);
      if (connection) {
        tts.clearQueue(guildId);
        tts.destroy(guildId);
        connection.destroy();
        return message.reply('👋 Desconectado del canal de voz.');
      } else {
        return message.reply('⚠️ No estoy conectado a ningún canal de voz.');
      }
    }

    // !canal / !autotts
    if (command === 'canal' || command === 'autotts' || command === 'canaltotexto') {
      const sub = args[0]?.toLowerCase();

      if (sub === 'off' || sub === 'desactivar' || sub === 'quitar' || sub === 'stop') {
        tts.removeTtsChannel(guildId);
        return message.reply('🔇 **Canal TTS desactivado:** Los mensajes normales ya no se leerán por voz.');
      }

      if (sub === 'status' || sub === 'info') {
        const currentChannel = tts.getTtsChannel(guildId);
        if (currentChannel) {
          return message.reply(`🔊 **Canal TTS actual:** <#${currentChannel}>\n*(Todos los textos escritos allí se leen en vivo)*`);
        } else {
          return message.reply(`ℹ️ No hay ningún canal TTS activo. Escribí \`${PREFIX}canal\` para activar uno.`);
        }
      }

      const targetChannel = message.mentions.channels.first() || message.channel;
      tts.setTtsChannel(guildId, targetChannel.id);

      return message.reply(
        `🔊 **¡Canal TTS activado en <#${targetChannel.id}>!**\n` +
        `• Cada mensaje que se escriba en este canal se leerá por voz automáticamente.\n` +
        `• Cada usuario hablará con su **voz preferida** (elegila con \`${PREFIX}voz <nombre>\` o \`/voz\`).\n` +
        `• Para desactivarlo escribí: \`${PREFIX}canal off\``
      );
    }

    // !voz / !mivoz
    if (command === 'voz' || command === 'mivoz' || command === 'voice') {
      const requested = args[0]?.toLowerCase();
      if (!requested) {
        const myVoice = tts.getUserVoice(message.author.id, guildId);
        const serverVoice = tts.getServerVoice(guildId);
        return message.reply(
          `🎙️ **Tu voz personal:** **${myVoice.name}**\n` +
          `🌐 **Voz predeterminada del servidor:** **${serverVoice.name}**\n\n` +
          `👉 *Cambiá tu voz con:* \`${PREFIX}voz <nombre>\` o \`/voz\`\n` +
          `📜 *Mirá todas las opciones con:* \`${PREFIX}voces\``
        );
      }

      const updated = tts.setUserVoice(message.author.id, requested);
      if (updated) {
        message.react('🎙️').catch(() => {});
        return message.reply(
          `✅ **Tu voz personal fue configurada a: ${updated.name}**\n` +
          `*(Cada vez que escribas en el canal TTS o uses \`${PREFIX}say\`, hablarás con este personaje)*`
        );
      } else {
        return message.reply(`⚠️ No se encontró la voz "${requested}". Escribí \`${PREFIX}voces\` para ver todas las opciones.`);
      }
    }

    // !vozserver / !servervoz
    if (command === 'vozserver' || command === 'servervoz') {
      const requested = args[0]?.toLowerCase();
      if (!requested) {
        const serverVoice = tts.getServerVoice(guildId);
        return message.reply(`🌐 Voz predeterminada del servidor: **${serverVoice.name}** (Cambiá con \`${PREFIX}vozserver <nombre>\`).`);
      }

      const updated = tts.setServerVoice(guildId, requested);
      if (updated) {
        return message.reply(`🌐 Voz del servidor actualizada a: **${updated.name}**`);
      } else {
        return message.reply(`⚠️ Voz no encontrada. Escribí \`${PREFIX}voces\` para ver la lista.`);
      }
    }

    // !voces / !voices
    if (command === 'voces' || command === 'voices') {
      return message.reply(getVocesMessage());
    }

    // !test / !probar
    if (command === 'test' || command === 'probar') {
      const connection = getVoiceConnection(guildId);
      if (!connection) {
        return message.reply(`⚠️ El bot no está en ningún canal de voz. Usá primero \`${PREFIX}join\` para conectarlo.`);
      }

      const userVoice = tts.getUserVoice(message.author.id, guildId);
      const testPhrase = getTestPhrase(userVoice);

      await tts.enqueue(guildId, connection, testPhrase, userVoice.key, message.author.id);
      return message.reply(`🗣️ Probando tu voz de **${userVoice.name}** en el canal de voz...`);
    }

    // !loquendo (Atajo para Jorge / CJ)
    if (command === 'loquendo') {
      const updated = tts.setUserVoice(message.author.id, 'jorge');
      message.react('🎙️').catch(() => {});
      return message.reply(`✅ Tu voz personal fue configurada a: **${updated.name}**`);
    }

    // !say / !hablar
    if (command === 'say' || command === 'hablar' || command === 'tts') {
      const rawText = args.join(' ');
      if (!rawText) return message.reply('⚠️ Por favor escribe el texto que querés que diga.');

      const connection = getVoiceConnection(guildId);
      if (!connection) {
        return message.reply(`⚠️ El bot no está en ningún canal de voz. Usá primero \`${PREFIX}join\` para conectarlo.`);
      }

      const formatted = await formatMentions(message);
      const textToSpeak = formatted.replace(new RegExp(`^\\${PREFIX}(say|hablar|tts)\\s+`, 'i'), '');
      const userVoice = tts.getUserVoice(message.author.id, guildId);

      const res = await tts.enqueue(guildId, connection, textToSpeak, userVoice.key, message.author.id);
      if (res.success) {
        if (res.queued) {
          message.react('⏳').catch(() => {});
        } else {
          message.react('🗣️').catch(() => {});
        }
      }
      return;
    }

    // !help / !ayuda
    if (command === 'help' || command === 'ayuda') {
      return message.reply(getHelpMessage());
    }

    return;
  }

  // ==========================================
  // 3. DETECCIÓN AUTOMÁTICA DE GENAI
  // ==========================================
  const isGenAi =
    message.author.id === GENAI_BOT_ID ||
    message.author.username.toLowerCase().includes('genai');

  if (isGenAi) {
    const connection = getVoiceConnection(guildId);
    if (!connection) return;

    const formattedText = await formatMentions(message);
    const serverVoice = tts.getServerVoice(guildId);

    const res = await tts.enqueue(guildId, connection, formattedText, serverVoice.key, 'genai');
    if (res.success) {
      if (res.queued) {
        message.react('⏳').catch(() => {});
      } else {
        message.react('🎙️').catch(() => {});
      }
    }
    return;
  }

  // ==========================================
  // 4. LECTURA AUTOMÁTICA DEL CANAL TTS
  // ==========================================
  if (!message.author.bot) {
    const activeTtsChannelId = tts.getTtsChannel(guildId);

    if (activeTtsChannelId && message.channel.id === activeTtsChannelId) {
      const connection = getVoiceConnection(guildId);
      if (!connection) return;

      const formattedText = await formatMentions(message);
      const userVoice = tts.getUserVoice(message.author.id, guildId);

      const res = await tts.enqueue(guildId, connection, formattedText, userVoice.key, message.author.id);
      if (res.success) {
        if (res.queued) {
          message.react('⏳').catch(() => {});
        } else {
          message.react('🎙️').catch(() => {});
        }
      }
    }
  }
});

client.login(TOKEN).catch((err) => {
  console.error('[LOGIN ERROR] No se pudo iniciar sesión en Discord:', err.message);
  console.error('Por favor verifica que tu DISCORD_TOKEN en el archivo .env sea correcto.');
});
