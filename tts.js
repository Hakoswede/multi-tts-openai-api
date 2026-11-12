const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
} = require('@discordjs/voice');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const googleTTS = require('google-tts-api');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { Readable } = require('stream');
const { spawn, execSync } = require('child_process');

let ffmpegPath = null;

// Archivo persistente para guardar preferencias de voz de usuarios y canales TTS
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      return {
        userVoices: parsed.userVoices || {},
        serverVoices: parsed.serverVoices || {},
        ttsChannels: parsed.ttsChannels || {},
      };
    }
  } catch (err) {
    console.warn('[SETTINGS] Aviso leyendo settings.json:', err.message);
  }
  return { userVoices: {}, serverVoices: {}, ttsChannels: {} };
}

function saveSettings(data) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[SETTINGS] Error guardando settings.json:', err.message);
  }
}

// Resolver o garantizar la presencia de ffmpeg (compatible con Windows y contenedores Linux)
function resolveFfmpeg() {
  if (ffmpegPath && fs.existsSync(ffmpegPath)) return ffmpegPath;

  // 1. Chequear si ffmpeg-static ya resolvió y el archivo físico existe
  try {
    const staticBin = require('ffmpeg-static');
    if (staticBin && fs.existsSync(staticBin)) {
      try { fs.chmodSync(staticBin, 0o755); } catch {}
      ffmpegPath = staticBin;
      process.env.FFMPEG_PATH = ffmpegPath;
      return ffmpegPath;
    }
  } catch {}

  // 2. Chequear en candidatos locales
  const localCandidates = [
    path.join(__dirname, 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
    path.join(__dirname, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
  ];
  for (const cand of localCandidates) {
    if (fs.existsSync(cand) && fs.statSync(cand).size > 1000000) {
      try { fs.chmodSync(cand, 0o755); } catch {}
      ffmpegPath = cand;
      process.env.FFMPEG_PATH = ffmpegPath;
      return ffmpegPath;
    }
  }

  // 3. Si estamos en Linux y no existe, ejecutar download_ffmpeg.js
  if (process.platform === 'linux') {
    try {
      const scriptPath = path.join(__dirname, 'download_ffmpeg.js');
      if (fs.existsSync(scriptPath)) {
        execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
      }
    } catch (e) {
      console.warn('[FFMPEG] Aviso ejecutando download_ffmpeg.js:', e.message);
    }

    for (const cand of localCandidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).size > 1000000) {
        try { fs.chmodSync(cand, 0o755); } catch {}
        ffmpegPath = cand;
        process.env.FFMPEG_PATH = ffmpegPath;
        return ffmpegPath;
      }
    }
  }

  // 4. Chequear ffmpeg en el sistema operativo global
  const candidates = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', 'ffmpeg'];
  for (const c of candidates) {
    try {
      execSync(`${c} -version`, { stdio: 'ignore' });
      ffmpegPath = c;
      process.env.FFMPEG_PATH = ffmpegPath;
      return ffmpegPath;
    } catch {}
  }

  ffmpegPath = 'ffmpeg';
  process.env.FFMPEG_PATH = ffmpegPath;
  return ffmpegPath;
}

const FFMPEG_BIN = resolveFfmpeg();
console.log('[FFMPEG] Binario configurado en:', FFMPEG_BIN);

