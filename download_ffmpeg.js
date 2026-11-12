const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.join(__dirname, 'node_modules', 'ffmpeg-static'),
  __dirname,
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  }
}

const targetBinary = path.join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg');
const fallbackBinary = path.join(__dirname, 'ffmpeg');

if (fs.existsSync(targetBinary) && fs.statSync(targetBinary).size > 1000000) {
  try { fs.chmodSync(targetBinary, 0o755); } catch {}
  console.log('[FFMPEG AUTO-INSTALL] El binario ya está presente en:', targetBinary);
  process.exit(0);
}

const url = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-x64.gz';
console.log('[FFMPEG AUTO-INSTALL] Descargando binario oficial de Linux (x64) para bot-hosting...');

function download(sourceUrl, dest, callback) {
  https.get(sourceUrl, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return download(res.headers.location, dest, callback);
    }
    if (res.statusCode !== 200) {
      return callback(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
    }

    const gunzip = zlib.createGunzip();
    const out = fs.createWriteStream(dest);

    res.pipe(gunzip).pipe(out);

    out.on('finish', () => {
      try {
        fs.chmodSync(dest, 0o755);
        callback(null);
      } catch (err) {
        callback(err);
      }
    });

    out.on('error', callback);
    gunzip.on('error', callback);
    res.on('error', callback);
  }).on('error', callback);
}

download(url, targetBinary, (err) => {
  if (err) {
    console.error('[FFMPEG AUTO-INSTALL ERROR]:', err.message);
    process.exit(1);
  }
  console.log('[FFMPEG AUTO-INSTALL] Instalado correctamente en:', targetBinary);

  // Copia de seguridad en la raíz
  try {
    fs.copyFileSync(targetBinary, fallbackBinary);
    fs.chmodSync(fallbackBinary, 0o755);
  } catch {}

  process.exit(0);
});
