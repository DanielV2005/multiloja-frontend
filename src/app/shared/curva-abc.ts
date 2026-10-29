// Curva ABC pelo faturamento: poucos produtos fazem a maior parte das vendas.
// A = os que, somados, chegam a 80% do faturamento; B = os seguintes, ate 95%; C = o resto.

export type ClasseAbc = 'A' | 'B' | 'C';

export const LIMITE_A = 0.8;
export const LIMITE_B = 0.95;

export interface FaturamentoProduto {
  produtoId: number;
  total: number;
}

/**
 * Classifica do maior faturamento para o menor: o produto e A enquanto o acumulado antes dele nao chegou a 80%
 * (o que cruza a linha ainda e A), B ate 95% e C depois. Sem faturamento e sempre C.
 * O mesmo produto pode vir em mais de uma linha (nome trocado entre vendas): soma antes de classificar.
 */
export function classificarAbc(itens: readonly FaturamentoProduto[]): Map<number, ClasseAbc> {
  const porProduto = new Map<number, number>();
  for (const i of itens) porProduto.set(i.produtoId, (porProduto.get(i.produtoId) ?? 0) + i.total);

  const ordenados = [...porProduto].sort(([idA, a], [idB, b]) => b - a || idA - idB);
  const total = ordenados.reduce((s, [, v]) => s + Math.max(0, v), 0);

  const classes = new Map<number, ClasseAbc>();
  let acumulado = 0;
  for (const [id, valor] of ordenados) {
    const antes = acumulado / total;
    classes.set(id, valor <= 0 ? 'C' : antes < LIMITE_A ? 'A' : antes < LIMITE_B ? 'B' : 'C');
    acumulado += Math.max(0, valor);
  }
  return classes;
}

/** Texto curto para dicas: o que cada classe quer dizer. */
export function textoClasseAbc(classe: ClasseAbc): string {
  switch (classe) {
    case 'A': return 'Curva A: está entre os produtos que fazem 80% do faturamento. Não deixe faltar.';
    case 'B': return 'Curva B: faz parte dos 15% seguintes do faturamento.';
    default: return 'Curva C: vende pouco em dinheiro (os 5% finais do faturamento).';
  }
}
