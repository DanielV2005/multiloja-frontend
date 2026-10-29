import { classificarAbc } from './curva-abc';

describe('classificarAbc', () => {
  it('A ate 80% do faturamento (quem cruza a linha ainda e A), B ate 95%, C o resto', () => {
    const curva = classificarAbc([
      { produtoId: 1, total: 500 },   // 0% antes -> A (50%)
      { produtoId: 2, total: 250 },   // 50% antes -> A (75%)
      { produtoId: 3, total: 100 },   // 75% antes -> A (cruza: 85%)
      { produtoId: 4, total: 80 },    // 85% antes -> B (93%)
      { produtoId: 5, total: 40 },    // 93% antes -> B (97%)
      { produtoId: 6, total: 30 },    // 97% antes -> C
    ]);

    expect([1, 2, 3, 4, 5, 6].map(id => curva.get(id))).toEqual(['A', 'A', 'A', 'B', 'B', 'C']);
  });

  it('soma o mesmo produto em varias linhas e deixa sem faturamento em C', () => {
    const curva = classificarAbc([
      { produtoId: 7, total: 10 },
      { produtoId: 8, total: 60 },
      { produtoId: 7, total: 60 },    // nome trocado entre vendas: mesmo produto, 70 no total
      { produtoId: 9, total: 0 },
    ]);

    expect(curva.get(7)).toBe('A');
    expect(curva.get(8)).toBe('A');   // 70 antes de 130 = 54%
    expect(curva.get(9)).toBe('C');
    expect(curva.size).toBe(3);
  });

  it('lista vazia ou tudo zerado nao quebra', () => {
    expect(classificarAbc([]).size).toBe(0);
    expect(classificarAbc([{ produtoId: 1, total: 0 }]).get(1)).toBe('C');
  });
});