// 1. VOCES ORIGINALES DE LOQUENDO (Motor Oficial Loquendo 7 - Oddcast Engine 2)
const LOQUENDO_VOICES = {
  jorge: {
    type: 'loquendo',
    id: 6,
    engine: 2,
    langId: 2,
    name: 'Jorge (Loquendo Clásico / CJ)',
    desc: 'La voz legendaria de Loquendo en YouTube y San Andreas.',
  },
  juan: {
    type: 'loquendo',
    id: 2,
    engine: 2,
    langId: 2,
    name: 'Juan (Ryder / Pandillero)',
    desc: 'Voz callejera y rápida de Loquendo.',
  },
  carlos: {
    type: 'loquendo',
    id: 7,
    engine: 2,
    langId: 2,
    name: 'Carlos (Oficial Tenpenny)',
    desc: 'Voz grave, seria y autoritaria de Loquendo.',
  },
  carmen: {
    type: 'loquendo',
    id: 1,
    engine: 2,
    langId: 2,
    name: 'Carmen (Catalina)',
    desc: 'Voz femenina clásica de Loquendo castellano.',
  },
  diego: {
    type: 'loquendo',
    id: 4,
    engine: 2,
    langId: 2,
    name: 'Diego (Cesar Vialpando / Argentino)',
    desc: 'Voz latina/argentina clásica de Loquendo.',
  },
  esperanza: {
    type: 'loquendo',
    id: 5,
    engine: 2,
    langId: 2,
    name: 'Esperanza (Loquendo Mexicana)',
    desc: 'Voz femenina mexicana/latina de Loquendo.',
  },
  soledad: {
    type: 'loquendo',
    id: 8,
    engine: 2,
    langId: 2,
    name: 'Soledad (Loquendo Latina)',
    desc: 'Voz femenina suave de Loquendo.',
  },
  francisca: {
    type: 'loquendo',
    id: 3,
    engine: 2,
    langId: 2,
    name: 'Francisca (Loquendo Chilena)',
    desc: 'Voz femenina chilena de Loquendo.',
  },
  leonor: {
    type: 'loquendo',
    id: 9,
    engine: 2,
    langId: 2,
    name: 'Leonor (Loquendo Castellana)',
    desc: 'Voz femenina castellana de Loquendo.',
  },
  tio: {
    type: 'loquendo',
    id: 2, // Voz base: Juan
    engine: 2,
    langId: 2,
    filter: 'asetrate=24000*1.155,atempo=0.865', // Calibración Muestra 18 elegida
    name: 'Tío Gilipollas (Voz Oficial)',
    desc: 'La voz clásica del Tío Gilipollas de GTA San Andreas.',
  },
  loquendero: {
    type: 'loquendo',
    id: 6,
    engine: 2,
    langId: 2,
    filter: 'atempo=1.35', // Jorge acelerado
    name: 'Loquendero Rápido (Jorge)',
    desc: 'Jorge a máxima velocidad.',
  },
};

