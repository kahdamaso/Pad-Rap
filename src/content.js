// Mural de Missões: missões prontas do jogo, liberadas conforme o nível.
// Cada atributo tem uma "escada": começa pequeno e vai ficando mais exigente.
// `trait` liga a missão a um desafio, quando a pessoa o escolheu.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RoutineRPGContent = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MON_WED_FRI = [1, 3, 5];
  const TUE_THU_SAT = [2, 4, 6];

  const CATALOG = [
    // 💪 Força
    { id: 'str-alongar', attr: 'str', level: 1, type: 'daily', difficulty: 'easy', title: 'Alongar por 5 minutos', trait: 'sedentarismo' },
    { id: 'str-caminhar10', attr: 'str', level: 1, type: 'daily', difficulty: 'easy', title: 'Caminhar 10 minutos', trait: 'sedentarismo' },
    { id: 'str-agachar', attr: 'str', level: 2, type: 'daily', difficulty: 'easy', title: 'Fazer 10 agachamentos', trait: 'sedentarismo' },
    { id: 'str-caminhar30', attr: 'str', level: 3, type: 'daily', difficulty: 'medium', title: 'Caminhar 30 minutos', trait: 'sedentarismo' },
    { id: 'str-escada', attr: 'str', level: 4, type: 'habit', polarity: 'good', difficulty: 'easy', title: 'Subir escada em vez do elevador', trait: 'sedentarismo' },
    { id: 'str-treino20', attr: 'str', level: 5, type: 'daily', difficulty: 'medium', title: 'Treino de 20 minutos', days: MON_WED_FRI, trait: 'sedentarismo' },
    { id: 'str-correr', attr: 'str', level: 7, type: 'daily', difficulty: 'hard', title: 'Correr ou pedalar 30 minutos', days: TUE_THU_SAT, trait: 'sedentarismo' },
    { id: 'str-treino45', attr: 'str', level: 9, type: 'daily', difficulty: 'hard', title: 'Treino completo de 45 minutos', days: MON_WED_FRI, trait: 'sedentarismo' },
    { id: 'str-passos', attr: 'str', level: 11, type: 'daily', difficulty: 'hard', title: 'Dar 10 mil passos', trait: 'sedentarismo' },
    { id: 'str-trilha', attr: 'str', level: 13, type: 'todo', difficulty: 'epic', title: 'Fazer uma trilha ou esporte ao ar livre' },

    // 📚 Inteligência
    { id: 'int-ler5', attr: 'int', level: 1, type: 'daily', difficulty: 'easy', title: 'Ler 5 páginas', trait: 'estudos' },
    { id: 'int-palavra', attr: 'int', level: 2, type: 'daily', difficulty: 'easy', title: 'Aprender uma palavra ou fato novo' },
    { id: 'int-gastos', attr: 'int', level: 2, type: 'daily', difficulty: 'easy', title: 'Anotar os gastos do dia', trait: 'financas' },
    { id: 'int-estudar20', attr: 'int', level: 3, type: 'daily', difficulty: 'medium', title: 'Estudar 20 minutos sem distração', trait: 'estudos' },
    { id: 'int-aula', attr: 'int', level: 4, type: 'habit', polarity: 'good', difficulty: 'easy', title: 'Assistir a uma aula ou vídeo educativo', trait: 'estudos' },
    { id: 'int-ler20', attr: 'int', level: 5, type: 'daily', difficulty: 'medium', title: 'Ler 20 páginas', trait: 'estudos' },
    { id: 'int-resumo', attr: 'int', level: 6, type: 'daily', difficulty: 'medium', title: 'Resumir algo que aprendi', trait: 'estudos' },
    { id: 'int-orcamento', attr: 'int', level: 7, type: 'todo', difficulty: 'hard', title: 'Montar o orçamento do mês', trait: 'financas' },
    { id: 'int-estudar60', attr: 'int', level: 8, type: 'daily', difficulty: 'hard', title: 'Estudar 1 hora em blocos de foco', trait: 'estudos' },
    { id: 'int-livro', attr: 'int', level: 10, type: 'todo', difficulty: 'epic', title: 'Terminar um livro' },
    { id: 'int-curso', attr: 'int', level: 13, type: 'todo', difficulty: 'epic', title: 'Concluir um curso ou módulo', trait: 'estudos' },

    // 🧘 Sabedoria
    { id: 'wis-cama', attr: 'wis', level: 1, type: 'daily', difficulty: 'easy', title: 'Arrumar a cama', trait: 'desorganizacao' },
    { id: 'wis-respirar', attr: 'wis', level: 1, type: 'daily', difficulty: 'easy', title: 'Respirar fundo por 2 minutos', trait: 'ansiedade' },
    { id: 'wis-gratidao', attr: 'wis', level: 2, type: 'daily', difficulty: 'easy', title: 'Anotar 3 coisas boas do dia', trait: 'ansiedade' },
    { id: 'wis-planejar', attr: 'wis', level: 3, type: 'daily', difficulty: 'easy', title: 'Planejar o dia seguinte', trait: 'desorganizacao' },
    { id: 'wis-dificil', attr: 'wis', level: 3, type: 'daily', difficulty: 'medium', title: 'Fazer primeiro a tarefa mais difícil', trait: 'procrastinacao' },
    { id: 'wis-meditar', attr: 'wis', level: 4, type: 'daily', difficulty: 'medium', title: 'Meditar 10 minutos', trait: 'ansiedade' },
    { id: 'wis-sem-redes', attr: 'wis', level: 5, type: 'daily', difficulty: 'medium', title: 'Duas horas sem redes sociais', trait: 'celular' },
    { id: 'wis-organizar', attr: 'wis', level: 6, type: 'todo', difficulty: 'medium', title: 'Organizar um cômodo ou gaveta', trait: 'desorganizacao' },
    { id: 'wis-adiado', attr: 'wis', level: 7, type: 'todo', difficulty: 'hard', title: 'Resolver algo que venho adiando', trait: 'procrastinacao' },
    { id: 'wis-revisao', attr: 'wis', level: 9, type: 'daily', difficulty: 'hard', title: 'Revisão da semana: metas e agenda', days: [0], trait: 'desorganizacao' },
    { id: 'wis-detox', attr: 'wis', level: 11, type: 'todo', difficulty: 'epic', title: 'Um dia inteiro sem redes sociais', trait: 'celular' },

    // 🎭 Carisma
    { id: 'cha-bomdia', attr: 'cha', level: 1, type: 'daily', difficulty: 'easy', title: 'Dar bom dia a alguém com atenção', trait: 'timidez' },
    { id: 'cha-mensagem', attr: 'cha', level: 2, type: 'daily', difficulty: 'easy', title: 'Mandar mensagem para um amigo', trait: 'timidez' },
    { id: 'cha-elogio', attr: 'cha', level: 3, type: 'habit', polarity: 'good', difficulty: 'easy', title: 'Elogiar alguém de verdade', trait: 'timidez' },
    { id: 'cha-ligar', attr: 'cha', level: 4, type: 'daily', difficulty: 'medium', title: 'Ligar para alguém da família', days: [0, 3], trait: 'timidez' },
    { id: 'cha-criar', attr: 'cha', level: 5, type: 'daily', difficulty: 'medium', title: 'Fazer algo criativo por 20 minutos' },
    { id: 'cha-conversa', attr: 'cha', level: 6, type: 'habit', polarity: 'good', difficulty: 'medium', title: 'Puxar conversa com alguém novo', trait: 'timidez' },
    { id: 'cha-encontro', attr: 'cha', level: 8, type: 'todo', difficulty: 'hard', title: 'Encontrar um amigo pessoalmente', trait: 'timidez' },
    { id: 'cha-ajudar', attr: 'cha', level: 10, type: 'todo', difficulty: 'hard', title: 'Ajudar alguém sem esperar nada em troca' },
    { id: 'cha-reuniao', attr: 'cha', level: 12, type: 'todo', difficulty: 'epic', title: 'Organizar um encontro com amigos', trait: 'timidez' },

    // 🍎 Vitalidade
    { id: 'vit-copo', attr: 'vit', level: 1, type: 'daily', difficulty: 'easy', title: 'Beber um copo de água ao acordar', trait: 'alimentacao' },
    { id: 'vit-fruta', attr: 'vit', level: 1, type: 'daily', difficulty: 'easy', title: 'Comer uma fruta', trait: 'alimentacao' },
    { id: 'vit-agua15', attr: 'vit', level: 2, type: 'daily', difficulty: 'easy', title: 'Beber 1,5 litro de água', trait: 'alimentacao' },
    { id: 'vit-meianoite', attr: 'vit', level: 3, type: 'daily', difficulty: 'medium', title: 'Deitar antes da meia-noite', trait: 'sono' },
    { id: 'vit-verdura', attr: 'vit', level: 4, type: 'daily', difficulty: 'medium', title: 'Comer verduras no almoço', trait: 'alimentacao' },
    { id: 'vit-agua2', attr: 'vit', level: 5, type: 'daily', difficulty: 'medium', title: 'Beber 2 litros de água', trait: 'alimentacao' },
    { id: 'vit-23h', attr: 'vit', level: 6, type: 'daily', difficulty: 'medium', title: 'Deitar antes das 23h', trait: 'sono' },
    { id: 'vit-telas', attr: 'vit', level: 7, type: 'daily', difficulty: 'medium', title: 'Sem telas 30 minutos antes de dormir', trait: 'sono' },
    { id: 'vit-acucar', attr: 'vit', level: 8, type: 'daily', difficulty: 'hard', title: 'Um dia sem açúcar', trait: 'alimentacao' },
    { id: 'vit-cozinhar', attr: 'vit', level: 10, type: 'todo', difficulty: 'hard', title: 'Cozinhar uma refeição saudável', trait: 'alimentacao' },
    { id: 'vit-8h', attr: 'vit', level: 12, type: 'daily', difficulty: 'hard', title: 'Dormir 8 horas', trait: 'sono' },
  ];

  // Título do herói a cada Provação vencida (de 5 em 5 níveis).
  const TITLES = ['Novato', 'Aprendiz', 'Aventureiro', 'Cavaleiro', 'Campeão', 'Herói Lendário', 'Mito Vivo'];

  const CHESTS = [
    { name: 'Baú de Madeira', icon: '📦', minStreak: 1 },
    { name: 'Baú de Prata', icon: '🎁', minStreak: 3 },
    { name: 'Baú de Ouro', icon: '👑', minStreak: 7 },
  ];

  return { CATALOG, TITLES, CHESTS };
});
