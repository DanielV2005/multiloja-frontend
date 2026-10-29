import { alertaAjustes, alertaEncalhados, alertaTendencia, alertaVendaPerdida, textoSemVender } from './painel-alertas';
import { AjustesProdutoDto, ReposicaoItemDto } from '../../core/services/produto.service';

const item = (over: Partial<ReposicaoItemDto>): ReposicaoItemDto => ({
  id: 1, nome: 'Produto', codigoBarra: null, setorFilhoId: 1, quantidade: 0, estoqueMaximo: null, maximoAutomatico: null,
  minimo: null, meio: null, maximo: null, precoCusto: 10, precoVenda: 20, margemLucro: 100,
  giroDiario: null, baseGiro: null, diasSemEstoque: 0, diasDeEstoque: null, diasAteMinimo: null,
  sugestaoCompra: 0, excedente: 0, coluna: 'OK', prioridade: 0,
  ultimaMovimentacao: null, ultimaCompra: null, ultimaVenda: null, diasSemVender: null, encalhado: false,
  diasZeradoRecente: 0, vendaPerdida: 0, valorVendaPerdida: 0,
  vendidoRecente: 0, diasComEstoqueRecente: 14, giroRecente: 0, giroAnterior: null, tendencia: null, ...over,
});

const ajustes = (over: Partial<AjustesProdutoDto>): AjustesProdutoDto => ({
  produtoId: 1, nome: 'Gloss', codigoBarra: null, setorId: 1, ativo: true, precoCusto: 2.5,
  quantidade: 0, valor: 0, dias: 0, grande: false, repetido: false, conferir: false, ajustes: [], ...over,
});

const saida = (data: string, quantidade: number, correcaoDeEntrada = false) =>
  ({ data, quantidade, saldoAnterior: 10, saldoPosterior: 10 - quantidade, correcaoDeEntrada });