// 2. VOCES IA CLONADAS AUTÉNTICAS (Fish Audio API)
const AI_VOICES = {
  bananero: {
    type: 'fish_audio',
    referenceId: '639e3ee7d41c41a68da7d61310e886af',
    name: 'El Bananero (Voz IA Original)',
    desc: 'Voz auténtica clonada por IA de El Bananero.',
  },
  arnold: {
    type: 'fish_audio',
    referenceId: 'b2bb5caeea1344e8b3ab21eb9266d935',
    name: 'Arnold (El Bananero)',
    desc: 'Arnold Schwarzenegger según El Bananero.',
  },
  latorre: {
    type: 'fish_audio',
    referenceId: 'f33626d1283d41c894b0bd9cba0e0d0e',
    name: 'Diego Latorre (Gambeta)',
    desc: 'Voz de Diego Latorre comentando fútbol.',
  },
  peloconcha: {
    type: 'fish_audio',
    referenceId: '98cf5180a1f84fba9d5787797ed63d5c',
    name: 'Peloconcha (El Bananero)',
    desc: 'La muñeca Peloconcha de El Bananero.',
  },
  peluca: {
    type: 'fish_audio',
    referenceAudioFile: path.join(__dirname, 'voices', 'peluca.mp3'),
    referenceText:
      'Qué lindo cachorrito. Yo que vos le saco garantía. Yo que vos me pego un jabonazo chabón. ¿Qué hacés Forrest Gump? Mirá, si te vas a garchar a la Jenny, metele triple condón, no seas boludo. Bueno, me voy a la mierda.',
    name: 'El Peluca (El Bananero)',
    desc: 'Voz clonada de El Peluca (Harry el Alcohólico Potter) de El Bananero.',
  },
  narrador: {
    type: 'fish_audio',
    referenceId: '94286c2cce2a4d12bb4f37242397df38',
    name: 'Narrador (El Bananero)',
    desc: 'Voz épica del narrador de los videos de El Bananero.',
  },
  joker: {
    type: 'fish_audio',
    referenceId: '40f6c5b249794f4887b7e6fc24195db5',
    name: 'Joker (El Bananero)',
    desc: 'El Guasón / Joker según El Bananero.',
  },
  momo: {
    type: 'fish_audio',
    referenceId: '4f6621dbaf634ea793db2b24a0dae80f',
    name: 'Momo',
    desc: 'Voz clonada de Momo (Gerónimo Benavides).',
  },
  sonic: {
    type: 'fish_audio',
    referenceId: '057ca32a305141cca13ca6d0cbf757e8',
    name: 'Sonic (Latino)',
    desc: 'Sonic el Erizo (doblaje español latino de Sonic Boom).',
  },
  dross: {
    type: 'fish_audio',
    referenceId: 'd9f0d3d3fe734af6acb5ecc9129bc49a',
    name: 'Dross',
    desc: 'Voz clásica de DrossRotzank para tops y relatos.',
  },
  alonso: {
    type: 'fish_audio',
    referenceId: '7d40370d2ff24499aba722b49739f096',
    name: 'Fernando Alonso',
    desc: 'Voz clonada de Fernando Alonso (El Nano / Fórmula 1).',
  },
  heman: {
    type: 'fish_audio',
    referenceAudioFile: path.join(__dirname, 'voices', 'heman.mp3'),
    referenceText:
      'Pelotas, vamos a buscarlo. Porque yo quiero tenerla sin hueso, en mis manos.',
    name: 'He-Man / Iván (El Bananero)',
    desc: 'Voz clonada de Iván El Trolazo (He-Man) de El Bananero.',
  },
  optimus: {
    type: 'fish_audio',
    referenceId: '9a09e2d149214f87a85ca227b94c7e51',
    name: 'Optimus Prime (Transformers IA)',
    desc: 'Voz firme, grave y heroica de Optimus Prime en español latino.',
  },
  babidi: {
    type: 'fish_audio',
    referenceId: 'e5be1dd1746b4edeb5fd166b22d9f964',
    name: 'Babidi Latino (Dragon Ball Z)',
    desc: 'Voz auténtica del doblaje latino de Babidi en DBZ.',
  },
};

// 3. VOCES INTERNACIONALES (MsEdgeTTS)
const INTERNATIONAL_VOICES = {
  ingles: {
    type: 'edge',
    id: 'ingles',
    name: 'Inglés (EE.UU.)',
    voice: 'en-US-GuyNeural',
    desc: 'Voz masculina en inglés.',
  },
  japones: {
    type: 'edge',
    id: 'japones',
    name: 'Japonés (Anime)',
    voice: 'ja-JP-NanamiNeural',
    desc: 'Voz japonesa.',
  },
  portugues: {
    type: 'edge',
    id: 'portugues',
    name: 'Portugués (Brasil)',
    voice: 'pt-BR-AntonioNeural',
    desc: 'Voz brasileña.',
  },
  frances: {
    type: 'edge',
    id: 'frances',
    name: 'Francés',
    voice: 'fr-FR-HenriNeural',
    desc: 'Voz francesa.',
  },
  aleman: {
    type: 'edge',
    id: 'aleman',
    name: 'Alemán',
    voice: 'de-DE-ConradNeural',
    desc: 'Voz alemana.',
  },
  italiano: {
    type: 'edge',
    id: 'italiano',
    name: 'Italiano',
    voice: 'it-IT-DiegoNeural',
    desc: 'Voz italiana.',
  },
  ruso: {
    type: 'edge',
    id: 'ruso',
    name: 'Ruso',
    voice: 'ru-RU-DmitryNeural',
    desc: 'Voz rusa.',
  },
  coreano: {
    type: 'edge',
    id: 'coreano',
    name: 'Coreano',
    voice: 'ko-KR-InJoonNeural',
    desc: 'Voz coreana.',
  },
};

const ALL_VOICES = {
  ...LOQUENDO_VOICES,
  ...AI_VOICES,
  ...INTERNATIONAL_VOICES,
};

