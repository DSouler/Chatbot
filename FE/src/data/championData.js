// Danh sách tướng DTCL Mùa 17 (Set 17 — Space Gods)
// Ảnh lấy từ MetaTFT CDN (ảnh TFT Set 17, chất lượng cao, định dạng webp)
// Format URL: https://metatft.gg/wp-content/uploads/tft/16.9/champion/tft17_{key}_square.tft_set17.webp

const METATFT_BASE = 'https://metatft.gg/wp-content/uploads/tft/16.9/champion';

// Fallback: Riot Data Dragon (ảnh LoL gốc, dùng khi MetaTFT thiếu)
const DDRAGON_VERSION = '15.10.1';
const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion`;

// Map: tên hiển thị → { metatftKey, ddragonKey, cost }
// metatftKey: dùng cho URL MetaTFT (tft17_{key}_square.tft_set17.webp)
// ddragonKey: fallback dùng cho Data Dragon ({key}.png)
const CHAMPION_DATA = {
  // ═══════════════════ Cost 1 ═══════════════════
  'Aatrox':       { metatftKey: 'aatrox',      ddragonKey: 'Aatrox',      cost: 1 },
  'Briar':        { metatftKey: 'briar',        ddragonKey: 'Briar',       cost: 1 },
  'Caitlyn':      { metatftKey: 'caitlyn',      ddragonKey: 'Caitlyn',     cost: 1 },
  "Cho'Gath":     { metatftKey: 'chogath',      ddragonKey: 'Chogath',     cost: 1 },
  'ChoGath':      { metatftKey: 'chogath',      ddragonKey: 'Chogath',     cost: 1 },
  'Ezreal':       { metatftKey: 'ezreal',       ddragonKey: 'Ezreal',      cost: 1 },
  'Leona':        { metatftKey: 'leona',        ddragonKey: 'Leona',       cost: 1 },
  'Lissandra':    { metatftKey: 'lissandra',    ddragonKey: 'Lissandra',   cost: 1 },
  'Nasus':        { metatftKey: 'nasus',        ddragonKey: 'Nasus',       cost: 1 },
  'Poppy':        { metatftKey: 'poppy',        ddragonKey: 'Poppy',       cost: 1 },
  "Rek'Sai":      { metatftKey: 'reksai',       ddragonKey: 'RekSai',      cost: 1 },
  'RekSai':       { metatftKey: 'reksai',       ddragonKey: 'RekSai',      cost: 1 },
  'Talon':        { metatftKey: 'talon',        ddragonKey: 'Talon',       cost: 1 },
  'Teemo':        { metatftKey: 'teemo',        ddragonKey: 'Teemo',       cost: 1 },
  'Twisted Fate': { metatftKey: 'twistedfate',  ddragonKey: 'TwistedFate', cost: 1 },
  'TwistedFate':  { metatftKey: 'twistedfate',  ddragonKey: 'TwistedFate', cost: 1 },
  'Veigar':       { metatftKey: 'veigar',       ddragonKey: 'Veigar',      cost: 1 },

  // ═══════════════════ Cost 2 ═══════════════════
  'Akali':        { metatftKey: 'akali',        ddragonKey: 'Akali',       cost: 2 },
  "Bel'Veth":     { metatftKey: 'belveth',      ddragonKey: 'Belveth',     cost: 2 },
  'BelVeth':      { metatftKey: 'belveth',      ddragonKey: 'Belveth',     cost: 2 },
  'Gnar':         { metatftKey: 'gnar',         ddragonKey: 'Gnar',        cost: 2 },
  'Gragas':       { metatftKey: 'gragas',       ddragonKey: 'Gragas',      cost: 2 },
  'Gwen':         { metatftKey: 'gwen',         ddragonKey: 'Gwen',        cost: 2 },
  'Jax':          { metatftKey: 'jax',          ddragonKey: 'Jax',         cost: 2 },
  'Jinx':         { metatftKey: 'jinx',         ddragonKey: 'Jinx',        cost: 2 },
  'Meepsie':      { metatftKey: 'ivernminion',  ddragonKey: null,          cost: 2 },
  'Milio':        { metatftKey: 'milio',        ddragonKey: 'Milio',       cost: 2 },
  'Mordekaiser':  { metatftKey: 'mordekaiser',  ddragonKey: 'Mordekaiser', cost: 2 },
  'Pantheon':     { metatftKey: 'pantheon',     ddragonKey: 'Pantheon',    cost: 2 },
  'Pyke':         { metatftKey: 'pyke',         ddragonKey: 'Pyke',        cost: 2 },
  'Zoe':          { metatftKey: 'zoe',          ddragonKey: 'Zoe',         cost: 2 },

  // ═══════════════════ Cost 3 ═══════════════════
  'Aurora':       { metatftKey: 'aurora',       ddragonKey: 'Aurora',       cost: 3 },
  'Diana':        { metatftKey: 'diana',        ddragonKey: 'Diana',        cost: 3, metatftSuffix: 'teamplanner_splash' },
  'Fizz':         { metatftKey: 'fizz',         ddragonKey: 'Fizz',         cost: 3 },
  'Illaoi':       { metatftKey: 'illaoi',       ddragonKey: 'Illaoi',       cost: 3 },
  "Kai'Sa":       { metatftKey: 'kaisa',        ddragonKey: 'Kaisa',        cost: 3 },
  'KaiSa':        { metatftKey: 'kaisa',        ddragonKey: 'Kaisa',        cost: 3 },
  'Lulu':         { metatftKey: 'lulu',         ddragonKey: 'Lulu',         cost: 3 },
  'Maokai':       { metatftKey: 'maokai',       ddragonKey: 'Maokai',       cost: 3 },
  'Miss Fortune': { metatftKey: 'missfortune',  ddragonKey: 'MissFortune',  cost: 3 },
  'MissFortune':  { metatftKey: 'missfortune',  ddragonKey: 'MissFortune',  cost: 3 },
  'Ornn':         { metatftKey: 'ornn',         ddragonKey: 'Ornn',         cost: 3 },
  'Rhaast':       { metatftKey: 'kayn_slay',    ddragonKey: 'Kayn',         cost: 3 },
  'Samira':       { metatftKey: 'samira',       ddragonKey: 'Samira',       cost: 3 },
  'Urgot':        { metatftKey: 'urgot',        ddragonKey: 'Urgot',        cost: 3 },
  'Viktor':       { metatftKey: 'viktor',       ddragonKey: 'Viktor',       cost: 3 },

  // ═══════════════════ Cost 4 ═══════════════════
  'Aurelion Sol': { metatftKey: 'aurelionsol',  ddragonKey: 'AurelionSol',  cost: 4 },
  'AurelionSol':  { metatftKey: 'aurelionsol',  ddragonKey: 'AurelionSol',  cost: 4 },
  'Corki':        { metatftKey: 'corki',        ddragonKey: 'Corki',        cost: 4 },
  'Karma':        { metatftKey: 'karma',        ddragonKey: 'Karma',        cost: 4 },
  'Kindred':      { metatftKey: 'kindred',      ddragonKey: 'Kindred',      cost: 4 },
  'LeBlanc':      { metatftKey: 'leblanc',      ddragonKey: 'Leblanc',      cost: 4 },
  'Leblanc':      { metatftKey: 'leblanc',      ddragonKey: 'Leblanc',      cost: 4 },
  'Master Yi':    { metatftKey: 'masteryi',     ddragonKey: 'MasterYi',     cost: 4 },
  'MasterYi':     { metatftKey: 'masteryi',     ddragonKey: 'MasterYi',     cost: 4 },
  'Nami':         { metatftKey: 'nami',         ddragonKey: 'Nami',         cost: 4 },
  'Nunu & Willump': { metatftKey: 'nunu',       ddragonKey: 'Nunu',         cost: 4 },
  'Nunu':         { metatftKey: 'nunu',         ddragonKey: 'Nunu',         cost: 4 },
  'Rammus':       { metatftKey: 'rammus',       ddragonKey: 'Rammus',       cost: 4 },
  'Riven':        { metatftKey: 'riven',        ddragonKey: 'Riven',        cost: 4 },
  'Robot':        { metatftKey: 'galio',        ddragonKey: null,           cost: 4 },
  'Tahm Kench':   { metatftKey: 'tahmkench',    ddragonKey: 'TahmKench',    cost: 4 },
  'TahmKench':    { metatftKey: 'tahmkench',    ddragonKey: 'TahmKench',    cost: 4 },
  'Xayah':        { metatftKey: 'xayah',        ddragonKey: 'Xayah',        cost: 4 },

  // ═══════════════════ Cost 5 ═══════════════════
  'Bard':         { metatftKey: 'bard',         ddragonKey: 'Bard',         cost: 5 },
  'Blitzcrank':   { metatftKey: 'blitzcrank',   ddragonKey: 'Blitzcrank',   cost: 5 },
  'Fiora':        { metatftKey: 'fiora',        ddragonKey: 'Fiora',        cost: 5 },
  'Graves':       { metatftKey: 'graves',       ddragonKey: 'Graves',       cost: 5 },
  'Jhin':         { metatftKey: 'jhin',         ddragonKey: 'Jhin',         cost: 5 },
  'Morgana':      { metatftKey: 'morgana',      ddragonKey: 'Morgana',      cost: 5 },
  'Shen':         { metatftKey: 'shen',         ddragonKey: 'Shen',         cost: 5 },
  'Sona':         { metatftKey: 'sona',         ddragonKey: 'Sona',         cost: 5 },
  'Vex':          { metatftKey: 'vex',          ddragonKey: 'Vex',          cost: 5 },
  'Zed':          { metatftKey: 'zed',          ddragonKey: 'Zed',          cost: 5 },

  // ═══════════════════ Đặc biệt / Summon ═══════════════════
  'Thượng Cổ Thần Binh': { metatftKey: 'enemy_aatrox',   ddragonKey: 'Volibear',    cost: 5 },
  'Volibear':            { metatftKey: 'enemy_aatrox',   ddragonKey: 'Volibear',    cost: 5 },
  'Bia & Bayin':         { metatftKey: 'summon',         ddragonKey: null,          cost: 3 },
  'BiaAndBayin':         { metatftKey: 'summon',         ddragonKey: null,          cost: 3 },
};

// Cost → border/accent color for tooltip
const COST_COLORS = {
  1: '#9ca3af', // gray
  2: '#22c55e', // green
  3: '#3b82f6', // blue
  4: '#a855f7', // purple
  5: '#f59e0b', // gold/legendary
};

// Cost → label
const COST_LABELS = {
  1: '① Phổ thông',
  2: '② Hiếm',
  3: '③ Sử thi',
  4: '④ Huyền thoại',
  5: '⑤ Tối thượng',
};

/**
 * Lấy URL ảnh TFT Set 17 của tướng (ưu tiên MetaTFT, fallback Data Dragon)
 * @param {string} name - Tên tướng
 * @returns {{ imageUrl: string, fallbackUrl: string|null, cost: number } | null}
 */
export function getChampionImage(name) {
  const data = CHAMPION_DATA[name];
  if (!data) return null;

  const suffix = data.metatftSuffix || 'square';
  const imageUrl = `${METATFT_BASE}/tft17_${data.metatftKey}_${suffix}.tft_set17.webp`;
  const fallbackUrl = data.ddragonKey
    ? `${DDRAGON_BASE}/${data.ddragonKey}.png`
    : null;

  return { imageUrl, fallbackUrl, cost: data.cost };
}

/**
 * Lấy màu viền theo cost
 */
export function getCostColor(cost) {
  return COST_COLORS[cost] || '#9ca3af';
}

/**
 * Lấy label theo cost
 */
export function getCostLabel(cost) {
  return COST_LABELS[cost] || '';
}

/**
 * Lấy tất cả tên tướng (dùng cho regex matching)
 * Sắp xếp dài → ngắn để match tên dài trước (ví dụ "Miss Fortune" trước "Miss")
 */
export function getAllChampionNames() {
  return Object.keys(CHAMPION_DATA)
    .sort((a, b) => b.length - a.length); // longest first
}

/**
 * Tạo regex pattern để match tên tướng trong text
 * Dùng custom boundary thay vì \b vì \b coi dấu ' là boundary
 * → không match được Kai'Sa, Bel'Veth, Cho'Gath, Rek'Sai
 */
export function getChampionRegex() {
  const names = getAllChampionNames()
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // escape regex chars
    .map(n => n.replace(/'/g, "['\u2018\u2019]")); // match straight AND curly apostrophes
  // (?<![\w'\u2018\u2019]) — phía trước không phải chữ/số/_ hoặc dấu '
  // (?![\w'\u2018\u2019])  — phía sau  không phải chữ/số/_ hoặc dấu '
  return new RegExp(`(?<![\\w'\u2018\u2019])(${names.join('|')})(?![\\w'\u2018\u2019])`, 'g');
}

export default CHAMPION_DATA;
