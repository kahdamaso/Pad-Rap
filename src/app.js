// Interface: renderiza o estado e liga os botões às regras de game.js.
(function () {
  'use strict';

  const G = window.RoutineRPG;
  const C = window.RPGCharts;
  const STORAGE_KEY = 'rotina-rpg:v1';
  const TAB_KEY = 'rotina-rpg:tab';
  const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const TABS = [
    { id: 'quests', icon: '📜', name: 'Missões' },
    { id: 'gear', icon: '🎒', name: 'Equipamento' },
    { id: 'shop', icon: '🛒', name: 'Loja' },
    { id: 'stats', icon: '📈', name: 'Evolução' },
    { id: 'achievements', icon: '🏆', name: 'Conquistas' },
    { id: 'log', icon: '📖', name: 'Diário' },
    { id: 'hero', icon: '⚙️', name: 'Herói' },
  ];
  // Posição de cada equipamento em volta do avatar.
  const AVATAR_SLOTS = { helmet: 'top', amulet: 'top-right', weapon: 'right', shield: 'left', pet: 'bottom-left' };

  const app = document.getElementById('app');
  const modal = document.getElementById('modal');
  const toasts = document.getElementById('toasts');
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  document.body.appendChild(tip);

  let state = load();
  let tab = readTab();
  let installPrompt = null;

  // ---------- Persistência ----------

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = G.migrate(JSON.parse(raw));
      return G.validate(data) ? data : null;
    } catch (e) {
      return null;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      toast('⚠️', 'Não foi possível salvar no navegador.');
    }
  }

  function readTab() {
    try {
      const t = localStorage.getItem(TAB_KEY);
      return TABS.some((x) => x.id === t) ? t : 'quests';
    } catch (e) {
      return 'quests';
    }
  }

  function setTab(t) {
    tab = t;
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch (e) {
      /* preferência opcional */
    }
    render();
  }

  // ---------- Utilidades ----------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function pct(a, b) {
    return b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0;
  }

  function shortDate(key) {
    return key.split('-').reverse().slice(0, 2).join('/');
  }

  function toast(icon, text, kind) {
    const el = document.createElement('div');
    el.className = `toast ${kind || ''}`;
    el.innerHTML = `<span class="toast-icon">${icon}</span><span>${esc(text)}</span>`;
    toasts.appendChild(el);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3700);
  }

  function announce(result) {
    if (!result) return;
    if (result.type === 'damage') {
      if (result.defeated) toast('💀', `Derrotado! Perdeu o progresso do nível e ${result.lostGold} de ouro.`, 'bad');
      else toast('🩸', `−${result.damage} de vida`, 'bad');
      if (result.bossHealed) toast(state.boss.icon, `${state.boss.name} recuperou ${result.bossHealed} de vida!`, 'bad');
    } else if (result.type === 'reward') {
      toast('✨', `+${result.xp} XP  ·  +${result.gold} ouro`);
      if (result.boss && !result.boss.defeated) toast(state.boss.icon, `−${result.boss.damage} no ${state.boss.name}`);
      if (result.attrUp) {
        const a = G.ATTRIBUTES[result.attrUp.attr];
        toast(a.icon, `${a.name} subiu para o nível ${result.attrUp.level}!`, 'good');
      }
      if (result.boss && result.boss.defeated) bossDefeatedModal(result.boss, result.levelUp, result.newItems);
      else if (result.levelUp) levelUpModal(result.levelUp, result.newItems);
    }
    (result.achievements || []).forEach((a) => toast('🏆', `Conquista: ${a.name}`, 'gold'));
  }

  function act(fn) {
    const result = fn();
    G.recordDay(state, G.todayKey());
    save();
    render();
    return result;
  }

  // Mantém o dia em dia mesmo com a aba aberta durante a meia-noite.
  function checkDay() {
    if (!state) return;
    const before = state.lastProcessed;
    const summary = G.processRollover(state, G.todayKey());
    save();
    if (state.lastProcessed !== before || summary.boss.spawned) {
      render();
      if (summary.missed.length || summary.healed || summary.boss.escaped || (summary.boss.spawned && summary.days)) rolloverModal(summary);
    }
  }

  // ---------- Render ----------

  function render() {
    hideTip();
    if (!state) {
      app.innerHTML = creationView();
      return;
    }
    const views = { quests: questsView, gear: gearView, shop: shopView, stats: statsView, achievements: achievementsView, log: logView, hero: heroView };
    app.innerHTML = `
      ${heroCard()}
      <nav class="tabs" role="tablist">
        ${TABS.map((t) => `<button role="tab" class="tab ${t.id === tab ? 'active' : ''}" aria-selected="${t.id === tab}" data-action="tab" data-id="${t.id}" title="${t.name}"><span>${t.icon}</span><span class="tab-label">${t.name}</span></button>`).join('')}
      </nav>
      <section class="panel">${views[tab]()}</section>
    `;
    if (tab === 'stats') drawCharts();
  }

  function creationView() {
    return `
      <section class="creation">
        <h1 class="logo">Rotina RPG</h1>
        <p class="lead">Sua rotina é a aventura. Cada hábito vira missão, cada dia vira XP.</p>
        <form id="create-form" class="card">
          <label class="field">
            <span>Nome do herói</span>
            <input name="name" maxlength="24" required placeholder="Ex.: Aria" autocomplete="off">
          </label>
          <fieldset class="field">
            <legend>Escolha sua classe <small>(+20% XP no atributo da classe)</small></legend>
            <div class="class-grid">
              ${Object.entries(G.CLASSES).map(([id, c], i) => `
                <label class="class-option">
                  <input type="radio" name="cls" value="${id}" ${i === 0 ? 'checked' : ''}>
                  <span class="class-card">
                    <span class="class-icon">${c.icon}</span>
                    <strong>${c.name}</strong>
                    <small>${G.ATTRIBUTES[c.attr].icon} ${G.ATTRIBUTES[c.attr].name}</small>
                  </span>
                </label>`).join('')}
            </div>
          </fieldset>
          <label class="check">
            <input type="checkbox" name="starter" checked>
            <span>Começar com algumas missões de exemplo</span>
          </label>
          <button class="btn primary big" type="submit">Iniciar jornada</button>
        </form>
        <p class="muted small">Seus dados ficam salvos apenas neste navegador.</p>
      </section>
    `;
  }

  function avatar(size) {
    const cls = G.CLASSES[state.hero.cls];
    const badges = Object.entries(AVATAR_SLOTS)
      .map(([slot, pos]) => {
        const item = G.equippedItem(state, slot);
        return item ? `<span class="avatar-item pos-${pos} tier-${item.tier}" title="${esc(item.name)}">${item.icon}</span>` : '';
      })
      .join('');
    return `<div class="avatar ${size || ''}" aria-hidden="true"><span class="avatar-class">${cls.icon}</span>${badges}</div>`;
  }

  function heroCard() {
    const h = state.hero;
    const cls = G.CLASSES[h.cls];
    const prog = G.levelProgress(h.xp);
    const max = G.maxHp(prog.level);
    const lowHp = h.hp / max <= 0.3;
    return `
      <header class="hero card">
        ${avatar()}
        <div class="hero-info">
          <div class="hero-top">
            <h1>${esc(h.name)}</h1>
            <span class="badge">Nv. ${prog.level} · ${cls.name}</span>
            <span class="gold" title="Ouro">🪙 ${h.gold}</span>
          </div>
          <div class="bar-row">
            <span class="bar-label">❤️</span>
            <div class="bar hp ${lowHp ? 'low' : ''}" role="progressbar" aria-label="Vida" aria-valuenow="${h.hp}" aria-valuemax="${max}"><div style="width:${pct(h.hp, max)}%"></div></div>
            <span class="bar-value">${h.hp}/${max}</span>
          </div>
          <div class="bar-row">
            <span class="bar-label">⭐</span>
            <div class="bar xp" role="progressbar" aria-label="Experiência" aria-valuenow="${prog.current}" aria-valuemax="${prog.needed}"><div style="width:${pct(prog.current, prog.needed)}%"></div></div>
            <span class="bar-value">${prog.current}/${prog.needed}</span>
          </div>
        </div>
        <div class="attrs">
          ${Object.entries(G.ATTRIBUTES).map(([id, a]) => {
            const p = G.levelProgress(h.attrs[id], G.ATTR_BASE);
            return `<div class="attr ${cls.attr === id ? 'class-attr' : ''}" title="${a.name}: ${a.hint}">
              <span class="attr-icon">${a.icon}</span>
              <span class="attr-name">${a.name}</span>
              <span class="attr-level">${p.level}</span>
              <div class="bar mini"><div style="width:${pct(p.current, p.needed)}%"></div></div>
            </div>`;
          }).join('')}
        </div>
      </header>
    `;
  }

  function bossCard(today) {
    const b = state.boss;
    if (!b) return '';
    const end = G.addDays(b.week, 6);
    const daysLeft = Math.round((new Date(`${end}T12:00`) - new Date(`${today}T12:00`)) / 864e5) + 1;
    const bonus = Math.round(G.bonuses(state).bossDmg * 100);
    const reward = G.bossReward(state);
    return `
      <div class="boss card ${b.defeated ? 'defeated' : ''}">
        <div class="boss-icon" aria-hidden="true">${b.defeated ? '🏅' : b.icon}</div>
        <div class="boss-body">
          <div class="boss-top">
            <span class="muted small">Chefe da semana</span>
            <span class="muted small">${b.defeated ? 'Derrotado!' : `${daysLeft} ${daysLeft === 1 ? 'dia restante' : 'dias restantes'}`}</span>
          </div>
          <strong class="boss-name">${esc(b.name)}</strong>
          <div class="bar-row">
            <div class="bar boss-bar" role="progressbar" aria-label="Vida do chefe" aria-valuenow="${b.hp}" aria-valuemax="${b.maxHp}"><div style="width:${pct(b.hp, b.maxHp)}%"></div></div>
            <span class="bar-value">${b.hp}/${b.maxHp}</span>
          </div>
          <span class="muted small">${b.defeated
            ? 'Vitória! Um novo chefe aparece na segunda-feira.'
            : `Cada missão causa dano igual ao XP ganho${bonus ? ` (+${bonus}% pela arma)` : ''}. Prêmio: ${reward.xp} XP e ${reward.gold} ouro.`}</span>
        </div>
      </div>
    `;
  }

  function questChips(q) {
    const a = G.ATTRIBUTES[q.attr];
    const d = G.DIFFICULTY[q.difficulty];
    const chips = [`<span class="chip" title="${a.name}">${a.icon} ${a.name}</span>`, `<span class="chip diff-${q.difficulty}">${d.name}</span>`];
    if (q.type === 'daily') {
      if (q.streak > 0) chips.push(`<span class="chip streak" title="Sequência atual (melhor: ${q.bestStreak})">🔥 ${q.streak}</span>`);
      if (q.days.length < 7) chips.push(`<span class="chip">${q.days.map((x) => WEEKDAYS[x]).join(' ')}</span>`);
    }
    if (q.type === 'habit' && q.polarity === 'bad') chips.push(`<span class="chip bad">−${d.damage} ❤️</span>`);
    else if (!G.isDoneOn(q, G.todayKey())) {
      const r = G.computeReward(state, q.type === 'daily' ? { ...q, streak: q.streak + 1 } : q);
      chips.push(`<span class="chip reward">+${r.xp} XP · +${r.gold} 🪙</span>`);
    }
    return chips.join('');
  }

  function questItem(q, today) {
    const done = G.isDoneOn(q, today);
    let control;
    if (q.type === 'habit') {
      const count = G.habitCount(q, today);
      control = q.polarity === 'bad'
        ? `<button class="habit-btn bad" data-action="complete" data-id="${q.id}" aria-label="Registrar deslize: ${esc(q.title)}">−</button>`
        : `<button class="habit-btn good" data-action="complete" data-id="${q.id}" aria-label="Registrar: ${esc(q.title)}">+</button>`;
      if (count) control += `<span class="count">×${count}</span>`;
    } else {
      control = `<button class="check-btn ${done ? 'done' : ''}" data-action="${done ? 'undo' : 'complete'}" data-id="${q.id}" aria-pressed="${done}" aria-label="${done ? 'Desfazer' : 'Concluir'}: ${esc(q.title)}">${done ? '✓' : ''}</button>`;
    }
    return `
      <li class="quest ${done ? 'is-done' : ''} ${q.type === 'habit' ? `habit-${q.polarity}` : ''}">
        <div class="quest-control">${control}</div>
        <div class="quest-body">
          <span class="quest-title">${esc(q.title)}</span>
          <div class="chips">${questChips(q)}</div>
        </div>
        <button class="icon-btn" data-action="delete-quest" data-id="${q.id}" aria-label="Apagar ${esc(q.title)}" title="Apagar">🗑️</button>
      </li>
    `;
  }

  function questGroup(title, subtitle, quests, today, empty) {
    return `
      <div class="group">
        <div class="group-head">
          <h2>${title}</h2>
          ${subtitle ? `<span class="muted small">${subtitle}</span>` : ''}
        </div>
        ${quests.length ? `<ul class="quest-list">${quests.map((q) => questItem(q, today)).join('')}</ul>` : `<p class="empty">${empty}</p>`}
      </div>
    `;
  }

  function questsView() {
    const today = G.todayKey();
    const dailies = state.quests.filter((q) => q.type === 'daily');
    const todayDailies = dailies.filter((q) => G.isScheduled(q, today));
    const restDailies = dailies.filter((q) => !G.isScheduled(q, today));
    const habits = state.quests.filter((q) => q.type === 'habit');
    const todos = state.quests.filter((q) => q.type === 'todo');
    const pending = todos.filter((q) => !q.done);
    const finished = todos.filter((q) => q.done);
    const doneCount = todayDailies.filter((q) => G.isDoneOn(q, today)).length;

    return `
      ${bossCard(today)}
      <div class="toolbar">
        <div>
          <strong>${WEEKDAYS[G.dayOfWeek(today)]}, ${today.split('-').reverse().join('/')}</strong>
          <span class="muted small"> · diárias de hoje: ${doneCount}/${todayDailies.length}</span>
        </div>
        <button class="btn primary" data-action="new-quest">+ Nova missão</button>
      </div>
      ${todayDailies.length && doneCount === todayDailies.length ? '<p class="banner">🎉 Todas as diárias de hoje concluídas. O reino agradece!</p>' : ''}
      ${questGroup('Diárias', 'Esquecer causa dano na virada do dia', todayDailies, today, 'Nenhuma diária para hoje.')}
      ${restDailies.length ? `<details class="group-more"><summary>Diárias de outros dias (${restDailies.length})</summary><ul class="quest-list">${restDailies.map((q) => questItem(q, today)).join('')}</ul></details>` : ''}
      ${questGroup('Hábitos', 'Toque quantas vezes quiser', habits, today, 'Crie hábitos bons (+) para ganhar XP, ou ruins (−) para se policiar.')}
      ${questGroup('Tarefas', 'Missões únicas', pending, today, 'Nenhuma tarefa pendente.')}
      ${finished.length ? `<details class="group-more"><summary>Tarefas concluídas (${finished.length})</summary><ul class="quest-list">${finished.map((q) => questItem(q, today)).join('')}</ul><button class="btn ghost small" data-action="clear-done">Limpar concluídas</button></details>` : ''}
    `;
  }

  function gearView() {
    const level = G.heroLevel(state);
    const b = G.bonuses(state);
    const summary = Object.entries(G.SLOTS)
      .map(([slot, s]) => {
        const v = Math.round(b[s.effect] * 100);
        return v ? `<span class="chip reward">${s.desc(v)}</span>` : '';
      })
      .join('');
    return `
      <div class="gear-top card">
        ${avatar('big')}
        <div>
          <strong>Equipamento</strong>
          <p class="muted small">Novos itens são liberados ao subir de nível e equipados automaticamente. Você pode trocar quando quiser.</p>
          <div class="chips">${summary || '<span class="chip">Sem bônus ainda — suba de nível!</span>'}</div>
        </div>
      </div>
      ${Object.entries(G.SLOTS).map(([slot, s]) => {
        const items = G.EQUIPMENT.filter((i) => i.slot === slot);
        const current = G.equippedItem(state, slot);
        return `<div class="group">
          <div class="group-head"><h2>${s.name}</h2><span class="muted small">${s.desc('X').replace('X', '…')}</span></div>
          <ul class="gear-list">
            ${items.map((i) => {
              const unlocked = level >= i.level;
              const equipped = current && current.id === i.id;
              return `<li class="gear-item card tier-${i.tier} ${unlocked ? '' : 'locked'} ${equipped ? 'equipped' : ''}">
                <span class="gear-icon">${unlocked ? i.icon : '🔒'}</span>
                <div class="gear-body">
                  <strong>${unlocked ? esc(i.name) : '???'}</strong>
                  <span class="small"><span class="tier-label">${G.TIERS[i.tier]}</span> · ${i.value ? s.desc(i.value) : 'sem bônus'}</span>
                </div>
                ${equipped
                  ? '<span class="chip reward">Equipado</span>'
                  : unlocked
                    ? `<button class="btn small-btn" data-action="equip" data-id="${i.id}">Equipar</button>`
                    : `<span class="chip">Nv. ${i.level}</span>`}
              </li>`;
            }).join('')}
          </ul>
        </div>`;
      }).join('')}
    `;
  }

  function shopView() {
    const h = state.hero;
    const max = G.maxHp(G.heroLevel(state));
    return `
      <div class="toolbar">
        <div><strong>Loja do Taverneiro</strong><span class="muted small"> · você tem 🪙 ${h.gold}</span></div>
        <button class="btn primary" data-action="new-reward">+ Nova recompensa</button>
      </div>
      <p class="muted small">Recompense-se de verdade: crie itens com o que você gosta e compre com o ouro das missões.</p>
      <ul class="shop">
        ${state.rewards.map((r) => {
          const afford = h.gold >= r.cost;
          const fullHp = r.heal && h.hp >= max;
          return `<li class="shop-item card">
            <span class="shop-icon">${r.heal ? '🧪' : '🎁'}</span>
            <div class="shop-body">
              <strong>${esc(r.title)}</strong>
              ${r.heal ? `<span class="muted small">Recupera ${r.heal} de vida</span>` : ''}
            </div>
            <button class="btn ${afford && !fullHp ? 'gold-btn' : 'ghost'}" data-action="buy" data-id="${r.id}" ${afford && !fullHp ? '' : 'disabled'}>🪙 ${r.cost}</button>
            ${r.builtin ? '' : `<button class="icon-btn" data-action="delete-reward" data-id="${r.id}" aria-label="Remover ${esc(r.title)}" title="Remover">🗑️</button>`}
          </li>`;
        }).join('')}
      </ul>
    `;
  }

  // ---------- Evolução ----------

  function lastDays(n) {
    const today = G.todayKey();
    const start = G.addDays(today, -(n - 1));
    const first = state.createdAt > start ? state.createdAt : start;
    const days = [];
    for (let d = first; d <= today; d = G.addDays(d, 1)) days.push(d);
    return days;
  }

  function seriesData() {
    const today = G.todayKey();
    const hist = state.history;

    const done = lastDays(30).map((d) => {
      const v = (hist[d] && hist[d].done) || 0;
      return { label: shortDate(d), value: v, tip: `${v} ${v === 1 ? 'missão' : 'missões'}|${WEEKDAYS[G.dayOfWeek(d)]} ${shortDate(d)}` };
    });

    // XP: repete o último valor conhecido nos dias sem registro.
    const sorted = Object.keys(hist).sort();
    let carry = 0;
    const xpDays = lastDays(90);
    sorted.forEach((k) => {
      if (k < xpDays[0] && typeof hist[k].xp === 'number') carry = hist[k].xp;
    });
    const xp = xpDays.map((d) => {
      if (d === today) carry = state.hero.xp;
      else if (hist[d] && typeof hist[d].xp === 'number') carry = hist[d].xp;
      return { label: shortDate(d), value: carry, tip: `${carry} XP · nível ${G.levelFromXp(carry)}|${WEEKDAYS[G.dayOfWeek(d)]} ${shortDate(d)}` };
    });

    const weeks = [];
    const thisWeek = G.weekStart(today);
    const firstWeek = G.weekStart(state.createdAt);
    for (let i = 11; i >= 0; i--) {
      const w = G.addDays(thisWeek, -7 * i);
      if (w < firstWeek) continue;
      let due = 0;
      let ok = 0;
      for (let j = 0; j < 7; j++) {
        const d = G.addDays(w, j);
        if (d > today) break;
        const t = d === today ? G.dailyTotals(state, d) : { due: (hist[d] && hist[d].due) || 0, done: (hist[d] && hist[d].dailyDone) || 0 };
        due += t.due;
        ok += t.done;
      }
      const value = due ? Math.round((ok / due) * 100) : null;
      weeks.push({ label: shortDate(w), value, due, ok, tip: `${value == null ? 'Sem diárias' : `${value}% (${ok} de ${due})`}|Semana de ${shortDate(w)}` });
    }
    return { done, xp, weeks };
  }

  function dataTable(head, rows) {
    return `<details class="table-view"><summary>Ver dados em tabela</summary>
      <table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    </details>`;
  }

  function statsView() {
    const data = seriesData();
    const s = state.stats;
    const activeDays = data.done.filter((d) => d.value > 0).length;
    const week = data.weeks[data.weeks.length - 1];
    const attrs = Object.entries(G.ATTRIBUTES).map(([id, a]) => ({ id, a, xp: state.hero.attrs[id], level: G.levelFromXp(state.hero.attrs[id], G.ATTR_BASE) }));
    const maxAttr = Math.max(1, ...attrs.map((x) => x.xp));
    return `
      <div class="toolbar"><div><strong>Evolução</strong><span class="muted small"> · sua jornada em números</span></div></div>
      <div class="stats-grid">
        <div class="stat card"><span class="muted small">Nível</span><span class="stat-value">${G.heroLevel(state)}</span></div>
        <div class="stat card"><span class="muted small">Dias ativos (30 dias)</span><span class="stat-value">${activeDays}</span></div>
        <div class="stat card"><span class="muted small">Diárias nesta semana</span><span class="stat-value">${week && week.value != null ? `${week.value}%` : '—'}</span></div>
        <div class="stat card"><span class="muted small">Chefes derrotados</span><span class="stat-value">${s.bossesDefeated}</span></div>
      </div>

      <div class="chart-card card">
        <h2>Missões concluídas por dia</h2>
        <p class="muted small">Últimos 30 dias</p>
        <div class="chart" data-chart="done"></div>
        ${dataTable(['Dia', 'Missões'], data.done.map((d) => [d.label, d.value]))}
      </div>

      <div class="chart-card card">
        <h2>Experiência total</h2>
        <p class="muted small">Últimos 90 dias</p>
        <div class="chart" data-chart="xp"></div>
        ${dataTable(['Dia', 'XP'], data.xp.map((d) => [d.label, d.value]))}
      </div>

      <div class="chart-card card">
        <h2>Diárias cumpridas por semana</h2>
        <p class="muted small">Porcentagem das diárias agendadas que você fez</p>
        <div class="chart" data-chart="weeks"></div>
        ${dataTable(['Semana', 'Cumpridas', 'Agendadas', '%'], data.weeks.map((w) => [w.label, w.ok, w.due, w.value == null ? '—' : `${w.value}%`]))}
      </div>

      <div class="chart-card card">
        <h2>Atributos</h2>
        <p class="muted small">XP acumulado em cada atributo</p>
        <ul class="hbars">
          ${attrs.map((x) => `<li>
            <span class="hbar-label">${x.a.icon} ${x.a.name}</span>
            <span class="hbar-track"><span class="hbar-fill" style="width:${pct(x.xp, maxAttr)}%"></span></span>
            <span class="hbar-value">Nv. ${x.level} · ${C.compact(x.xp)} XP</span>
          </li>`).join('')}
        </ul>
      </div>
    `;
  }

  function drawCharts() {
    const data = seriesData();
    app.querySelectorAll('[data-chart]').forEach((el) => {
      const width = Math.max(260, el.clientWidth);
      const kind = el.dataset.chart;
      if (kind === 'done') el.innerHTML = C.columnChart(data.done, width, { label: 'Missões concluídas por dia' });
      if (kind === 'xp') el.innerHTML = C.lineChart(data.xp, width, { label: 'Experiência total' });
      if (kind === 'weeks') el.innerHTML = C.columnChart(data.weeks, width, { label: 'Diárias cumpridas por semana', max: 100, format: (v) => `${Math.round(v)}%` });
    });
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => state && tab === 'stats' && drawCharts(), 150);
  });

  // Tooltip dos gráficos: o valor em destaque, o rótulo embaixo.
  function showTip(target, x, y) {
    const [value, label] = target.dataset.tip.split('|');
    tip.innerHTML = '';
    const strong = document.createElement('strong');
    strong.textContent = value;
    const small = document.createElement('span');
    small.textContent = label || '';
    tip.append(strong, small);
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2));
    const top = y - r.height - 12 < 8 ? y + 16 : y - r.height - 12;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    app.querySelectorAll('.hit.active').forEach((el) => el.classList.remove('active'));
    target.classList.add('active');
  }

  function hideTip() {
    tip.hidden = true;
    app.querySelectorAll('.hit.active').forEach((el) => el.classList.remove('active'));
  }

  app.addEventListener('pointermove', (e) => {
    const t = e.target.closest('[data-tip]');
    if (t) showTip(t, e.clientX, e.clientY);
    else if (!tip.hidden) hideTip();
  });
  app.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('[data-tip]');
    if (t) showTip(t, e.clientX, e.clientY);
  });
  app.addEventListener('focusin', (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) return;
    const r = t.getBoundingClientRect();
    showTip(t, r.left + r.width / 2, r.top + 20);
  });
  app.addEventListener('focusout', hideTip);
  app.addEventListener('pointerleave', hideTip);
  window.addEventListener('scroll', hideTip, { passive: true });

  function achievementsView() {
    const total = G.ACHIEVEMENTS.length;
    const got = G.ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
    return `
      <div class="toolbar"><div><strong>Conquistas</strong><span class="muted small"> · ${got}/${total}</span></div></div>
      <ul class="achievements">
        ${G.ACHIEVEMENTS.map((a) => {
          const ts = state.achievements[a.id];
          return `<li class="achievement card ${ts ? 'unlocked' : ''}">
            <span class="ach-icon">${ts ? a.icon : '🔒'}</span>
            <div><strong>${a.name}</strong><p class="muted small">${a.desc}</p>
            ${ts ? `<span class="small gold-text">Desbloqueada em ${new Date(ts).toLocaleDateString('pt-BR')}</span>` : ''}</div>
          </li>`;
        }).join('')}
      </ul>
    `;
  }

  function logView() {
    return `
      <div class="toolbar"><div><strong>Diário de Aventura</strong></div></div>
      <ul class="log">
        ${state.log.map((e) => `<li><span class="log-icon">${e.icon}</span><span class="log-text">${esc(e.text)}</span><time class="muted small">${new Date(e.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time></li>`).join('')}
      </ul>
    `;
  }

  function installCard() {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    let body;
    if (standalone) body = '<p>✅ O app já está instalado e funciona sem internet.</p>';
    else if (!/^https?:$/.test(location.protocol)) {
      body = `<p class="muted small">Para instalar no celular, o app precisa estar publicado num endereço da internet
        (por exemplo, GitHub Pages — veja o README). Aberto como arquivo no computador ele funciona, mas não pode ser instalado.</p>`;
    } else if (installPrompt) {
      body = '<p class="muted small">Instale para abrir como um aplicativo, direto da tela inicial, mesmo sem internet.</p><button class="btn primary" data-action="install">📲 Instalar app</button>';
    } else if (ios) {
      body = '<p class="muted small">No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</p>';
    } else {
      body = '<p class="muted small">No menu do navegador (⋮), toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</p>';
    }
    return `<div class="card settings"><h2>Instalar no celular</h2>${body}</div>`;
  }

  function heroView() {
    const s = state.stats;
    return `
      <div class="toolbar"><div><strong>Ficha do Herói</strong></div></div>
      <div class="stats-grid">
        <div class="stat card"><span class="muted small">Missões concluídas</span><span class="stat-value">${s.completed}</span></div>
        <div class="stat card"><span class="muted small">Melhor sequência</span><span class="stat-value">${s.bestStreak}</span></div>
        <div class="stat card"><span class="muted small">Ouro ganho</span><span class="stat-value">${s.goldEarned}</span></div>
        <div class="stat card"><span class="muted small">Derrotas</span><span class="stat-value">${s.defeats}</span></div>
      </div>
      ${installCard()}
      <div class="card rules">
        <h2>Como funciona</h2>
        <ul>
          <li><strong>Diárias</strong> dão XP e ouro; cada dia seguido aumenta a recompensa em 10% (até +100%).</li>
          <li>Diária esquecida tira vida na virada do dia e zera a sequência. Cada noite de descanso recupera 10% da vida.</li>
          <li>Com a vida em 0 você é <strong>derrotado</strong>: perde o progresso do nível atual e metade do ouro.</li>
          <li>Subir de nível restaura a vida, aumenta a vida máxima e libera <strong>equipamentos</strong> com bônus.</li>
          <li>Toda semana aparece um <strong>chefe</strong>. Suas missões causam dano nele; hábitos ruins o curam. Se ele sobreviver até domingo, foge e acerta um golpe.</li>
          <li>Missões do atributo da sua classe rendem +20% de XP.</li>
        </ul>
      </div>
      <div class="card settings">
        <h2>Configurações</h2>
        <form id="rename-form" class="inline-form">
          <input name="name" maxlength="24" value="${esc(state.hero.name)}" aria-label="Nome do herói" required>
          <button class="btn" type="submit">Renomear</button>
        </form>
        <div class="btn-row">
          <button class="btn" data-action="export">⬇️ Exportar progresso</button>
          <label class="btn">⬆️ Importar<input type="file" accept="application/json,.json" id="import-file" hidden></label>
          <button class="btn danger" data-action="reset">Recomeçar do zero</button>
        </div>
      </div>
    `;
  }

  // ---------- Modais ----------

  function openModal(html) {
    modal.innerHTML = `<div class="modal-inner">${html}</div>`;
    if (!modal.open) modal.showModal();
    const first = modal.querySelector('input:not([type=hidden]), select, button');
    if (first) first.focus();
  }

  function closeModal() {
    if (modal.open) modal.close();
  }

  function questModal() {
    const attrOptions = Object.entries(G.ATTRIBUTES).map(([id, a]) => `<option value="${id}">${a.icon} ${a.name} — ${a.hint}</option>`).join('');
    const diffOptions = Object.entries(G.DIFFICULTY).map(([id, d]) => `<option value="${id}" ${id === 'medium' ? 'selected' : ''}>${d.name} (${d.xp} XP · ${d.gold} ouro)</option>`).join('');
    openModal(`
      <form id="quest-form" method="dialog">
        <h2>Nova missão</h2>
        <label class="field"><span>O que você vai fazer?</span><input name="title" maxlength="80" required placeholder="Ex.: Caminhar 30 minutos" autocomplete="off"></label>
        <fieldset class="field">
          <legend>Tipo</legend>
          <div class="segmented">
            <label><input type="radio" name="type" value="daily" checked><span>📅 Diária</span></label>
            <label><input type="radio" name="type" value="habit"><span>🔁 Hábito</span></label>
            <label><input type="radio" name="type" value="todo"><span>📌 Tarefa</span></label>
          </div>
        </fieldset>
        <fieldset class="field only-daily">
          <legend>Dias da semana</legend>
          <div class="weekdays">
            ${WEEKDAYS.map((d, i) => `<label><input type="checkbox" name="days" value="${i}" checked><span>${d}</span></label>`).join('')}
          </div>
        </fieldset>
        <fieldset class="field only-habit" hidden>
          <legend>Esse hábito é…</legend>
          <div class="segmented">
            <label><input type="radio" name="polarity" value="good" checked><span>👍 Bom (+XP)</span></label>
            <label><input type="radio" name="polarity" value="bad"><span>👎 Ruim (−vida)</span></label>
          </div>
        </fieldset>
        <label class="field"><span>Atributo treinado</span><select name="attr">${attrOptions}</select></label>
        <label class="field"><span>Dificuldade</span><select name="difficulty">${diffOptions}</select></label>
        <div class="btn-row end">
          <button class="btn ghost" type="button" data-action="close-modal">Cancelar</button>
          <button class="btn primary" type="submit">Criar missão</button>
        </div>
      </form>
    `);
  }

  function rewardModal() {
    openModal(`
      <form id="reward-form" method="dialog">
        <h2>Nova recompensa</h2>
        <label class="field"><span>Recompensa</span><input name="title" maxlength="60" required placeholder="Ex.: Uma hora de videogame" autocomplete="off"></label>
        <label class="field"><span>Preço em ouro</span><input name="cost" type="number" min="1" max="99999" value="50" required></label>
        <div class="btn-row end">
          <button class="btn ghost" type="button" data-action="close-modal">Cancelar</button>
          <button class="btn primary" type="submit">Adicionar à loja</button>
        </div>
      </form>
    `);
  }

  let pendingConfirm = null;

  function confirmModal(text, confirmLabel, onConfirm) {
    pendingConfirm = onConfirm;
    openModal(`
      <h2>Tem certeza?</h2>
      <p>${esc(text)}</p>
      <div class="btn-row end">
        <button class="btn ghost" data-action="close-modal">Cancelar</button>
        <button class="btn danger" data-action="confirm">${esc(confirmLabel)}</button>
      </div>
    `);
  }

  function newItemsHtml(items) {
    if (!items || !items.length) return '';
    return `<p class="muted small">Novos equipamentos:</p><div class="new-items">${items.map((i) => `<span class="new-item tier-${i.tier}">${i.icon} ${esc(i.name)}</span>`).join('')}</div>`;
  }

  function levelUpModal(level, items) {
    openModal(`
      <div class="celebrate">
        <div class="big-icon">⭐</div>
        <h2>Nível ${level}!</h2>
        <p>Sua vida máxima subiu para ${G.maxHp(level)} e foi totalmente restaurada.</p>
        ${newItemsHtml(items)}
        <button class="btn primary" data-action="close-modal">Continuar a aventura</button>
      </div>
    `);
  }

  function bossDefeatedModal(hit, level, items) {
    openModal(`
      <div class="celebrate">
        <div class="big-icon">🏅</div>
        <h2>${esc(state.boss.name)} foi derrotado!</h2>
        <p>Prêmio: <strong>+${hit.reward.xp} XP</strong> e <strong>+${hit.reward.gold} ouro</strong>.</p>
        ${level ? `<p>Você subiu para o nível ${level}!</p>` : ''}
        ${newItemsHtml(items)}
        <p class="muted small">Um novo chefe aparece na segunda-feira.</p>
        <button class="btn primary" data-action="close-modal">Glória!</button>
      </div>
    `);
  }

  function rolloverModal(summary) {
    const missed = summary.missed;
    const boss = summary.boss || {};
    const title = summary.defeated ? 'Você foi derrotado…' : missed.length || boss.escaped ? 'Um novo dia, cicatrizes do anterior' : 'Bom dia, herói!';
    openModal(`
      <div class="celebrate">
        <div class="big-icon">${summary.defeated ? '💀' : missed.length ? '⚔️' : '🌅'}</div>
        <h2>${title}</h2>
        ${missed.length ? `<p>Missões esquecidas:</p><ul class="missed">${missed.map((m) => `<li>${esc(m.title)} <span class="muted small">${shortDate(m.day)}</span> <span class="bad-text">−${m.damage} ❤️</span></li>`).join('')}</ul>` : '<p>Nenhuma diária esquecida. Continue assim!</p>'}
        ${boss.escaped ? `<p>${boss.escaped.icon} ${esc(boss.escaped.name)} escapou e acertou um golpe: <span class="bad-text">−${boss.escaped.damage} ❤️</span></p>` : ''}
        ${summary.defeated ? '<p>Você perdeu o progresso do nível atual e metade do ouro, mas está de pé novamente.</p>' : ''}
        ${summary.healed ? `<p class="muted small">O descanso recuperou ${summary.healed} de vida.</p>` : ''}
        ${boss.spawned ? `<p><strong>${boss.spawned.icon} ${esc(boss.spawned.name)}</strong> apareceu! Vida: ${boss.spawned.maxHp}.</p>` : ''}
        <button class="btn primary" data-action="close-modal">Encarar o dia</button>
      </div>
    `);
  }

  // ---------- Missões iniciais ----------

  function addStarterQuests() {
    const today = G.todayKey();
    [
      { title: 'Beber 2 litros de água', type: 'daily', attr: 'vit', difficulty: 'easy' },
      { title: 'Ler 20 páginas', type: 'daily', attr: 'int', difficulty: 'medium' },
      { title: 'Treinar', type: 'daily', attr: 'str', difficulty: 'hard', days: [1, 3, 5] },
      { title: 'Meditar 10 minutos', type: 'daily', attr: 'wis', difficulty: 'easy' },
      { title: 'Alongar', type: 'habit', attr: 'str', difficulty: 'easy', polarity: 'good' },
      { title: 'Rolar redes sociais sem parar', type: 'habit', attr: 'wis', difficulty: 'medium', polarity: 'bad' },
      { title: 'Ligar para alguém querido', type: 'todo', attr: 'cha', difficulty: 'medium' },
    ].forEach((q) => G.addQuest(state, q, today));
  }

  // ---------- Eventos ----------

  app.addEventListener('click', handleClick);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
    else handleClick(e);
  });

  function handleClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const today = G.todayKey();
    switch (btn.dataset.action) {
      case 'tab':
        setTab(id);
        break;
      case 'complete':
        checkDay();
        announce(act(() => G.completeQuest(state, id, today)));
        break;
      case 'undo':
        act(() => G.undoQuest(state, id, today));
        break;
      case 'delete-quest': {
        const q = G.findQuest(state, id);
        if (q) confirmModal(`Apagar a missão "${q.title}"?`, 'Apagar', () => act(() => G.removeQuest(state, id)));
        break;
      }
      case 'clear-done':
        act(() => (state.quests = state.quests.filter((q) => !(q.type === 'todo' && q.done))));
        break;
      case 'new-quest':
        questModal();
        break;
      case 'new-reward':
        rewardModal();
        break;
      case 'buy': {
        const r = act(() => G.buyReward(state, id));
        if (r.ok) {
          toast('🛒', r.healed ? `+${r.healed} de vida` : 'Aproveite, você mereceu!', 'gold');
          (r.achievements || []).forEach((a) => toast('🏆', `Conquista: ${a.name}`, 'gold'));
        }
        break;
      }
      case 'delete-reward':
        act(() => G.removeReward(state, id));
        break;
      case 'equip': {
        const unlocked = act(() => {
          const ok = G.equip(state, id);
          return ok ? G.checkAchievements(state) : null;
        });
        if (unlocked) {
          const item = G.findItem(id);
          toast(item.icon, `${item.name} equipado.`);
          unlocked.forEach((a) => toast('🏆', `Conquista: ${a.name}`, 'gold'));
        }
        break;
      }
      case 'install':
        if (installPrompt) {
          installPrompt.prompt();
          installPrompt.userChoice.finally(() => {
            installPrompt = null;
            render();
          });
        }
        break;
      case 'export':
        exportState();
        break;
      case 'reset':
        confirmModal('Todo o progresso deste herói será apagado. Exporte antes se quiser guardar.', 'Apagar tudo', () => {
          state = null;
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch (err) {
            /* nada a remover */
          }
          render();
        });
        break;
      case 'confirm': {
        const fn = pendingConfirm;
        pendingConfirm = null;
        closeModal();
        if (fn) fn();
        break;
      }
      case 'close-modal':
        closeModal();
        break;
    }
  }

  document.addEventListener('submit', (e) => {
    const form = e.target;
    const data = new FormData(form);
    if (form.id === 'create-form') {
      e.preventDefault();
      const today = G.todayKey();
      state = G.createState(String(data.get('name')).trim(), data.get('cls'), today);
      if (data.get('starter')) addStarterQuests();
      G.processRollover(state, today); // invoca o primeiro chefe já com as missões
      tab = 'quests';
      save();
      render();
      toast(G.CLASSES[state.hero.cls].icon, 'Sua jornada começou!', 'good');
    } else if (form.id === 'quest-form') {
      e.preventDefault();
      const type = data.get('type');
      const days = data.getAll('days').map(Number);
      if (type === 'daily' && !days.length) {
        toast('📅', 'Escolha pelo menos um dia da semana.', 'bad');
        return;
      }
      act(() => G.addQuest(state, {
        title: data.get('title'),
        type,
        days,
        polarity: data.get('polarity'),
        attr: data.get('attr'),
        difficulty: data.get('difficulty'),
      }, G.todayKey()));
      closeModal();
      toast('📜', 'Nova missão aceita!');
    } else if (form.id === 'reward-form') {
      e.preventDefault();
      act(() => G.addReward(state, data.get('title'), data.get('cost')));
      closeModal();
    } else if (form.id === 'rename-form') {
      e.preventDefault();
      const name = String(data.get('name')).trim();
      if (name) {
        act(() => (state.hero.name = name));
        toast('✒️', 'Nome atualizado.');
      }
    }
  });

  // Mostra os campos certos para o tipo de missão escolhido.
  modal.addEventListener('change', (e) => {
    const form = e.target.form;
    if (!form || form.id !== 'quest-form' || e.target.name !== 'type') return;
    const type = e.target.value;
    form.querySelector('.only-daily').hidden = type !== 'daily';
    form.querySelector('.only-habit').hidden = type !== 'habit';
  });

  app.addEventListener('change', (e) => {
    if (e.target.id !== 'import-file' || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = G.migrate(JSON.parse(reader.result));
        if (!G.validate(data)) throw new Error('inválido');
        state = data;
        save();
        checkDay();
        render();
        toast('⬆️', 'Progresso importado!', 'good');
      } catch (err) {
        toast('⚠️', 'Arquivo inválido.', 'bad');
      }
    };
    reader.readAsText(e.target.files[0]);
  });

  function exportState() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rotina-rpg-${G.todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- Instalação (PWA) ----------
  // Só funciona servido por http(s); aberto como arquivo, o app roda normalmente sem isso.

  if (/^https?:$/.test(location.protocol)) {
    [['manifest', 'manifest.webmanifest'], ['apple-touch-icon', 'icons/apple-touch-icon.png']].forEach(([rel, href]) => {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      document.head.appendChild(link);
    });
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    if (state && tab === 'hero') render();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    toast('📲', 'App instalado!', 'good');
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkDay();
  });
  setInterval(checkDay, 60 * 1000);

  render();
  checkDay();
  window.RoutineRPGStarted = true;
})();
