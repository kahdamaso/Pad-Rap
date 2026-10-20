// Avatar desenhado em SVG, em camadas: corpo, rosto, cabelo, roupa e equipamento.
// Fica igual em qualquer aparelho (emojis mudam de Android para iPhone).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RPGAvatar = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SKINS = [
    { id: 0, name: 'Clara', hex: '#f8dcc8' },
    { id: 1, name: 'Média-clara', hex: '#ecbf96' },
    { id: 2, name: 'Média', hex: '#cf9468' },
    { id: 3, name: 'Morena', hex: '#a86c43' },
    { id: 4, name: 'Escura', hex: '#7a4b2e' },
    { id: 5, name: 'Retinta', hex: '#4f3121' },
    { id: 6, name: 'Élfica verde', hex: '#a6d8a8' },
    { id: 7, name: 'Feérica azul', hex: '#aac6f2' },
  ];

  const HAIR_STYLES = {
    curto: 'Curto',
    longo: 'Longo',
    cacheado: 'Cacheado',
    coque: 'Coque',
    moicano: 'Moicano',
    careca: 'Careca',
  };

  const HAIR_COLORS = {
    preto: { name: 'Preto', hex: '#2b2220' },
    castanho: { name: 'Castanho', hex: '#5e3b27' },
    ruivo: { name: 'Ruivo', hex: '#b8562b' },
    loiro: { name: 'Loiro', hex: '#e2c16e' },
    grisalho: { name: 'Grisalho', hex: '#c4c4c8' },
    rosa: { name: 'Rosa', hex: '#e981b8' },
    azul: { name: 'Azul', hex: '#5a8cff' },
  };

  const EXTRAS = {
    nenhum: 'Nenhum',
    orelhas: 'Orelhas élficas',
    barba: 'Barba',
    oculos: 'Óculos',
    sardas: 'Sardas',
  };

  const OUTFITS = {
    roxo: { name: 'Roxo', hex: '#8a6cf0' },
    azul: { name: 'Azul', hex: '#3f8cf0' },
    verde: { name: 'Verde', hex: '#36ad72' },
    dourado: { name: 'Dourado', hex: '#d39b2c' },
    vermelho: { name: 'Vermelho', hex: '#d9434b' },
    rosa: { name: 'Rosa', hex: '#de63a8' },
  };

  const CLASS_EMBLEM = { guerreiro: '⚔', mago: '✦', monge: '☯', bardo: '♪', druida: '❦' };

  const DEFAULT_LOOK = { skin: 1, hair: 'curto', hairColor: 'castanho', extra: 'nenhum', color: 'roxo' };

  // Converte a aparência antiga (baseada em emoji) para a nova.
  const LEGACY_CHARS = {
    maga: ['longo', 'nenhum'], mago: ['curto', 'barba'], elfa: ['longo', 'orelhas'], elfo: ['curto', 'orelhas'],
    heroina: ['coque', 'nenhum'], heroi: ['curto', 'nenhum'], ninja: ['moicano', 'nenhum'], fada: ['coque', 'sardas'],
    sereia: ['longo', 'sardas'], tritao: ['cacheado', 'nenhum'], vampira: ['longo', 'nenhum'], vampiro: ['curto', 'nenhum'],
    princesa: ['longo', 'nenhum'], principe: ['curto', 'nenhum'], pessoa: ['curto', 'nenhum'], barbudo: ['curto', 'barba'],
  };
  const LEGACY_TONES = { '': 1, '🏻': 0, '🏼': 1, '🏽': 2, '🏾': 3, '🏿': 4 };

  function normalizeLook(look) {
    if (!look) return { ...DEFAULT_LOOK };
    if (look.char) {
      const [hair, extra] = LEGACY_CHARS[look.char] || ['curto', 'nenhum'];
      return { skin: LEGACY_TONES[look.tone] != null ? LEGACY_TONES[look.tone] : 1, hair, hairColor: 'castanho', extra, color: OUTFITS[look.color] ? look.color : 'roxo' };
    }
    return {
      skin: SKINS[look.skin] ? look.skin : DEFAULT_LOOK.skin,
      hair: HAIR_STYLES[look.hair] ? look.hair : DEFAULT_LOOK.hair,
      hairColor: HAIR_COLORS[look.hairColor] ? look.hairColor : DEFAULT_LOOK.hairColor,
      extra: EXTRAS[look.extra] ? look.extra : DEFAULT_LOOK.extra,
      color: OUTFITS[look.color] ? look.color : DEFAULT_LOOK.color,
    };
  }

  // Escurece uma cor #rrggbb (para sombras e contornos).
  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const f = 1 - amount;
    const r = Math.round(((n >> 16) & 255) * f);
    const g = Math.round(((n >> 8) & 255) * f);
    const b = Math.round((n & 255) * f);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }

  // ---------- Cabelo ----------

  function hairBack(style, c) {
    if (style === 'longo') return `<path d="M30 52 Q28 96 40 104 L80 104 Q92 96 90 52 Z" fill="${c}"/>`;
    if (style === 'cacheado') {
      return [[32, 62], [88, 62], [30, 76], [90, 76], [36, 88], [84, 88]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${c}"/>`).join('');
    }
    return '';
  }

  function hairFront(style, c) {
    const top = `M31 52 Q30 22 60 21 Q90 22 89 52 Q84 38 72 35 Q64 42 50 38 Q38 40 31 52 Z`;
    switch (style) {
      case 'curto':
        return `<path d="${top}" fill="${c}"/>`;
      case 'longo':
        return `<path d="M30 56 Q28 20 60 20 Q92 20 90 56 Q86 40 76 34 Q70 44 56 40 Q46 46 38 44 Q32 48 30 56 Z" fill="${c}"/>`;
      case 'cacheado':
        return [[38, 34], [50, 26], [62, 23], [74, 27], [84, 36], [33, 46], [87, 47], [45, 36], [70, 34]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${c}"/>`).join('');
      case 'coque':
        return `<circle cx="60" cy="18" r="10" fill="${c}"/><path d="${top}" fill="${c}"/>`;
      case 'moicano':
        return `<path d="M52 40 Q50 12 60 8 Q70 12 68 40 Q60 34 52 40 Z" fill="${c}"/>`;
      default:
        return `<ellipse cx="50" cy="32" rx="7" ry="3" fill="#fff" opacity="0.25"/>`;
    }
  }

  // ---------- Equipamento ----------

  const HELMETS = {
    bone: () => `<path d="M33 40 Q34 20 60 20 Q86 20 87 40 Z" fill="#d9534f"/><path d="M60 40 Q80 37 98 42 Q84 46 60 44 Z" fill="#b8423f"/><circle cx="60" cy="21" r="2.5" fill="#b8423f"/>`,
    chapeu: () => `<ellipse cx="60" cy="34" rx="40" ry="7" fill="#6b4a2f"/><path d="M40 34 Q42 10 60 10 Q78 10 80 34 Z" fill="#7d5737"/><rect x="40.5" y="27" width="39" height="5" fill="#3d2a1b"/><path d="M76 26 l10 -10 l2 6 z" fill="#e2c16e"/>`,
    elmo: () => `<path d="M30 48 Q30 16 60 16 Q90 16 90 48 L84 48 Q80 30 60 30 Q40 30 36 48 Z" fill="#a8b1bf"/><path d="M30 48 Q30 16 60 16 Q90 16 90 48" fill="none" stroke="#7c8594" stroke-width="2"/><rect x="57" y="28" width="6" height="20" rx="2" fill="#8c95a3"/><circle cx="60" cy="18" r="3" fill="#d9434b"/>`,
    coroa: () => `<path d="M38 34 L40 14 L50 24 L60 10 L70 24 L80 14 L82 34 Z" fill="#f2c14e" stroke="#c9962a" stroke-width="1.5"/><circle cx="60" cy="27" r="3" fill="#d9434b"/><circle cx="47" cy="29" r="2" fill="#3f8cf0"/><circle cx="73" cy="29" r="2" fill="#36ad72"/>`,
  };

  const WEAPONS = {
    graveto: () => `<path d="M86 124 L96 78" stroke="#7a5230" stroke-width="5" stroke-linecap="round"/><path d="M92 96 L101 90" stroke="#7a5230" stroke-width="3" stroke-linecap="round"/><circle cx="101" cy="89" r="3" fill="#5fae5f"/>`,
    adaga: () => `<path d="M88 112 L94 82 L98 84 L92 113 Z" fill="#d8dde6" stroke="#9aa3b2"/><rect x="83" y="110" width="14" height="4" rx="2" fill="#c9962a" transform="rotate(12 90 112)"/><rect x="85" y="114" width="5" height="9" rx="2" fill="#6b4a2f" transform="rotate(12 87 118)"/>`,
    arco: () => `<path d="M96 70 Q112 106 94 140" fill="none" stroke="#8a5a2f" stroke-width="4" stroke-linecap="round"/><path d="M96 70 L94 140" stroke="#e8e2d0" stroke-width="1.2"/>`,
    espada: () => `<path d="M90 110 L104 52 L108 50 L109 55 L95 112 Z" fill="#e3e7ee" stroke="#9aa3b2"/><path d="M104 56 L100 106" stroke="#bfc6d2" stroke-width="1"/><rect x="82" y="108" width="20" height="5" rx="2" fill="#c9962a" transform="rotate(14 92 110)"/><rect x="85" y="113" width="6" height="12" rx="2" fill="#5a3a24" transform="rotate(14 88 119)"/><circle cx="86" cy="127" r="3.5" fill="#c9962a"/>`,
    tridente: () => `<path d="M88 140 L102 48" stroke="#d6a43a" stroke-width="4" stroke-linecap="round"/><path d="M93 56 Q96 44 103 40 M102 48 L104 32 M111 58 Q110 46 105 40" fill="none" stroke="#d6a43a" stroke-width="3.5" stroke-linecap="round"/><circle cx="101" cy="62" r="3" fill="#4cc3d9"/>`,
  };

  const SHIELDS = {
    panela: () => `<circle cx="27" cy="110" r="13" fill="#9ea6b3" stroke="#6f7784" stroke-width="2"/><ellipse cx="24" cy="106" rx="5" ry="3" fill="#fff" opacity="0.4"/><rect x="24" y="94" width="6" height="5" rx="2" fill="#3a3a3a"/>`,
    carvalho: () => `<circle cx="27" cy="110" r="15" fill="#9a6a3c" stroke="#6b4a2f" stroke-width="3"/><path d="M17 104 H37 M15 112 H39 M18 119 H36" stroke="#7d5737" stroke-width="1.5"/><circle cx="27" cy="110" r="3.5" fill="#c9c9c9"/>`,
    aco: () => `<path d="M14 96 H40 V112 Q40 126 27 132 Q14 126 14 112 Z" fill="#c3cad6" stroke="#7c8594" stroke-width="2"/><path d="M27 100 V126 M18 110 H36" stroke="#3f8cf0" stroke-width="3"/>`,
    casco: () => `<ellipse cx="27" cy="111" rx="16" ry="18" fill="#4f9a55" stroke="#2f6b37" stroke-width="2"/><path d="M27 97 L35 104 L35 116 L27 123 L19 116 L19 104 Z" fill="#6fbf6a" stroke="#2f6b37" stroke-width="1.5"/>`,
  };

  const AMULETS = {
    contas: () => `<path d="M48 84 Q60 98 72 84" fill="none" stroke="#6b4a2f" stroke-width="1"/>${[[50, 88], [55, 92], [60, 94], [65, 92], [70, 88]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${['#e2c16e', '#d9434b', '#36ad72', '#3f8cf0', '#e2c16e'][i]}"/>`).join('')}`,
    anel: () => `<path d="M50 84 Q60 94 70 84" fill="none" stroke="#c4c9d2" stroke-width="1.2"/><circle cx="60" cy="96" r="4" fill="none" stroke="#dfe3ea" stroke-width="2.5"/>`,
    olho: () => `<path d="M50 84 Q60 94 70 84" fill="none" stroke="#c9962a" stroke-width="1.2"/><circle cx="60" cy="97" r="5" fill="#2f6fd6"/><circle cx="60" cy="97" r="3" fill="#fff"/><circle cx="60" cy="97" r="1.5" fill="#1b2a4a"/>`,
    joia: () => `<path d="M50 84 Q60 94 70 84" fill="none" stroke="#c9962a" stroke-width="1.2"/><path d="M60 91 L66 97 L60 105 L54 97 Z" fill="#7fe3f5" stroke="#3aa7c4"/><path d="M56 97 H64" stroke="#fff" stroke-width="0.8" opacity="0.8"/>`,
  };

  const PET_EMOJI = { rato: '🐀', gato: '🐈', coruja: '🦉', lobo: '🐺', dragao: '🐉' };

  // ---------- Desenho ----------

  // gear: { weapon, shield, helmet, amulet, pet } com ids de equipamento (ou null).
  // opts.crop: 'head' recorta só a cabeça (para os botões de escolha).
  function render(lookIn, gear, opts) {
    const o = opts || {};
    const look = normalizeLook(lookIn);
    const g = gear || {};
    const skin = SKINS[look.skin].hex;
    const skinDark = shade(skin, 0.18);
    const hair = HAIR_COLORS[look.hairColor].hex;
    const outfit = OUTFITS[look.color].hex;
    const outfitDark = shade(outfit, 0.25);
    const helmet = HELMETS[g.helmet];
    const viewBox = o.crop === 'head' ? '22 6 76 76' : '0 0 120 150';
    const label = o.label ? `<title>${o.label}</title>` : '';

    const ears = look.extra === 'orelhas'
      ? `<path d="M33 52 L16 38 L33 62 Z" fill="${skin}" stroke="${skinDark}" stroke-width="1"/><path d="M87 52 L104 38 L87 62 Z" fill="${skin}" stroke="${skinDark}" stroke-width="1"/>`
      : `<circle cx="32" cy="56" r="5" fill="${skin}"/><circle cx="88" cy="56" r="5" fill="${skin}"/>`;

    const face = `
      <path d="M44 48 Q49 45 53 48" stroke="${shade(hair, 0.1)}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M67 48 Q71 45 76 48" stroke="${shade(hair, 0.1)}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="49" cy="56" rx="3.6" ry="4.4" fill="#2a2236"/><circle cx="50.3" cy="54.4" r="1.3" fill="#fff"/>
      <ellipse cx="71" cy="56" rx="3.6" ry="4.4" fill="#2a2236"/><circle cx="72.3" cy="54.4" r="1.3" fill="#fff"/>
      <circle cx="43" cy="64" r="4" fill="#ff7a9a" opacity="0.28"/><circle cx="77" cy="64" r="4" fill="#ff7a9a" opacity="0.28"/>
      <path d="M54 66 Q60 71 66 66" stroke="#7a3b3b" stroke-width="2" fill="none" stroke-linecap="round"/>
      ${look.extra === 'sardas' ? [[42, 60], [45, 63], [40, 64], [78, 60], [75, 63], [80, 64]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.9" fill="${shade(skin, 0.35)}"/>`).join('') : ''}
      ${look.extra === 'oculos' ? `<circle cx="49" cy="56" r="7" fill="none" stroke="#2a2236" stroke-width="1.8"/><circle cx="71" cy="56" r="7" fill="none" stroke="#2a2236" stroke-width="1.8"/><path d="M56 56 H64" stroke="#2a2236" stroke-width="1.8"/>` : ''}
      ${look.extra === 'barba' ? `<path d="M36 60 Q38 84 60 86 Q82 84 84 60 Q78 72 70 72 Q60 76 50 72 Q42 72 36 60 Z" fill="${hair}"/><path d="M54 68 Q60 72 66 68" stroke="#7a3b3b" stroke-width="2" fill="none" stroke-linecap="round"/>` : ''}
    `;

    const legendary = Object.values(g).some((id) => ['tridente', 'casco', 'coroa', 'joia', 'dragao'].includes(id));
    const sparkles = legendary
      ? `<g class="av-sparkle" fill="#ffd977">${[[12, 30], [108, 24], [104, 96]].map(([x, y]) => `<path d="M${x} ${y - 5} L${x + 1.5} ${y - 1.5} L${x + 5} ${y} L${x + 1.5} ${y + 1.5} L${x} ${y + 5} L${x - 1.5} ${y + 1.5} L${x - 5} ${y} L${x - 1.5} ${y - 1.5} Z"/>`).join('')}</g>`
      : '';

    const body = o.crop === 'head' ? '' : `
      <ellipse cx="60" cy="144" rx="32" ry="5" fill="#000" opacity="0.18"/>
      ${WEAPONS[g.weapon] ? WEAPONS[g.weapon]() : ''}
      <rect x="47" y="114" width="11" height="24" rx="4" fill="#3b3350"/>
      <rect x="62" y="114" width="11" height="24" rx="4" fill="#3b3350"/>
      <ellipse cx="52" cy="139" rx="8" ry="4" fill="#2a2236"/><ellipse cx="68" cy="139" rx="8" ry="4" fill="#2a2236"/>
      <path d="M41 88 Q60 80 79 88 L82 118 Q60 124 38 118 Z" fill="${outfit}"/>
      <path d="M39 108 Q60 113 81 108 L82 113 Q60 118 38 113 Z" fill="${outfitDark}"/>
      <path d="M42 88 Q34 100 33 114" stroke="${outfit}" stroke-width="9" stroke-linecap="round" fill="none"/>
      <path d="M78 88 Q86 100 87 114" stroke="${outfit}" stroke-width="9" stroke-linecap="round" fill="none"/>
      <circle cx="33" cy="116" r="5" fill="${skin}"/><circle cx="87" cy="116" r="5" fill="${skin}"/>
      <circle cx="60" cy="111" r="6" fill="#e2c16e" stroke="${outfitDark}" stroke-width="1.5"/>
      <text x="60" y="114.2" font-size="8" text-anchor="middle" fill="#5a3a24" font-family="serif">${CLASS_EMBLEM[o.cls] || ''}</text>
      ${SHIELDS[g.shield] ? SHIELDS[g.shield]() : ''}
      ${AMULETS[g.amulet] ? AMULETS[g.amulet]() : ''}
      ${PET_EMOJI[g.pet] ? `<text x="104" y="146" font-size="20" text-anchor="middle">${PET_EMOJI[g.pet]}</text>` : ''}
    `;

    return `<svg class="avatar-svg" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="${o.label ? 'false' : 'true'}">${label}
      ${hairBack(look.hair, hair)}
      ${body}
      <rect x="53" y="76" width="14" height="12" rx="4" fill="${skinDark}"/>
      ${ears}
      <circle cx="60" cy="54" r="28" fill="${skin}"/>
      ${face}
      ${helmet && g.helmet !== 'bone' && g.helmet !== 'coroa' ? '' : hairFront(look.hair, hair)}
      ${helmet ? helmet() : ''}
      ${sparkles}
    </svg>`;
  }

  return { SKINS, HAIR_STYLES, HAIR_COLORS, EXTRAS, OUTFITS, DEFAULT_LOOK, normalizeLook, render, shade };
});
