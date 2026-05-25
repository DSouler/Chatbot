// TFT Set 17 - Item Data (DDragon CDN)
const DDRAGON_VERSION = '15.10.1';
const ITEM_BASE = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/tft-item`;

const ITEM_TYPE_COLORS = {
  offensive: '#ef4444',
  defensive: '#22c55e',
  utility:   '#3b82f6',
  mixed:     '#a855f7',
};

const ITEM_TYPE_LABELS = {
  offensive: '⚔️ Tấn công',
  defensive: '🛡️ Phòng thủ',
  utility:   '🔮 Tiện ích',
  mixed:     '✨ Hỗn hợp',
};

const ITEM_DATA = {
  // Deathblade
  'Deathblade':         { itemId: 'TFT_Item_Deathblade',         type: 'offensive', recipe: ['Kiếm B.F.', 'Kiếm B.F.'] },
  'Kiếm Tử Thần':      { itemId: 'TFT_Item_Deathblade',         type: 'offensive', recipe: ['Kiếm B.F.', 'Kiếm B.F.'] },

  // Giant Slayer
  'Giant Slayer':       { itemId: 'TFT_Item_MadredsBloodrazor',  type: 'offensive', recipe: ['Kiếm B.F.', 'Cung Gỗ'] },
  'Diệt Khổng Lồ':     { itemId: 'TFT_Item_MadredsBloodrazor',  type: 'offensive', recipe: ['Kiếm B.F.', 'Cung Gỗ'] },
  'Đao Diệt Khổng Lồ': { itemId: 'TFT_Item_MadredsBloodrazor',  type: 'offensive', recipe: ['Kiếm B.F.', 'Cung Gỗ'] },

  // Hextech Gunblade
  'Hextech Gunblade':   { itemId: 'TFT_Item_HextechGunblade',    type: 'offensive', recipe: ['Kiếm B.F.', 'Gậy Quá Khổ'] },
  'Kiếm Súng Hextech':  { itemId: 'TFT_Item_HextechGunblade',    type: 'offensive', recipe: ['Kiếm B.F.', 'Gậy Quá Khổ'] },
  'Súng Lục Năng Lượng':{ itemId: 'TFT_Item_HextechGunblade',    type: 'offensive', recipe: ['Kiếm B.F.', 'Gậy Quá Khổ'] },

  // Spear of Shojin
  'Spear of Shojin':    { itemId: 'TFT_Item_SpearOfShojin',      type: 'offensive', recipe: ['Kiếm B.F.', 'Nước Mắt Nữ Thần'] },
  'Ngọn Giáo Shojin':  { itemId: 'TFT_Item_SpearOfShojin',      type: 'offensive', recipe: ['Kiếm B.F.', 'Nước Mắt Nữ Thần'] },
  'Giáo Shojin':        { itemId: 'TFT_Item_SpearOfShojin',      type: 'offensive', recipe: ['Kiếm B.F.', 'Nước Mắt Nữ Thần'] },
  'Thương Shojin':      { itemId: 'TFT_Item_SpearOfShojin',      type: 'offensive', recipe: ['Kiếm B.F.', 'Nước Mắt Nữ Thần'] },

  // Guardian Angel
  'Guardian Angel':     { itemId: 'TFT_Item_GuardianAngel',      type: 'utility',   recipe: ['Kiếm B.F.', 'Giáp Lưới'] },
  'Áo Choàng Bóng Tối':{ itemId: 'TFT_Item_GuardianAngel',      type: 'utility',   recipe: ['Kiếm B.F.', 'Giáp Lưới'] },
  'Thiên Thần Hộ Mệnh': { itemId: 'TFT_Item_GuardianAngel',     type: 'utility',   recipe: ['Kiếm B.F.', 'Giáp Lưới'] },

  // Bloodthirster
  'Bloodthirster':      { itemId: 'TFT_Item_Bloodthirster',      type: 'offensive', recipe: ['Kiếm B.F.', 'Áo Choàng Bạc'] },
  'Huyết Kiếm':         { itemId: 'TFT_Item_Bloodthirster',      type: 'offensive', recipe: ['Kiếm B.F.', 'Áo Choàng Bạc'] },
  'Kiếm Khát Huyết':    { itemId: 'TFT_Item_Bloodthirster',      type: 'offensive', recipe: ['Kiếm B.F.', 'Áo Choàng Bạc'] },

  // Sterak's Gage
  "Sterak's Gage":      { itemId: 'TFT_Item_SteraksGage',        type: 'defensive', recipe: ['Kiếm B.F.', 'Đai Khổng Lồ'] },
  'Móng Vuốt Sterak':   { itemId: 'TFT_Item_SteraksGage',        type: 'defensive', recipe: ['Kiếm B.F.', 'Đai Khổng Lồ'] },

  // Infinity Edge
  'Infinity Edge':      { itemId: 'TFT_Item_InfinityEdge',       type: 'offensive', recipe: ['Kiếm B.F.', 'Găng Đấu Tập'] },
  'Vô Cực Kiếm':        { itemId: 'TFT_Item_InfinityEdge',       type: 'offensive', recipe: ['Kiếm B.F.', 'Găng Đấu Tập'] },
  'Kiếm Vô Cực':        { itemId: 'TFT_Item_InfinityEdge',       type: 'offensive', recipe: ['Kiếm B.F.', 'Găng Đấu Tập'] },

  // Rapid Firecannon
  'Rapid Firecannon':   { itemId: 'TFT_Item_RapidFireCannon',    type: 'offensive', recipe: ['Cung Gỗ', 'Cung Gỗ'] },
  'Rapid Fire Cannon':  { itemId: 'TFT_Item_RapidFireCannon',    type: 'offensive', recipe: ['Cung Gỗ', 'Cung Gỗ'] },
  'Bùa Đỏ':             { itemId: 'TFT_Item_RapidFireCannon',    type: 'offensive', recipe: ['Cung Gỗ', 'Cung Gỗ'] },
  'Đại Bác Liên Thanh': { itemId: 'TFT_Item_RapidFireCannon',    type: 'offensive', recipe: ['Cung Gỗ', 'Cung Gỗ'] },

  // Guinsoo's Rageblade
  "Guinsoo's Rageblade":{ itemId: 'TFT_Item_GuinsoosRageblade',  type: 'offensive', recipe: ['Cung Gỗ', 'Gậy Quá Khổ'] },
  'Cuồng Đao Guinsoo':  { itemId: 'TFT_Item_GuinsoosRageblade',  type: 'offensive', recipe: ['Cung Gỗ', 'Gậy Quá Khổ'] },
  'Lưỡi Cuồng Nộ':      { itemId: 'TFT_Item_GuinsoosRageblade',  type: 'offensive', recipe: ['Cung Gỗ', 'Gậy Quá Khổ'] },

  // Statikk Shiv
  'Statikk Shiv':       { itemId: 'TFT_Item_StatikkShiv',        type: 'offensive', recipe: ['Cung Gỗ', 'Nước Mắt Nữ Thần'] },
  'Trượng Hư Vô':       { itemId: 'TFT_Item_StatikkShiv',        type: 'offensive', recipe: ['Cung Gỗ', 'Nước Mắt Nữ Thần'] },
  'Dao Statikk':         { itemId: 'TFT_Item_StatikkShiv',        type: 'offensive', recipe: ['Cung Gỗ', 'Nước Mắt Nữ Thần'] },

  // Titan's Resolve
  "Titan's Resolve":    { itemId: 'TFT_Item_TitansResolve',      type: 'defensive', recipe: ['Cung Gỗ', 'Giáp Lưới'] },
  'Quyền Năng Khổng Lồ':{ itemId: 'TFT_Item_TitansResolve',     type: 'defensive', recipe: ['Cung Gỗ', 'Giáp Lưới'] },
  'Ý Chí Titan':         { itemId: 'TFT_Item_TitansResolve',      type: 'defensive', recipe: ['Cung Gỗ', 'Giáp Lưới'] },

  // Runaan's Hurricane
  "Runaan's Hurricane": { itemId: 'TFT_Item_RunaansHurricane',   type: 'offensive', recipe: ['Cung Gỗ', 'Áo Choàng Bạc'] },
  'Thịnh Nộ Thủy Quái': { itemId: 'TFT_Item_RunaansHurricane',   type: 'offensive', recipe: ['Cung Gỗ', 'Áo Choàng Bạc'] },
  'Cuồng Phong Runaan':  { itemId: 'TFT_Item_RunaansHurricane',   type: 'offensive', recipe: ['Cung Gỗ', 'Áo Choàng Bạc'] },
  'Cung Cuồng Phong':    { itemId: 'TFT_Item_RunaansHurricane',   type: 'offensive', recipe: ['Cung Gỗ', 'Áo Choàng Bạc'] },

  // Nashor's Tooth
  "Nashor's Tooth":     { itemId: 'TFT_Item_Leviathan',          type: 'offensive', recipe: ['Cung Gỗ', 'Đai Khổng Lồ'] },
  'Nanh Nashor':         { itemId: 'TFT_Item_Leviathan',          type: 'offensive', recipe: ['Cung Gỗ', 'Đai Khổng Lồ'] },

  // Last Whisper
  'Last Whisper':       { itemId: 'TFT_Item_LastWhisper',        type: 'offensive', recipe: ['Cung Gỗ', 'Găng Đấu Tập'] },
  'Cung Xanh':           { itemId: 'TFT_Item_LastWhisper',        type: 'offensive', recipe: ['Cung Gỗ', 'Găng Đấu Tập'] },
  'Lời Nhắn Cuối':       { itemId: 'TFT_Item_LastWhisper',        type: 'offensive', recipe: ['Cung Gỗ', 'Găng Đấu Tập'] },

  // Rabadon's Deathcap
  "Rabadon's Deathcap": { itemId: 'TFT_Item_RabadonsDeathcap',   type: 'offensive', recipe: ['Gậy Quá Khổ', 'Gậy Quá Khổ'] },
  'Mũ Phù Thủy Rabadon':{ itemId: 'TFT_Item_RabadonsDeathcap',   type: 'offensive', recipe: ['Gậy Quá Khổ', 'Gậy Quá Khổ'] },
  'Mũ Tử Thần':          { itemId: 'TFT_Item_RabadonsDeathcap',   type: 'offensive', recipe: ['Gậy Quá Khổ', 'Gậy Quá Khổ'] },

  // Archangel's Staff
  "Archangel's Staff":  { itemId: 'TFT_Item_ArchangelsStaff',    type: 'offensive', recipe: ['Gậy Quá Khổ', 'Nước Mắt Nữ Thần'] },
  'Quyền Trượng Thiên Thần':{ itemId: 'TFT_Item_ArchangelsStaff', type: 'offensive', recipe: ['Gậy Quá Khổ', 'Nước Mắt Nữ Thần'] },
  'Gậy Đại Thiên Thần': { itemId: 'TFT_Item_ArchangelsStaff',    type: 'offensive', recipe: ['Gậy Quá Khổ', 'Nước Mắt Nữ Thần'] },

  // Crownguard
  'Crownguard':         { itemId: 'TFT_Item_Crownguard',         type: 'utility',   recipe: ['Gậy Quá Khổ', 'Giáp Lưới'] },
  'Vương Miện Hoàng Gia':{ itemId: 'TFT_Item_Crownguard',        type: 'utility',   recipe: ['Gậy Quá Khổ', 'Giáp Lưới'] },
  'Hộ Vệ Vương Miện':   { itemId: 'TFT_Item_Crownguard',         type: 'utility',   recipe: ['Gậy Quá Khổ', 'Giáp Lưới'] },

  // Ionic Spark
  'Ionic Spark':        { itemId: 'TFT_Item_IonicSpark',         type: 'mixed',     recipe: ['Gậy Quá Khổ', 'Áo Choàng Bạc'] },
  'Nỏ Sét':             { itemId: 'TFT_Item_IonicSpark',         type: 'mixed',     recipe: ['Gậy Quá Khổ', 'Áo Choàng Bạc'] },
  'Tia Sét Ion':         { itemId: 'TFT_Item_IonicSpark',         type: 'mixed',     recipe: ['Gậy Quá Khổ', 'Áo Choàng Bạc'] },

  // Morellonomicon
  'Morellonomicon':     { itemId: 'TFT_Item_Morellonomicon',     type: 'offensive', recipe: ['Gậy Quá Khổ', 'Đai Khổng Lồ'] },
  'Quỷ Thư Morello':    { itemId: 'TFT_Item_Morellonomicon',     type: 'offensive', recipe: ['Gậy Quá Khổ', 'Đai Khổng Lồ'] },
  'Sách Bóng Tối':       { itemId: 'TFT_Item_Morellonomicon',     type: 'offensive', recipe: ['Gậy Quá Khổ', 'Đai Khổng Lồ'] },

  // Jeweled Gauntlet
  'Jeweled Gauntlet':   { itemId: 'TFT_Item_JeweledGauntlet',   type: 'offensive', recipe: ['Gậy Quá Khổ', 'Găng Đấu Tập'] },
  'Găng Bảo Thạch':     { itemId: 'TFT_Item_JeweledGauntlet',   type: 'offensive', recipe: ['Gậy Quá Khổ', 'Găng Đấu Tập'] },

  // Blue Buff
  'Blue Buff':          { itemId: 'TFT_Item_BlueBuff',           type: 'utility',   recipe: ['Nước Mắt Nữ Thần', 'Nước Mắt Nữ Thần'] },
  'Bùa Xanh':           { itemId: 'TFT_Item_BlueBuff',           type: 'utility',   recipe: ['Nước Mắt Nữ Thần', 'Nước Mắt Nữ Thần'] },

  // Frozen Heart / Steadfast Heart (Lời Thề Hộ Vệ in backend)
  'Frozen Heart':        { itemId: 'TFT_Item_FrozenHeart',       type: 'defensive', recipe: ['Nước Mắt Nữ Thần', 'Giáp Lưới'] },
  'Steadfast Heart':     { itemId: 'TFT_Item_FrozenHeart',       type: 'defensive', recipe: ['Nước Mắt Nữ Thần', 'Giáp Lưới'] },
  'Lời Thề Hộ Vệ':      { itemId: 'TFT_Item_FrozenHeart',       type: 'defensive', recipe: ['Nước Mắt Nữ Thần', 'Giáp Lưới'] },
  'Trái Tim Kiên Định':  { itemId: 'TFT_Item_FrozenHeart',       type: 'defensive', recipe: ['Nước Mắt Nữ Thần', 'Giáp Lưới'] },

  // Adaptive Helm
  'Adaptive Helm':       { itemId: 'TFT_Item_AdaptiveHelm',      type: 'mixed',     recipe: ['Nước Mắt Nữ Thần', 'Áo Choàng Bạc'] },
  'Mũ Thích Nghi':       { itemId: 'TFT_Item_AdaptiveHelm',      type: 'mixed',     recipe: ['Nước Mắt Nữ Thần', 'Áo Choàng Bạc'] },

  // Redemption
  'Redemption':          { itemId: 'TFT_Item_Redemption',        type: 'utility',   recipe: ['Nước Mắt Nữ Thần', 'Đai Khổng Lồ'] },
  'Giáp Tâm Linh':       { itemId: 'TFT_Item_Redemption',        type: 'utility',   recipe: ['Nước Mắt Nữ Thần', 'Đai Khổng Lồ'] },
  'Cứu Chuộc':           { itemId: 'TFT_Item_Redemption',        type: 'utility',   recipe: ['Nước Mắt Nữ Thần', 'Đai Khổng Lồ'] },

  // Hand of Justice
  'Hand of Justice':     { itemId: 'TFT_Item_UnstableConcoction', type: 'mixed',    recipe: ['Nước Mắt Nữ Thần', 'Găng Đấu Tập'] },
  'Bàn Tay Công Lý':     { itemId: 'TFT_Item_UnstableConcoction', type: 'mixed',    recipe: ['Nước Mắt Nữ Thần', 'Găng Đấu Tập'] },

  // Bramble Vest
  'Bramble Vest':        { itemId: 'TFT_Item_BrambleVest',       type: 'defensive', recipe: ['Giáp Lưới', 'Giáp Lưới'] },
  'Áo Choàng Gai':       { itemId: 'TFT_Item_BrambleVest',       type: 'defensive', recipe: ['Giáp Lưới', 'Giáp Lưới'] },
  'Áo Gai':              { itemId: 'TFT_Item_BrambleVest',       type: 'defensive', recipe: ['Giáp Lưới', 'Giáp Lưới'] },

  // Gargoyle Stoneplate
  'Gargoyle Stoneplate': { itemId: 'TFT_Item_GargoyleStoneplate', type: 'defensive', recipe: ['Giáp Lưới', 'Áo Choàng Bạc'] },
  'Thú Tượng Thạch Giáp':{ itemId: 'TFT_Item_GargoyleStoneplate', type: 'defensive', recipe: ['Giáp Lưới', 'Áo Choàng Bạc'] },
  'Giáp Thạch Quỷ':      { itemId: 'TFT_Item_GargoyleStoneplate', type: 'defensive', recipe: ['Giáp Lưới', 'Áo Choàng Bạc'] },

  // Sunfire Cape / Red Buff
  'Sunfire Cape':        { itemId: 'TFT_Item_RedBuff',           type: 'defensive', recipe: ['Giáp Lưới', 'Đai Khổng Lồ'] },
  'Áo Choàng Lửa':       { itemId: 'TFT_Item_RedBuff',           type: 'defensive', recipe: ['Giáp Lưới', 'Đai Khổng Lồ'] },

  // Night Harvester / Steadfast Heart
  'Night Harvester':     { itemId: 'TFT_Item_NightHarvester',    type: 'defensive', recipe: ['Giáp Lưới', 'Găng Đấu Tập'] },

  // Dragon's Claw
  "Dragon's Claw":       { itemId: 'TFT_Item_DragonsClaw',       type: 'defensive', recipe: ['Áo Choàng Bạc', 'Áo Choàng Bạc'] },
  'Vuốt Rồng':           { itemId: 'TFT_Item_DragonsClaw',       type: 'defensive', recipe: ['Áo Choàng Bạc', 'Áo Choàng Bạc'] },

  // Spectral Gauntlet
  'Spectral Gauntlet':   { itemId: 'TFT_Item_SpectralGauntlet',  type: 'defensive', recipe: ['Áo Choàng Bạc', 'Đai Khổng Lồ'] },
  'Giáp Vai Nguyệt Thần':{ itemId: 'TFT_Item_SpectralGauntlet',  type: 'defensive', recipe: ['Áo Choàng Bạc', 'Đai Khổng Lồ'] },

  // Quicksilver
  'Quicksilver':         { itemId: 'TFT_Item_Quicksilver',       type: 'utility',   recipe: ['Áo Choàng Bạc', 'Găng Đấu Tập'] },
  'Áo Choàng Thủy Ngân': { itemId: 'TFT_Item_Quicksilver',       type: 'utility',   recipe: ['Áo Choàng Bạc', 'Găng Đấu Tập'] },
  'Thủy Ngân':            { itemId: 'TFT_Item_Quicksilver',       type: 'utility',   recipe: ['Áo Choàng Bạc', 'Găng Đấu Tập'] },

  // Warmog's Armor
  "Warmog's Armor":      { itemId: 'TFT_Item_WarmogsArmor',      type: 'defensive', recipe: ['Đai Khổng Lồ', 'Đai Khổng Lồ'] },
  'Giáp Máu Warmog':     { itemId: 'TFT_Item_WarmogsArmor',      type: 'defensive', recipe: ['Đai Khổng Lồ', 'Đai Khổng Lồ'] },
  'Giáp Warmog':          { itemId: 'TFT_Item_WarmogsArmor',      type: 'defensive', recipe: ['Đai Khổng Lồ', 'Đai Khổng Lồ'] },

  // Power Gauntlet
  'Power Gauntlet':      { itemId: 'TFT_Item_PowerGauntlet',     type: 'offensive', recipe: ['Đai Khổng Lồ', 'Găng Đấu Tập'] },
  'Chùy Đoản Côn':       { itemId: 'TFT_Item_PowerGauntlet',     type: 'offensive', recipe: ['Đai Khổng Lồ', 'Găng Đấu Tập'] },

  // Thief's Gloves
  "Thief's Gloves":      { itemId: 'TFT_Item_ThiefsGloves',      type: 'utility',   recipe: ['Găng Đấu Tập', 'Găng Đấu Tập'] },
  'Găng Đạo Tặc':        { itemId: 'TFT_Item_ThiefsGloves',      type: 'utility',   recipe: ['Găng Đấu Tập', 'Găng Đấu Tập'] },
  'Găng Đạo Chích':       { itemId: 'TFT_Item_ThiefsGloves',      type: 'utility',   recipe: ['Găng Đấu Tập', 'Găng Đấu Tập'] },

  // Edge of Night
  'Edge of Night':       { itemId: 'TFT_Item_Zephyr',            type: 'offensive', recipe: ['Kiếm B.F.', 'Áo Choàng Bạc'] },
  'Rìu Đêm':             { itemId: 'TFT_Item_Zephyr',            type: 'offensive', recipe: ['Kiếm B.F.', 'Áo Choàng Bạc'] },

  // Protector's Vow
  "Protector's Vow":     { itemId: 'TFT_Item_ZekesHerald',       type: 'defensive', recipe: ['Đai Khổng Lồ', 'Áo Choàng Bạc'] },
  'Lời Thề Hộ Pháp':     { itemId: 'TFT_Item_ZekesHerald',       type: 'defensive', recipe: ['Đai Khổng Lồ', 'Áo Choàng Bạc'] },
};

export function getItemImage(name) {
  const data = ITEM_DATA[name];
  if (!data) return null;
  return {
    imageUrl:  `${ITEM_BASE}/${data.itemId}.png`,
    type:      data.type,
    typeColor: ITEM_TYPE_COLORS[data.type] || '#9ca3af',
    typeLabel: ITEM_TYPE_LABELS[data.type] || '',
    recipe:    data.recipe,
  };
}

export function getAllItemNames() {
  return Object.keys(ITEM_DATA).sort((a, b) => b.length - a.length);
}

export function getItemRegex() {
  const names = getAllItemNames()
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .map(n => n.replace(/'/g, "['\\u2018\\u2019]"));
  return new RegExp(`(?<![\\w'\\u2018\\u2019])(${names.join('|')})(?![\\w'\\u2018\\u2019])`, 'g');
}

export default ITEM_DATA;
