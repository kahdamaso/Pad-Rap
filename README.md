# ⚔️ Rotina RPG

Transforme sua rotina em um RPG. Cada hábito vira missão, cada dia vira XP.

## Como jogar

1. Crie seu herói e escolha uma classe (cada classe ganha +20% de XP no seu atributo).
2. Cadastre suas missões:
   - **📅 Diárias** – repetem nos dias da semana escolhidos. Concluir dá XP e ouro; cada dia seguido aumenta a recompensa em 10% (até +100%). Esquecer causa dano na virada do dia e zera a sequência.
   - **🔁 Hábitos** – toque quantas vezes quiser. Bons (+) dão XP; ruins (−) tiram vida.
   - **📌 Tarefas** – missões únicas.
3. Cada missão treina um atributo: 💪 Força, 📚 Inteligência, 🧘 Sabedoria, 🎭 Carisma, 🍎 Vitalidade.
4. Gaste o ouro na **Loja** com recompensas reais que você mesmo cria (ou numa Poção de Vida).
5. Desbloqueie **conquistas** e acompanhe tudo no **Diário de Aventura**.

Com a vida em 0 o herói é derrotado: perde o progresso do nível atual e metade do ouro. Subir de nível restaura a vida; cada noite de descanso recupera 10%.

## Rodando

Não precisa de build nem instalação: abra o `index.html` no navegador.
Se preferir um servidor local: `npm start` (http://localhost:5173).

O progresso fica salvo no `localStorage` do navegador. Use **Herói → Exportar/Importar** para fazer backup ou levar para outro dispositivo.

## Estrutura

- `src/game.js` – regras do jogo (funções puras, sem DOM)
- `src/app.js` – interface
- `src/styles.css` – visual (tema claro e escuro automático)
- `test/` – testes das regras: `npm test`
