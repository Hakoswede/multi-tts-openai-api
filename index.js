require('dotenv').config();
const express = require('express');
const https = require('https');
const { Readable } = require('stream');
const tts = require('./tts');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;
const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY;
const KOKORO_API_URL = process.env.KOKORO_API_URL || 'http://kokoro-api:5000/v1/audio/speech';

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

async function fetchKokoroBuffer(text, voice = 'ef_dora') {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      input: text,
      voice: voice,
      model: 'kokoro',
    });

    const url = new URL(KOKORO_API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 30000,
    };

    const req = https.request(options, async (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Kokoro HTTP Status ${res.statusCode}`));
      }
      try {
        const buf = await streamToBuffer(res);
        if (!buf || buf.length < 256) {
          return reject(new Error('Kokoro devolvió audio vacío'));
        }
        resolve(buf);
      } catch (err) {
        reject(err);
      }
    });

    req.on('timeout', () => {
      req.destroy(new Error('Kokoro request timeout'));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

app.post('/v1/audio/speech', async (req, res) => {
  try {
    const text = req.body.input;
    const requestedVoice = req.body.voice || req.body.model || 'jorge';

    if (!text) {
      return res.status(400).json({ error: 'Falta el campo input' });
    }

    const voiceKey = tts.resolveVoiceKey(requestedVoice) || 'jorge';
    const voiceConfig = tts.getVoicesList()[voiceKey];

    let audioBuffer;

    if (voiceConfig.type === 'loquendo') {
      const url = tts.getLoquendoUrl(text, voiceConfig);
      audioBuffer = await tts.fetchGetBuffer(url);
      if (voiceConfig.filter) {
        audioBuffer = await tts.applyAudioFilter(audioBuffer, voiceConfig.filter);
      }
    } else if (voiceConfig.type === 'fish_audio') {
      if (!FISH_AUDIO_API_KEY) {
        console.warn('[FISH AUDIO] API key no configurada, usando fallback Kokoro');
        audioBuffer = await fetchKokoroBuffer(text);
      } else {
        try {
          audioBuffer = await tts.fetchFishAudioBuffer(text, voiceConfig, FISH_AUDIO_API_KEY);
        } catch (fishErr) {
          console.warn('[FISH AUDIO] Error, usando fallback Kokoro:', fishErr.message);
          audioBuffer = await fetchKokoroBuffer(text);
        }
      }
    } else {
      const edge = new MsEdgeTTS();
      await edge.setMetadata(voiceConfig.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = edge.toStream(text);
      audioBuffer = await tts.streamToBuffer(audioStream);
    }

    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (err) {
    console.error('[API TTS ERROR]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/v1/models', (req, res) => {
  const voices = tts.getVoicesList();
  const models = Object.entries(voices).map(([id, v]) => ({
    id,
    object: 'model',
    owned_by: v.type === 'loquendo' ? 'loquendo' : v.type === 'fish_audio' ? 'fish-audio' : 'microsoft',
    permission: [],
  }));
  res.json({ object: 'list', data: models });
});

app.get('/v1/audio/voices', (req, res) => {
  const voices = tts.getVoicesList();
  const voicesList = Object.entries(voices).map(([id, v]) => ({
    id,
    name: v.name,
    type: v.type,
    description: v.desc,
  }));
  res.json({ object: 'list', data: voicesList });
});

app.listen(PORT, () => {
  console.log(`[TTS API] Servidor listo escuchando en el puerto ${PORT}`);
});
