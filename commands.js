const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const voiceChoices = [
  { name: 'El Bananero (Voz IA Original)', value: 'bananero' },
  { name: 'Arnold (El Bananero IA)', value: 'arnold' },
  { name: 'Diego Latorre (Gambeta IA)', value: 'latorre' },
  { name: 'Peloconcha (Bananero IA)', value: 'peloconcha' },
  { name: 'El Peluca (Bananero IA)', value: 'peluca' },
  { name: 'Narrador (El Bananero IA)', value: 'narrador' },
  { name: 'Joker (El Bananero IA)', value: 'joker' },
  { name: 'He-Man / Iván (Bananero IA)', value: 'heman' },
  { name: 'Momo (Voz IA)', value: 'momo' },
  { name: 'Sonic Latino (Voz IA)', value: 'sonic' },
  { name: 'Dross (Voz IA)', value: 'dross' },
  { name: 'Fernando Alonso (Voz IA)', value: 'alonso' },
  { name: 'Optimus Prime (Transformers IA)', value: 'optimus' },
  { name: 'Babidi Latino DBZ (Voz IA)', value: 'babidi' },
  { name: 'Jorge (CJ / Loquendo Clásico)', value: 'jorge' },
  { name: 'Juan (Ryder / Pandillero)', value: 'juan' },
  { name: 'Carlos (Oficial Tenpenny)', value: 'carlos' },
  { name: 'Carmen (Catalina)', value: 'carmen' },
  { name: 'Diego (Cesar Vialpando)', value: 'diego' },
  { name: 'Esperanza (Mexicana)', value: 'esperanza' },
  { name: 'Soledad (Latina)', value: 'soledad' },
  { name: 'Francisca (Chilena)', value: 'francisca' },
  { name: 'Leonor (Castellana)', value: 'leonor' },
  { name: 'Tío Gilipollas (Voz Oficial)', value: 'tio' },
  { name: 'Loquendero Rápido', value: 'loquendero' },
  { name: 'Inglés (EE.UU.)', value: 'ingles' },
  { name: 'Japonés (Anime)', value: 'japones' },
  { name: 'Portugués (Brasil)', value: 'portugues' },
  { name: 'Francés', value: 'frances' },
  { name: 'Alemán', value: 'aleman' },
  { name: 'Italiano', value: 'italiano' },
  { name: 'Ruso', value: 'ruso' },
  { name: 'Coreano', value: 'coreano' },
];

const AUTOCOMPLETE_KEYWORDS = {
  bananero: 'sape elbananero',
  arnold: 'terminator arnoldbana',
  latorre: 'gambeta diegolatorre',
  peloconcha: 'pelo',
  peluca: 'harry hagrid pelucasape',
  narrador: 'narradorbana narradorbananero',
  joker: 'joken guason jokenbananero jokerbananero',
  heman: 'he-man ivan trolazo ivantrolazo ivaneltrolazo adam',
  momo: 'momoladinastia',
  sonic: 'erizo sonicboom',
  dross: 'drossrotzank',
  alonso: 'fernando elnano nano',
  optimus: 'prime optimusprime autobot transformers lider',
  babidi: 'dbz',
  jorge: 'cj loquendo es',
  juan: 'ryder',
  carlos: 'tenpenny',
  carmen: 'catalina',
  diego: 'cesar arg argentino',
  esperanza: 'mexico mexicana',
  francisca: 'chile',
  tio: 'tiogilipollas viejo',
  ingles: 'en us english',
  japones: 'ja jp anime',
  portugues: 'pt br brasil',
  frances: 'fr',
  aleman: 'de',
  italiano: 'it',
  ruso: 'ru',
  coreano: 'ko kr',
};

function normalizeSearch(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getAutocompleteVoiceChoices(query = '') {
  const q = normalizeSearch(query);
  if (!q) return voiceChoices.slice(0, 25);
  return voiceChoices
    .filter((c) => {
      const haystack = normalizeSearch(`${c.name} ${c.value} ${AUTOCOMPLETE_KEYWORDS[c.value] || ''}`);
      return haystack.includes(q) || haystack.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
    })
    .slice(0, 25);
}

const slashCommands = [
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Conecta el bot a tu canal de voz actual'),

  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Desconecta el bot del canal de voz'),

  new SlashCommandBuilder()
    .setName('canal')
    .setDescription('Configura el canal para lectura automática por voz (Auto-TTS)')
    .addSubcommand((sub) =>
      sub
        .setName('activar')
        .setDescription('Activa la lectura automática en un canal')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal a activar (por defecto el canal actual)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('desactivar')
        .setDescription('Desactiva la lectura automática en el servidor')
    )
    .addSubcommand((sub) =>
      sub
        .setName('estado')
        .setDescription('Muestra qué canal está configurado actualmente')
    ),

  new SlashCommandBuilder()
    .setName('voz')
    .setDescription('Elige tu voz personal de Loquendo, IA o internacional')
    .addStringOption((opt) =>
      opt
        .setName('personaje')
        .setDescription('Escribí o elegí el personaje con el que hablarás')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  new SlashCommandBuilder()
    .setName('vozserver')
    .setDescription('Configura la voz predeterminada del servidor y de GenAi')
    .addStringOption((opt) =>
      opt
        .setName('personaje')
        .setDescription('Escribí o elegí el personaje predeterminado para el servidor')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  new SlashCommandBuilder()
    .setName('voces')
    .setDescription('Muestra la lista de voces de Loquendo e internacionales'),

  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Pronuncia un texto en voz alta con tu voz elegida')
    .addStringOption((opt) =>
      opt
        .setName('texto')
        .setDescription('El texto que quieres que diga el bot')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('test')
    .setDescription('Prueba rápida de audio con tu voz activa en el canal de voz'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Muestra todos los comandos y ayuda de uso del bot'),
].map((c) => c.toJSON());

async function registerSlashCommands(token, clientId, guilds = []) {
  try {
    const rest = new REST({ version: '10' }).setToken(token);

    // 1. Registro directo en cada servidor conectado (Aparece en Discord al instante sin esperar caché)
    for (const guild of guilds) {
      try {
        console.log(`[SLASH COMMANDS] Registrando al instante en el servidor: ${guild.name || guild.id}...`);
        await rest.put(Routes.applicationGuildCommands(clientId, guild.id), {
          body: slashCommands,
        });
      } catch (gErr) {
        console.warn(`[SLASH COMMANDS] Aviso en servidor ${guild.id}:`, gErr.message);
      }
    }

    // 2. Registro global
    console.log('[SLASH COMMANDS] Registrando comandos globales en la API de Discord...');
    await rest.put(Routes.applicationCommands(clientId), {
      body: slashCommands,
    });
    console.log('[SLASH COMMANDS] ¡Comandos de barra diagonal (/) registrados exitosamente!');
  } catch (err) {
    console.error('[SLASH COMMANDS ERROR] No se pudieron registrar los comandos:', err.message);
  }
}

module.exports = {
  slashCommands,
  voiceChoices,
  getAutocompleteVoiceChoices,
  registerSlashCommands,
};
