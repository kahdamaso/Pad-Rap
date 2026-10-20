// A Vila: cenário em SVG (muda com a hora do dia) e as falas dos personagens.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RPGWorld = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Céu ----------

  function phase(hour) {
    if (hour >= 5 && hour < 7) return 'dawn';
    if (hour >= 7 && hour < 17) return 'day';
    if (hour >= 17 && hour < 19) return 'dusk';
    return 'night';
  }

  const SKY = {
    dawn: ['#f6a27f', '#ffe3b8'],
    day: ['#6fbff5', '#d9f1ff'],
    dusk: ['#5a4a9a', '#ff9d78'],
    night: ['#0c1230', '#2a2f5c'],
  };
  const SHADOW = { dawn: 0.12, day: 0, dusk: 0.25, night: 0.5 };

  function skyBody(hour, p) {
    const night = p === 'night';
    // Sol das 6h às 18h; lua no resto. Os dois fazem um arco no céu.
    const t = night ? ((hour + 6) % 24) / 12 : (hour - 6) / 12;
    const x = 30 + Math.max(0, Math.min(1, t)) * 340;
    const y = 110 - Math.sin(Math.PI * Math.max(0, Math.min(1, t))) * 85;
    if (night) {
      return `<circle cx="${x}" cy="${y}" r="14" fill="#f3efd8"/><circle cx="${x + 6}" cy="${y - 4}" r="12" fill="${SKY.night[0]}"/>`;
    }
    return `<circle cx="${x}" cy="${y}" r="24" fill="#ffe27a" opacity="0.35"/><circle cx="${x}" cy="${y}" r="15" fill="#ffd34d"/>`;
  }

  // ---------- Lugares ----------

  function label(x, y, text) {
    const w = text.length * 6.2 + 14;
    return `<g class="place-label"><rect x="${x - w / 2}" y="${y}" width="${w}" height="16" rx="8"/><text x="${x}" y="${y + 11.5}" text-anchor="middle">${esc(text)}</text></g>`;
  }

  function place(id, name, inner, labelPos) {
    return `<g class="place" data-action="place" data-id="${id}" tabindex="0" role="button" aria-label="${esc(name)}">${inner}${label(labelPos[0], labelPos[1], name)}</g>`;
  }

  function window_(x, y, lit) {
    return `<rect x="${x}" y="${y}" width="10" height="10" rx="2" fill="${lit ? '#ffd36b' : '#bfe3ff'}" stroke="#5a3a24" stroke-width="1.5"/>`;
  }

  function tree(x, y, s) {
    return `<rect x="${x - 2 * s}" y="${y}" width="${4 * s}" height="${12 * s}" fill="#6b4a2f"/><circle cx="${x}" cy="${y - 4 * s}" r="${11 * s}" fill="#3f9a4f"/><circle cx="${x - 6 * s}" cy="${y}" r="${7 * s}" fill="#4caf5a"/><circle cx="${x + 6 * s}" cy="${y - 1 * s}" r="${7 * s}" fill="#4caf5a"/>`;
  }

  // opts: { hour, hero (svg do avatar), boss {icon, pct, defeated}, chest, trial, board (missões novas) }
  function scene(opts) {
    const o = opts || {};
    const hour = o.hour == null ? new Date().getHours() : o.hour;
    const p = phase(hour);
    const lit = p === 'night' || p === 'dusk';
    const [top, bottom] = SKY[p];
    const stars = p === 'night'
      ? [[30, 30], [80, 18], [130, 40], [190, 22], [240, 36], [300, 16], [350, 44], [370, 20], [60, 60], [270, 58]]
          .map(([x, y], i) => `<circle class="star" style="animation-delay:${(i % 5) * 0.6}s" cx="${x}" cy="${y}" r="${i % 3 ? 1.2 : 1.8}" fill="#fff"/>`).join('')
      : '';
    const clouds = p === 'night' ? '' : `
      <g class="cloud" opacity="0.85" fill="#fff"><ellipse cx="80" cy="48" rx="22" ry="9"/><ellipse cx="96" cy="42" rx="14" ry="9"/></g>
      <g class="cloud slow" opacity="0.7" fill="#fff"><ellipse cx="300" cy="34" rx="26" ry="8"/><ellipse cx="282" cy="30" rx="12" ry="8"/></g>`;

    const boss = o.boss;
    const arenaTop = boss
      ? boss.defeated
        ? `<text x="327" y="112" font-size="26" text-anchor="middle">🏅</text>`
        : `<g class="boss-peek"><text x="327" y="114" font-size="32" text-anchor="middle">${boss.icon}</text></g>
           <rect x="305" y="118" width="44" height="5" rx="2.5" fill="#2a2236" opacity="0.6"/>
           <rect x="305" y="118" width="${44 * Math.max(0, Math.min(1, boss.pct))}" height="5" rx="2.5" fill="#e5484d"/>`
      : '';

    // O avatar entra como um SVG dentro do cenário, com posição e tamanho próprios.
    const hero = o.hero ? o.hero.replace('<svg class="avatar-svg" ', '<svg class="village-hero" x="184" y="136" width="64" height="80" ') : '';

    return `<svg class="village-svg" viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Vila">
      <defs><linearGradient id="vila-ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
      <rect width="400" height="250" fill="url(#vila-ceu)"/>
      ${stars}
      ${skyBody(hour, p)}
      ${clouds}
      <path d="M0 130 Q70 86 150 116 Q230 70 310 108 Q360 92 400 112 V250 H0 Z" fill="#7db86e"/>
      <path d="M0 160 Q90 128 200 150 Q300 130 400 150 V250 H0 Z" fill="#8fca72"/>
      <path d="M170 250 Q190 200 200 170 Q206 150 200 120" stroke="#e7d3a1" stroke-width="22" fill="none" stroke-linecap="round"/>
      ${tree(14, 150, 1)}${tree(390, 160, 1.1)}${tree(250, 128, 0.7)}

      ${place('temple', 'Templo', `
        ${o.trial ? '<circle class="glow" cx="200" cy="88" r="34" fill="#fff3b0" opacity="0.5"/>' : ''}
        <path d="M172 78 L200 60 L228 78 Z" fill="#efe8d8" stroke="#b9ad90" stroke-width="1.5"/>
        <rect x="174" y="78" width="52" height="5" fill="#e2d9c3"/>
        ${[178, 190, 202, 214].map((x) => `<rect x="${x}" y="83" width="6" height="24" fill="#f6f1e4" stroke="#c9bea4" stroke-width="1"/>`).join('')}
        <rect x="172" y="106" width="56" height="5" fill="#e2d9c3"/>`, [200, 112])}

      ${place('home', 'Sua casa', `
        <rect x="96" y="80" width="40" height="28" fill="#e9d6b8" stroke="#8a6a48" stroke-width="1.5"/>
        <path d="M90 82 L116 62 L142 82 Z" fill="#5b7fc2"/>
        <rect x="111" y="92" width="10" height="16" fill="#7d5737"/>
        ${window_(99, 87, lit)}${window_(124, 87, lit)}`, [116, 110])}

      ${place('shop', 'Taverna', `
        <rect x="18" y="146" width="92" height="56" fill="#c98f5b" stroke="#7d5737" stroke-width="2"/>
        <path d="M10 150 L64 118 L118 150 Z" fill="#a3423c"/>
        <rect x="56" y="172" width="16" height="30" rx="2" fill="#6b4a2f"/>
        ${window_(28, 162, lit)}${window_(88, 162, lit)}
        <rect x="34" y="128" width="60" height="14" rx="3" fill="#6b4a2f"/>
        <text x="64" y="138.5" font-size="9" text-anchor="middle" fill="#ffe7a8" font-family="Georgia, serif" font-weight="bold">TAVERNA</text>`, [64, 206])}

      ${place('board', 'Mural', `
        <rect x="136" y="170" width="4" height="34" fill="#6b4a2f"/><rect x="164" y="170" width="4" height="34" fill="#6b4a2f"/>
        <rect x="130" y="160" width="44" height="28" rx="3" fill="#a87a4c" stroke="#6b4a2f" stroke-width="2"/>
        <rect x="135" y="164" width="12" height="14" fill="#fff8e6" transform="rotate(-6 141 171)"/>
        <rect x="150" y="165" width="12" height="10" fill="#fff8e6"/>
        <rect x="160" y="170" width="10" height="13" fill="#fff8e6" transform="rotate(5 165 176)"/>
        ${o.board ? `<circle cx="172" cy="160" r="8" fill="#e5484d"/><text x="172" y="163.5" font-size="9" text-anchor="middle" fill="#fff" font-weight="bold">${o.board > 9 ? '9+' : o.board}</text>` : ''}`, [152, 206])}

      ${place('arena', 'Arena', `
        <ellipse cx="327" cy="200" rx="56" ry="10" fill="#9a8d7a"/>
        <path d="M273 200 V150 Q327 132 381 150 V200 Z" fill="#cbbfa8" stroke="#8f826d" stroke-width="2"/>
        ${[285, 305, 327, 349, 369].map((x) => `<path d="M${x - 7} 200 V178 Q${x} 168 ${x + 7} 178 V200 Z" fill="#6b5f4e"/>`).join('')}
        ${[285, 305, 327, 349, 369].map((x) => `<path d="M${x - 5} 160 Q${x} 154 ${x + 5} 160 V168 H${x - 5} Z" fill="#8f826d"/>`).join('')}
        ${arenaTop}`, [327, 206])}

      <rect width="400" height="250" fill="#0b1030" opacity="${SHADOW[p]}" pointer-events="none"/>
      ${lit ? '<g pointer-events="none"><circle cx="33" cy="167" r="10" fill="#ffd36b" opacity="0.25"/><circle cx="93" cy="167" r="10" fill="#ffd36b" opacity="0.25"/></g>' : ''}

      ${hero ? `<g class="hero-in-village" pointer-events="none">${hero}</g>` : ''}
      ${o.chest ? `<g class="place chest-place" data-action="chest" tabindex="0" role="button" aria-label="Abrir o baú do dia"><text class="wiggle-svg" x="258" y="214" font-size="24" text-anchor="middle">🎁</text></g>` : ''}
    </svg>`;
  }

  // ---------- Personagens ----------

  const NPCS = {
    bia: { name: 'Bia', role: 'Taverneira', look: { skin: 2, hair: 'coque', hairColor: 'ruivo', extra: 'sardas', color: 'vermelho' }, gear: {} },
    orion: { name: 'Mestre Orion', role: 'Guilda dos Aventureiros', look: { skin: 4, hair: 'careca', hairColor: 'grisalho', extra: 'barba', color: 'azul' }, gear: { helmet: 'chapeu', amulet: 'olho' } },
    celeste: { name: 'Celeste', role: 'Sacerdotisa do Templo', look: { skin: 0, hair: 'longo', hairColor: 'loiro', extra: 'nenhum', color: 'dourado' }, gear: { amulet: 'joia' } },
    tobias: { name: 'Tobias', role: 'Guarda da Vila', look: { skin: 3, hair: 'curto', hairColor: 'preto', extra: 'nenhum', color: 'vermelho' }, gear: { helmet: 'elmo', shield: 'aco' } },
  };

  // Falas de ambiente: mudam a cada dia para a Vila não ficar repetitiva.
  const FLAVOR = {
    bia: [
      'Dizem que quem bebe água logo cedo ganha coragem em dobro. Eu acredito!',
      'Hoje o pão saiu quentinho. Que nem a sua sequência!',
      'Um viajante perguntou por você na taverna. A fama corre, hein?',
      'Descansar também é treino. Herói cansado erra o golpe.',
      'Guardo a melhor mesa para quem cumpre as diárias. Quer sentar?',
    ],
    orion: [
      'Grandes heróis não nascem prontos: sobem um degrau por dia.',
      'O segredo não é a força do golpe, é bater todo dia.',
      'Comece pequeno. Uma missão feita vale mais que dez planejadas.',
      'Quando uma missão ficar fácil, procure a próxima no Mural.',
    ],
    celeste: [
      'Constância é a magia mais antiga que existe.',
      'Um dia ruim não apaga a jornada. Respire e siga.',
      'Cada virtude começou como uma fraqueza enfrentada.',
    ],
    tobias: [
      'Fiquei de vigia a noite toda. Nenhum monstro passou… ainda.',
      'Os monstros odeiam quem tem rotina. Continue assim!',
      'Se precisar de reforço, a Arena está sempre aberta.',
    ],
  };

  function greeting(hour) {
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function pickFlavor(npc, today) {
    const list = FLAVOR[npc];
    let n = 0;
    for (const ch of today + npc) n = (n * 31 + ch.charCodeAt(0)) % 9973;
    return list[n % list.length];
  }

  // Lista de falas em ordem de importância; a interface mostra uma por vez.
  function npcLines(state, G, today, hour) {
    const lines = [];
    const name = state.hero.name;
    const hi = `${greeting(hour)}, ${name}!`;
    const max = G.maxHp(G.heroLevel(state));
    const dailies = state.quests.filter((q) => q.type === 'daily' && G.isScheduled(q, today));
    const pending = dailies.filter((q) => !G.isDoneOn(q, today)).length;
    const boss = state.boss;
    const trial = state.hero.trial;
    const challenge = state.challenge && state.challenge.key === today && !state.challenge.done && G.catalogEntry(state.challenge.id);

    if (G.chestAvailable(state, today)) {
      lines.push({ npc: 'bia', text: `${hi} Guardei um baú para você aqui na taverna. Vem abrir!`, action: 'chest', actionLabel: 'Abrir o baú' });
    }
    if (state.hero.hp / max <= 0.3) {
      lines.push({ npc: 'bia', text: 'Você está abatido… Uma Poção de Vida custa só 25 de ouro. E uma boa noite de sono ajuda também.', action: 'place', id: 'shop', actionLabel: 'Ir à taverna' });
    }
    if (trial) {
      const left = trial.need - trial.days.length;
      lines.push({ npc: 'celeste', text: `Sua Provação para o nível ${trial.level} continua. ${left === 1 ? 'Falta só 1 dia perfeito' : `Faltam ${left} dias perfeitos`}: cumpra todas as diárias do dia.`, action: 'tab', id: 'quests', actionLabel: 'Ver diárias' });
    }
    if (challenge) {
      lines.push({ npc: 'orion', text: `Tenho um desafio especial para hoje: "${challenge.title}". Vale o dobro, mas some à meia-noite!`, action: 'tab', id: 'quests', actionLabel: 'Ver desafio' });
    }
    if (boss && !boss.defeated && pending) {
      lines.push({ npc: 'tobias', text: `${boss.name} está rondando a Arena (${boss.hp} de vida). Faltam ${pending} ${pending === 1 ? 'diária' : 'diárias'} hoje: cada uma é um golpe nele!`, action: 'tab', id: 'quests', actionLabel: 'Ir às missões' });
    } else if (pending) {
      lines.push({ npc: 'tobias', text: `Faltam ${pending} ${pending === 1 ? 'diária' : 'diárias'} hoje. Bora?`, action: 'tab', id: 'quests', actionLabel: 'Ir às missões' });
    }
    if (dailies.length && !pending) {
      lines.push({ npc: 'bia', text: 'Todas as diárias de hoje feitas! A taverna inteira está falando de você.' });
    }
    if (boss && boss.defeated) {
      lines.push({ npc: 'tobias', text: `A Vila está em paz desde que você derrotou ${boss.name}. Segunda-feira chega outro, fique esperto.` });
    }
    if (!state.quests.length) {
      lines.push({ npc: 'orion', text: 'Toda jornada começa com uma missão. Passe no Mural e escolha a sua primeira!', action: 'place', id: 'board', actionLabel: 'Abrir o Mural' });
    }
    ['bia', 'orion', 'celeste', 'tobias'].forEach((npc) => lines.push({ npc, text: pickFlavor(npc, today) }));
    return lines;
  }

  return { phase, scene, npcLines, NPCS, greeting };
});