// Alias comunes para facilitar los comandos
const ALIASES = {
  bananero: 'bananero',
  elbananero: 'bananero',
  sape: 'bananero',
  arnold: 'arnold',
  arnoldbana: 'arnold',
  terminator: 'arnold',
  latorre: 'latorre',
  diegolatorre: 'latorre',
  gambeta: 'latorre',
  peloconcha: 'peloconcha',
  pelo: 'peloconcha',
  peluca: 'peluca',
  elpeluca: 'peluca',
  pelucasape: 'peluca',
  harry: 'peluca',
  hagrid: 'peluca',
  narrador: 'narrador',
  narradorbana: 'narrador',
  narradorbananero: 'narrador',
  joker: 'joker',
  joken: 'joker',
  jokenbananero: 'joker',
  jokerbananero: 'joker',
  guason: 'joker',
  momo: 'momo',
  momoladinastia: 'momo',
  sonic: 'sonic',
  erizo: 'sonic',
  sonicboom: 'sonic',
  dross: 'dross',
  drossrotzank: 'dross',
  alonso: 'alonso',
  fernando: 'alonso',
  fernandoalonso: 'alonso',
  nano: 'alonso',
  elnano: 'alonso',
  heman: 'heman',
  'he-man': 'heman',
  ivan: 'heman',
  trolazo: 'heman',
  ivantrolazo: 'heman',
  ivaneltrolazo: 'heman',
  adam: 'heman',
  optimus: 'optimus',
  optimusprime: 'optimus',
  prime: 'optimus',
  autobot: 'optimus',
  transformers: 'optimus',
  babidi: 'babidi',
  dbz: 'babidi',
  cj: 'jorge',
  loquendo: 'jorge',
  ryder: 'juan',
  tenpenny: 'carlos',
  cesar: 'diego',
  catalina: 'carmen',
  tiogilipollas: 'tio',
  el_tio: 'tio',
  viejo: 'tio',
  arg: 'diego',
  argentino: 'diego',
  mexico: 'esperanza',
  mexicana: 'esperanza',
  chile: 'francisca',
  en: 'ingles',
  us: 'ingles',
  ja: 'japones',
  jp: 'japones',
  pt: 'portugues',
  br: 'portugues',
  fr: 'frances',
  de: 'aleman',
  it: 'italiano',
  ru: 'ruso',
  ko: 'coreano',
  kr: 'coreano',
  es: 'jorge',
};

/**
 * Minimal MessagePack encoder so inline zero-shot audio references work without external dependencies.
 */
