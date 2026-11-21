/**
 * Bancas examinadoras mais comuns em provas jurídicas e o estilo de cada uma,
 * usado para gerar quizzes "no estilo da banca". (Mesma lista em client/src/lib/boards.ts.)
 */
export const BOARDS = ['FGV', 'Cebraspe', 'FCC', 'Vunesp', 'Cesgranrio', 'IBFC', 'Quadrix', 'AOCP', 'Consulplan', 'IDECAN', 'Fundatec', 'Objetiva'] as const;
export type Board = (typeof BOARDS)[number];

export const BOARD_STYLE: Record<Board, string> = {
  FGV: 'FGV (OAB 1ª fase e concursos): situações-problema com personagens e enunciado longo, 4 alternativas na OAB (5 em concursos), cobra aplicação da lei seca e jurisprudência dos tribunais superiores, alternativas parecidas entre si.',
  Cebraspe: 'Cebraspe (antigo Cespe): itens de certo/errado com afirmações técnicas, troca de uma palavra-chave que torna o item errado (sempre, nunca, exclusivamente), cobra jurisprudência recente e exceções; quando pedir múltipla escolha, 5 alternativas.',
  FCC: 'FCC: muito apego à literalidade da lei (lei seca), alternativas com trechos de artigos levemente alterados, prazos e quóruns, 5 alternativas.',
  Vunesp: 'Vunesp: enunciados diretos, foco em lei seca e conceitos doutrinários clássicos, alternativas "assinale a correta/incorreta", 5 alternativas.',
  Cesgranrio: 'Cesgranrio: questões objetivas e diretas, conceitos e literalidade, 5 alternativas.',
  IBFC: 'IBFC: lei seca com afirmativas I, II, III e alternativas combinando-as, 4 ou 5 alternativas.',
  Quadrix: 'Quadrix: itens de certo/errado ou múltipla escolha diretos, lei seca e conceitos.',
  AOCP: 'Instituto AOCP: lei seca e jurisprudência, afirmativas I a IV combinadas nas alternativas, 5 alternativas.',
  Consulplan: 'Consulplan: enunciados com casos curtos e cobrança de literalidade, 4 ou 5 alternativas.',
  IDECAN: 'IDECAN: lei seca e conceitos, alternativas "assinale a correta", 4 ou 5 alternativas.',
  Fundatec: 'Fundatec: afirmativas com V/F em sequência ou I, II, III combinadas, lei seca.',
  Objetiva: 'Objetiva: questões diretas de lei seca, 4 ou 5 alternativas.',
};
