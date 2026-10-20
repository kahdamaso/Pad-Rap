# ⚔️ Rotina RPG

Transforme sua rotina em um RPG. Cada hábito vira missão, cada dia vira XP.

## Como jogar

1. Crie seu herói em 3 etapas:
   - **Quem é você:** nome e aparência do avatar (personagem, tom de pele e cor).
   - **Classe:** cada classe ganha +20% de XP no seu atributo.
   - **Desafios:** escolha até 3 dificuldades reais que você quer melhorar (procrastinação, sono, ansiedade, celular, estudos, finanças…). Elas viram características do avatar e já vêm com missões sugeridas.
2. Cadastre suas missões:
   - **📅 Diárias** – repetem nos dias da semana escolhidos. Concluir dá XP e ouro; cada dia seguido aumenta a recompensa em 10% (até +100%). Esquecer causa dano na virada do dia e zera a sequência.
   - **🔁 Hábitos** – toque quantas vezes quiser. Bons (+) dão XP; ruins (−) tiram vida.
   - **📌 Tarefas** – missões únicas.
3. Cada missão treina um atributo: 💪 Força, 📚 Inteligência, 🧘 Sabedoria, 🎭 Carisma, 🍎 Vitalidade.
4. **👺 Chefe semanal** – toda segunda aparece um chefe. Cada missão causa nele dano igual ao XP ganho; hábitos ruins o curam. Vença até domingo para ganhar XP e ouro extras. Se ele sobreviver, foge e acerta um golpe. A vida do chefe depende das diárias agendadas na semana.
5. **🧙 Personagem → Desafios** – missões ligadas a um desafio dão +15% de XP e o fazem evoluir: Fraqueza → Enfrentando → Dominando → Superada. Ao superar, a fraqueza vira uma **virtude** (ex.: Procrastinação → Iniciativa) com +10% de XP para sempre naquele atributo, e abre espaço para um novo desafio. Hábitos ruins ligados a ele fazem você perder progresso. A aparência pode ser trocada a qualquer momento.
6. **🎒 Equipamento** – subir de nível libera itens em 5 espaços (arma, escudo, elmo, amuleto e companheiro), do Comum ao Lendário. Eles aparecem no seu avatar e dão bônus: dano no chefe, defesa, XP, ouro e cura ao descansar.
7. **🛒 Loja** – gaste o ouro com recompensas reais que você mesmo cria (ou numa Poção de Vida).
8. **📈 Evolução** – gráficos de missões por dia, XP ao longo do tempo, diárias cumpridas por semana e atributos.
9. Desbloqueie **conquistas** e acompanhe tudo no **Diário de Aventura**.

### Todo dia tem um motivo para voltar

- **🎁 Baú diário:** sempre tem ouro e às vezes XP, cura ou um Pergaminho de Folga. Abrir o app dias seguidos melhora o baú: madeira, prata (3 dias) e ouro (7 dias).
- **🎲 Desafio do dia:** uma missão-surpresa sorteada do Mural que vale o dobro e some à meia-noite. Dá para trocar uma vez.
- **📋 Mural de Missões:** missões prontas, com recompensa definida pelo jogo, liberadas conforme o nível. Cada atributo tem uma escada que começa pequena (beber um copo de água) e vai ficando mais exigente (dormir 8 horas). Quando uma missão fica fácil demais para o seu nível, ela rende menos: é hora de aceitar a próxima.
- **🏛️ Provação:** a cada 5 níveis, para subir é preciso ter alguns dias perfeitos (todas as diárias do dia cumpridas). O XP continua acumulando enquanto isso. Cada Provação vencida dá um título: Novato → Aprendiz → Aventureiro → Cavaleiro → Campeão…
- **📜 Pergaminho de Folga:** protege sozinho um dia ruim, sem dano e sem perder sequências. Vem no baú ou na loja, e dá para guardar até 3.

### Regras para os pontos valerem

- Hábitos bons rendem XP só nas 3 primeiras vezes do dia.
- Tarefa criada e concluída no mesmo dia rende metade (planejar na véspera vale mais).
- Missões criadas por você têm dificuldade limitada pelo nível: Difícil a partir do 3, Épica a partir do 8.

Com a vida em 0 o herói é derrotado: perde o progresso do nível atual e metade do ouro. Subir de nível restaura a vida; cada noite de descanso recupera 10% (mais com um companheiro).

## Rodando no computador

Dê dois cliques no `index.html`. Ele é um arquivo único, com tudo embutido, então funciona mesmo sozinho.

> Baixou o ZIP do GitHub? Extraia antes de abrir. Use uma versão atual do Chrome, Edge ou Firefox.

O progresso fica salvo no navegador. Use **Herói → Exportar/Importar** para fazer backup ou levar para outro dispositivo.

## Instalando no celular (funciona sem internet)

Para instalar, o app precisa estar num endereço da internet. O GitHub Pages faz isso de graça:

1. No GitHub, abra o repositório → **Settings** → **Pages**.
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
3. Selecione a branch do app e a pasta **/ (root)**. Clique em **Save**.
4. Em um ou dois minutos o app fica disponível em `https://<seu-usuario>.github.io/Pad-Rap/`.

No celular, abra esse endereço:

- **Android (Chrome):** toque em **Instalar app** (aparece no menu ⋮ ou na aba ⚙️ Herói do app).
- **iPhone (Safari):** toque em **Compartilhar** → **Adicionar à Tela de Início**.

Depois de aberto uma vez, o app funciona offline. Quando houver internet, ele baixa as atualizações sozinho.

> O progresso do celular é separado do progresso do computador. Para levar seu herói, use **Exportar** num aparelho e **Importar** no outro.

## Desenvolvimento

O código-fonte fica em `src/`. O `index.html` e o `sw.js` são gerados a partir dele com `npm run build` (rode depois de editar qualquer arquivo de `src/`; o `npm test` avisa se esquecer).

- `src/template.html` – esqueleto da página
- `src/content.js` – Mural de Missões, títulos e baús
- `src/game.js` – regras do jogo (funções puras, sem DOM)
- `src/charts.js` – gráficos em SVG
- `src/app.js` – interface
- `src/styles.css` – visual (tema claro e escuro automático)
- `src/sw.js` – service worker (modo offline)
- `manifest.webmanifest`, `icons/` – app instalável
- `test/` – testes: `npm test`
- Servidor local: `npm start` (http://localhost:5173)