function encodeMsgpack(val) {
  const chunks = [];
  function write(v) {
    if (v === null || v === undefined) {
      chunks.push(Buffer.from([0xc0]));
    } else if (typeof v === 'boolean') {
      chunks.push(Buffer.from([v ? 0xc3 : 0xc2]));
    } else if (typeof v === 'number') {
      if (Number.isInteger(v)) {
        if (v >= 0 && v <= 0x7f) chunks.push(Buffer.from([v]));
        else if (v >= -32 && v < 0) chunks.push(Buffer.from([v & 0xff]));
        else if (v >= 0 && v <= 0xffff) {
          const b = Buffer.alloc(3);
          b[0] = 0xcd;
          b.writeUInt16BE(v, 1);
          chunks.push(b);
        } else if (v >= 0 && v <= 0xffffffff) {
          const b = Buffer.alloc(5);
          b[0] = 0xce;
          b.writeUInt32BE(v, 1);
          chunks.push(b);
        } else {
          const b = Buffer.alloc(5);
          b[0] = 0xd2;
          b.writeInt32BE(v, 1);
          chunks.push(b);
        }
      } else {
        const b = Buffer.alloc(9);
        b[0] = 0xcb;
        b.writeDoubleBE(v, 1);
        chunks.push(b);
      }
    } else if (typeof v === 'string') {
      const strBuf = Buffer.from(v, 'utf8');
      const len = strBuf.length;
      if (len <= 31) chunks.push(Buffer.from([0xa0 | len]));
      else if (len <= 0xff) chunks.push(Buffer.from([0xd9, len]));
      else if (len <= 0xffff) {
        const h = Buffer.alloc(3);
        h[0] = 0xda;
        h.writeUInt16BE(len, 1);
        chunks.push(h);
      } else {
        const h = Buffer.alloc(5);
        h[0] = 0xdb;
        h.writeUInt32BE(len, 1);
        chunks.push(h);
      }
      chunks.push(strBuf);
    } else if (Buffer.isBuffer(v)) {
      const len = v.length;
      if (len <= 0xff) chunks.push(Buffer.from([0xc4, len]));
      else if (len <= 0xffff) {
        const h = Buffer.alloc(3);
        h[0] = 0xc5;
        h.writeUInt16BE(len, 1);
        chunks.push(h);
      } else {
        const h = Buffer.alloc(5);
        h[0] = 0xc6;
        h.writeUInt32BE(len, 1);
        chunks.push(h);
      }
      chunks.push(v);
    } else if (Array.isArray(v)) {
      const len = v.length;
      if (len <= 15) chunks.push(Buffer.from([0x90 | len]));
      else if (len <= 0xffff) {
        const h = Buffer.alloc(3);
        h[0] = 0xdc;
        h.writeUInt16BE(len, 1);
        chunks.push(h);
      } else {
        const h = Buffer.alloc(5);
        h[0] = 0xdd;
        h.writeUInt32BE(len, 1);
        chunks.push(h);
      }
      for (const item of v) write(item);
    } else if (typeof v === 'object') {
      const keys = Object.keys(v).filter((k) => v[k] !== undefined);
      const len = keys.length;
      if (len <= 15) chunks.push(Buffer.from([0x80 | len]));
      else if (len <= 0xffff) {
        const h = Buffer.alloc(3);
        h[0] = 0xde;
        h.writeUInt16BE(len, 1);
        chunks.push(h);
      } else {
        const h = Buffer.alloc(5);
        h[0] = 0xdf;
        h.writeUInt32BE(len, 1);
        chunks.push(h);
      }
      for (const k of keys) {
        write(k);
        write(v[k]);
      }
    }
  }
  write(val);
  return Buffer.concat(chunks);
}

class TTSManager {
  constructor() {
    this.players = new Map(); // guildId -> { player, queue: [], isPlaying: false, connection }
    this.settings = loadSettings();
    this.userVoices = new Map(Object.entries(this.settings.userVoices || {}));
    this.serverVoices = new Map(Object.entries(this.settings.serverVoices || {}));
    this.ttsChannels = new Map(Object.entries(this.settings.ttsChannels || {}));
    this.referenceAudioCache = new Map();
  }

  getReferenceAudioBuffer(filePath) {
    if (!this.referenceAudioCache.has(filePath)) {
      this.referenceAudioCache.set(filePath, fs.readFileSync(filePath));
    }
    return this.referenceAudioCache.get(filePath);
  }

  save() {
    this.settings.userVoices = Object.fromEntries(this.userVoices);
    this.settings.serverVoices = Object.fromEntries(this.serverVoices);
    this.settings.ttsChannels = Object.fromEntries(this.ttsChannels);
    saveSettings(this.settings);
  }

  resolveVoiceKey(key) {
    if (!key) return null;
    const normalized = key
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    const compact = normalized.replace(/[\s_-]+/g, '');
    const resolved = ALIASES[normalized] || ALIASES[compact] || normalized;
    return ALL_VOICES[resolved] ? resolved : null;
  }

  // Configuración de voz personal por usuario
  setUserVoice(userId, key) {
    const resolved = this.resolveVoiceKey(key);
    if (resolved) {
      this.userVoices.set(userId, resolved);
      this.save();
      return { ...ALL_VOICES[resolved], key: resolved };
    }
    return null;
  }

  getUserVoice(userId, guildId = null) {
    const userKey = this.userVoices.get(userId);
    if (userKey && ALL_VOICES[userKey]) {
      return { ...ALL_VOICES[userKey], key: userKey };
    }
    return this.getServerVoice(guildId);
  }