describe('alertas do painel', () => {
  it('venda perdida: do maior valor para o menor, com dias zerado e ritmo', () => {
    const r = alertaVendaPerdida([
      item({ nome: 'Meia', valorVendaPerdida: 90, vendaPerdida: 9, diasZeradoRecente: 30, giroDiario: 0.3, quantidade: 0 }),
      item({ nome: 'Camiseta', valorVendaPerdida: 250, vendaPerdida: 10, diasZeradoRecente: 10, giroDiario: 1, quantidade: 12 }),
      item({ nome: 'Bone', valorVendaPerdida: 0 }),
    ]);

    expect(r.valor).toBe(340);
    expect(r.unidades).toBe(19);
    expect(r.itens.map(i => i.name)).toEqual(['Camiseta', 'Meia']);
    expect(r.itens[0].detail).toBe('10 dias sem estoque · vende ~1/dia');
    expect(r.itens[1].detail).toBe('30 dias sem estoque · vende ~2,1/semana · ainda está zerado');
    expect(r.itens[0].value).toBe(`~${(250).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (10 un.)`);
  });

  it('mudanca brusca: em alta primeiro (quem acaba antes), depois em queda (quem mais deixou de vender)', () => {
    const r = alertaTendencia([
      item({ nome: 'Bone', tendencia: 'ALTA', quantidade: 23, vendidoRecente: 5, giroRecente: 0.357, giroAnterior: 0.178 }),
      item({ nome: 'Pistola', tendencia: 'ALTA', quantidade: 1, vendidoRecente: 7, giroRecente: 0.5, giroAnterior: 0.033 }),
      item({ nome: 'Cartolina', tendencia: 'QUEDA', quantidade: 124, vendidoRecente: 1, giroRecente: 0.071, giroAnterior: 0.644 }),
      item({ nome: 'Chiclets', tendencia: 'QUEDA', quantidade: 62, giroAnterior: 0.811 }),
      item({ nome: 'Bala', vendidoRecente: 18, giroRecente: 1.286, giroAnterior: 0.789 }),
      item({ nome: 'Acabou', tendencia: 'ALTA', quantidade: 0, vendidoRecente: 6, giroRecente: 0.43, giroAnterior: 0 }),
    ], 14);

    expect(r.alta).toBe(3);
    expect(r.queda).toBe(2);
    expect(r.itens.map(i => [i.name, i.tag, i.tagTone, i.value])).toEqual([
      ['Acabou', 'Em alta', 'up', 'começou a vender'],
      ['Pistola', 'Em alta', 'up', '15x o normal'],
      ['Bone', 'Em alta', 'up', '2x o normal'],
      ['Chiclets', 'Em queda', 'down', 'parou'],
      ['Cartolina', 'Em queda', 'down', '-89%'],
    ]);
    expect(r.itens[1].detail).toContain('1 em estoque: acaba em ~2 dias nesse ritmo');
    expect(r.itens[3].detail).toContain('não vendeu nenhum (esperado ~11)');
    expect(alertaTendencia([item({})], 14)).toEqual({ itens: [], alta: 0, queda: 0 });
  });

  it('encalhados: onde ha mais dinheiro parado primeiro; nunca vendeu e mais de 6 meses', () => {
    const r = alertaEncalhados([
      item({ nome: 'Salto', encalhado: true, quantidade: 11, precoCusto: 28, diasSemVender: 128, ultimaVenda: '2026-06-23T15:00:00Z' }),
      item({ nome: 'Saco presente', encalhado: true, quantidade: 299, precoCusto: 0.5, diasSemVender: 180, ultimaVenda: null }),
      item({ nome: 'Sem custo', encalhado: true, quantidade: 3, precoCusto: 0, diasSemVender: 70, ultimaVenda: null }),
      item({ nome: 'Vende', encalhado: false, quantidade: 50 }),
    ]);

    expect(r.valorCusto).toBe(308 + 149.5);
    expect(r.itens.map(i => i.name)).toEqual(['Salto', 'Saco presente', 'Sem custo']);
    expect(r.itens[0].detail).toBe('128 dias com estoque sem vender · última venda em 23/06/2026 · 11 em estoque');
    expect(r.itens[1].detail).toBe('Nunca vendeu (mais de 6 meses com estoque) · 299 em estoque');
    expect(r.itens[2].value).toBe('sem custo');
    expect(textoSemVender({ diasSemVender: 1, ultimaVenda: null })).toBe('nunca vendeu (1 dia com estoque)');
  });

  it('saidas por ajuste: marca grande/repetido, conta so as que contam e explica as correcoes', () => {
    const r = alertaAjustes({
      dias: 90, valorGrande: 50, quantidade: 37, valor: 115,
      produtos: [
        ajustes({ nome: 'Gloss', quantidade: 34, valor: 85, dias: 1, grande: true, conferir: true,
          ajustes: [saida('2026-09-28T15:21:00Z', 34)] }),
        ajustes({ nome: 'Relogio', quantidade: 2, valor: 30, dias: 2, repetido: true, conferir: true, ativo: false,
          ajustes: [saida('2026-10-23T15:00:00Z', 1), saida('2026-08-29T15:00:00Z', 1)] }),
        ajustes({ nome: 'Cadeado', quantidade: 1, valor: 6, dias: 1,
          ajustes: [saida('2026-09-15T17:30:00Z', 1), saida('2026-09-15T17:29:00Z', 10, true)] }),
        ajustes({ nome: 'Bala', quantidade: 0, valor: 0, ajustes: [saida('2026-10-01T12:00:00Z', 5, true)] }),
      ],
    });

    expect(r.conferir).toBe(2);
    expect(r.itens.map(i => [i.name, i.tag])).toEqual([
      ['Gloss', 'Grande'], ['Relogio (desativado)', 'Repetido'], ['Cadeado', undefined], ['Bala', undefined],
    ]);
    expect(r.itens[0].detail).toBe('34 un. em 1 saída · última em 28/09/2026');
    expect(r.itens[1].detail).toBe('2 un. em 2 saídas (2 dias diferentes) · última em 23/10/2026');
    expect(r.itens[2].detail).toBe('1 un. em 1 saída · última em 15/09/2026 · 1 correção logo depois de uma entrada (não conta)');
    expect(r.itens[3].detail).toBe('1 correção logo depois de uma entrada (não conta)');
    expect(r.itens[3].value).toBe('0 un.');
  });
});