  // Configuración de voz predeterminada del servidor
  setServerVoice(guildId, key) {
    const resolved = this.resolveVoiceKey(key);
    if (resolved) {
      this.serverVoices.set(guildId, resolved);
      this.save();
      return { ...ALL_VOICES[resolved], key: resolved };
    }
    return null;
  }

  getServerVoice(guildId) {
    const serverKey = (guildId && this.serverVoices.get(guildId)) || process.env.DEFAULT_VOICE || 'jorge';
    const key = ALL_VOICES[serverKey] ? serverKey : 'jorge';
    return { ...ALL_VOICES[key], key };
  }

  // Configuración de canal TTS automático
  setTtsChannel(guildId, channelId) {
    this.ttsChannels.set(guildId, channelId);
    this.save();
  }

  removeTtsChannel(guildId) {
    this.ttsChannels.delete(guildId);
    this.save();
  }

  getTtsChannel(guildId) {
    return this.ttsChannels.get(guildId) || null;
  }

  cleanText(text) {
    let cleaned = text
      .replace(/<a?:\w+:\d+>/g, '') // Emojis de Discord
      .replace(/https?:\/\/\S+/g, '') // Links web
      .replace(/```[\s\S]*?```/g, '') // Bloques de código
      .replace(/`.*?`/g, '') // Código inline
      .replace(/[\r\n]+/g, ' ') // Saltos de línea
      .replace(/\s+/g, ' ') // Espacios dobles
      .trim();

    // Limitar longitud para evitar saturación de audio
    if (cleaned.length > 300) {
      cleaned = cleaned.slice(0, 300) + '...';
    }
    return cleaned;
  }

  getLoquendoUrl(text, voice) {
    const fragments = [
      `<engineID>${voice.engine}</engineID>`,
      `<voiceID>${voice.id}</voiceID>`,
      `<langID>${voice.langId}</langID>`,
      '<ext>mp3</ext>',
      text,
    ];
    const hash = crypto.createHash('md5').update(fragments.join('')).digest('hex');
    return `https://cache-a.oddcast.com/c_fs/${hash}.mp3?engine=${voice.engine}&language=${voice.langId}&voice=${voice.id}&text=${encodeURIComponent(text)}&useUTF8=1`;
  }

  streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  fetchGetBuffer(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: timeoutMs }, async (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP Status ${res.statusCode}`));
        }
        try {
          const buf = await this.streamToBuffer(res);
          if (!buf || buf.length < 256) {
            return reject(new Error('Audio vacío o incompleto recibido'));
          }
          resolve(buf);
        } catch (err) {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy(new Error('HTTP GET timeout'));
      });
      req.on('error', reject);
    });
  }

  fetchFishAudioBuffer(text, voiceConfigOrId, apiKey, timeoutMs = 25000) {
    // Asegurar puntuación final para que el modelo IA cierre la entonación naturalmente sin cortar la última palabra
    const safeText = /[.!?…]$/.test(text) ? text : `${text}.`;
    const isConfigObj = voiceConfigOrId && typeof voiceConfigOrId === 'object';

    let contentType = 'application/json';
    let payload;

    if (isConfigObj && voiceConfigOrId.referenceAudioFile) {
      const refAudioBuf = this.getReferenceAudioBuffer(voiceConfigOrId.referenceAudioFile);
      contentType = 'application/msgpack';
      payload = encodeMsgpack({
        text: safeText,
        references: [{ audio: refAudioBuf, text: voiceConfigOrId.referenceText || '' }],
        format: 'mp3',
        latency: 'normal',
        normalize: true,
        chunk_length: 300,
      });
    } else {
      const referenceId = isConfigObj ? voiceConfigOrId.referenceId : voiceConfigOrId;
      payload = Buffer.from(
        JSON.stringify({
          text: safeText,
          reference_id: referenceId,
          format: 'mp3',
          latency: 'normal',
          normalize: true,
          chunk_length: 300,
        }),
        'utf8'
      );
    }

    return new Promise((resolve, reject) => {
      const req = https.request(
        'https://api.fish.audio/v1/tts',
        {
          method: 'POST',
          timeout: timeoutMs,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': contentType,
            model: 's2.1-pro-free',
            'Content-Length': payload.length,
          },
        },
        async (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`Fish Audio HTTP Status ${res.statusCode}`));
          }
          try {
            const buf = await this.streamToBuffer(res);
            if (!buf || buf.length < 256) {
              return reject(new Error('Fish Audio devolvió un audio vacío o incompleto'));
            }
            resolve(buf);
          } catch (err) {
            reject(err);
          }
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error('Fish Audio request timeout'));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  applyAudioFilter(inputBuffer, filterStr) {
    return new Promise((resolve) => {
      try {
        const proc = spawn(FFMPEG_BIN, [
          '-i', 'pipe:0',
          '-af', `${filterStr},apad=pad_dur=0.25`,
          '-f', 'mp3',
          'pipe:1',
        ]);

        const outChunks = [];
        proc.stdout.on('data', (c) => outChunks.push(c));
        proc.stdin.on('error', () => {});

        proc.on('error', (spawnErr) => {
          console.error('[FFMPEG SPAWN ERROR]:', spawnErr.message);
          resolve(inputBuffer);
        });

        proc.on('close', (code) => {
          const outBuf = Buffer.concat(outChunks);
          if (code === 0 && outBuf.length >= 256) {
            resolve(outBuf);
          } else {
            resolve(inputBuffer);
          }
        });

        proc.stdin.end(inputBuffer);
      } catch (err) {
        console.error('[FFMPEG FILTER ERROR]:', err.message);
        resolve(inputBuffer);
      }
    });
  }

  playAudioBuffer(guildId, state, audioBuffer) {
    if (!this.players.has(guildId)) return;
    if (!audioBuffer || audioBuffer.length < 256) {
      throw new Error('Buffer de audio inválido');
    }

    const stream = Readable.from(audioBuffer);
    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
      silencePaddingFrames: 25, // 500ms de silencio final para que Discord nunca recorte la última sílaba
    });

    if (state.connection) {
      state.connection.subscribe(state.player);
    }
    state.player.play(resource);
  }

  getQueue(guildId, connection) {
    if (!this.players.has(guildId)) {
      const player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play,
          maxMissedFrames: 150, // Tolerancia de 3 segundos ante micro-cortes de CPU/red en contenedor
        },
      });
      connection.subscribe(player);

      const state = {
        player,
        queue: [],
        isPlaying: false,
        cooldownTimer: null,
        connection,
      };

      // Manejo de fin de audio con COOLDOWN natural entre mensajes de la cola (800ms)
      player.on(AudioPlayerStatus.Idle, (oldState) => {
        if (oldState.status === AudioPlayerStatus.Idle) return;
        state.isPlaying = false;
        if (state.cooldownTimer) clearTimeout(state.cooldownTimer);
        state.cooldownTimer = setTimeout(() => {
          state.cooldownTimer = null;
          this.playNext(guildId);
        }, 800);
      });

      player.on('error', (err) => {
        console.error(`[TTS PLAYER ERROR] [Guild ${guildId}]:`, err.message);
        state.isPlaying = false;
        if (state.cooldownTimer) clearTimeout(state.cooldownTimer);
        state.cooldownTimer = setTimeout(() => {
          state.cooldownTimer = null;
          this.playNext(guildId);
        }, 500);
      });

      this.players.set(guildId, state);
    } else {
      const state = this.players.get(guildId);
      if (connection && state.connection !== connection) {
        state.connection = connection;
        connection.subscribe(state.player);
      }
    }
    return this.players.get(guildId);
  }

  async enqueue(guildId, connection, text, customVoiceKey = null, authorId = null) {
    const cleaned = this.cleanText(text);
    if (!cleaned) return { success: false, reason: 'empty' };

    const state = this.getQueue(guildId, connection);

    const voiceKey = customVoiceKey
      ? (this.resolveVoiceKey(customVoiceKey) || 'jorge')
      : (authorId ? this.getUserVoice(authorId, guildId).key : this.getServerVoice(guildId).key);

    const voiceConfig = ALL_VOICES[voiceKey] || ALL_VOICES.jorge;

    const queueItem = {
      text: cleaned,
      voiceConfig,
      authorId,
      enqueuedAt: Date.now(),
    };

    state.queue.push(queueItem);

    if (!state.isPlaying) {
      this.playNext(guildId);
      return { success: true, queued: false, queuePosition: 0 };
    }

    return { success: true, queued: true, queuePosition: state.queue.length };
  }

  async playNext(guildId) {
    const state = this.players.get(guildId);
    if (!state) return;

    if (state.cooldownTimer) {
      clearTimeout(state.cooldownTimer);
      state.cooldownTimer = null;
    }

    if (state.queue.length === 0) {
      state.isPlaying = false;
      return;
    }

    state.isPlaying = true;
    const { text, voiceConfig } = state.queue.shift();

    try {
      let audioBuffer = null;

      if (voiceConfig.type === 'loquendo') {
        // --- 1. MOTOR REAL LOQUENDO (Oddcast Engine 2) ---
        const loquendoUrl = this.getLoquendoUrl(text, voiceConfig);
        audioBuffer = await this.fetchGetBuffer(loquendoUrl);

        if (voiceConfig.filter) {
          audioBuffer = await this.applyAudioFilter(audioBuffer, voiceConfig.filter);
        }
      } else if (voiceConfig.type === 'fish_audio') {
        // --- 2. VOCES CLONADAS POR IA (Fish Audio API - Buffer Completo) ---
        const apiKey = process.env.FISH_AUDIO_API_KEY;
        if (!apiKey) {
          console.warn('[FISH AUDIO] No se configuró FISH_AUDIO_API_KEY en .env. Usando Google TTS como respaldo...');
          return await this.fallbackGoogle(guildId, state, text, voiceConfig);
        }

        audioBuffer = await this.fetchFishAudioBuffer(text, voiceConfig, apiKey);
      } else {
        // --- 3. VOCES INTERNACIONALES (MsEdgeTTS) ---
        const edge = new MsEdgeTTS();
        await edge.setMetadata(voiceConfig.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
        const { audioStream } = edge.toStream(text);
        audioBuffer = await this.streamToBuffer(audioStream);
      }

      this.playAudioBuffer(guildId, state, audioBuffer);
    } catch (primaryErr) {
      console.warn(`[TTS] Error en motor principal (${primaryErr.message}), usando respaldo Google TTS...`);
      await this.fallbackGoogle(guildId, state, text, voiceConfig);
    }
  }

  async fallbackGoogle(guildId, state, text, voiceConfig) {
    try {
      const langCode = (voiceConfig.type === 'loquendo' || voiceConfig.type === 'fish_audio')
        ? 'es'
        : (voiceConfig.voice?.split('-')[0] || 'es');
      const safeText = text.length > 190 ? text.slice(0, 190) : text;
      const url = googleTTS.getAudioUrl(safeText, {
        lang: langCode,
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000,
      });

      const audioBuffer = await this.fetchGetBuffer(url, 12000);
      this.playAudioBuffer(guildId, state, audioBuffer);
    } catch (backupErr) {
      console.error('[TTS FATAL] Fallaron todos los motores de audio:', backupErr.message);
      state.isPlaying = false;
      if (state.cooldownTimer) clearTimeout(state.cooldownTimer);
      state.cooldownTimer = setTimeout(() => {
        state.cooldownTimer = null;
        this.playNext(guildId);
      }, 500);
    }
  }

  clearQueue(guildId) {
    const state = this.players.get(guildId);
    if (state) {
      if (state.cooldownTimer) {
        clearTimeout(state.cooldownTimer);
        state.cooldownTimer = null;
      }
      state.queue = [];
      state.player.stop();
      state.isPlaying = false;
    }
  }

  destroy(guildId) {
    const state = this.players.get(guildId);
    if (state) {
      if (state.cooldownTimer) {
        clearTimeout(state.cooldownTimer);
        state.cooldownTimer = null;
      }
      state.queue = [];
      state.player.stop();
      this.players.delete(guildId);
    }
  }

  getVoicesList() {
    return ALL_VOICES;
  }
}

module.exports = new TTSManager();