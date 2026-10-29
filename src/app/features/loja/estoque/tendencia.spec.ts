import { TendenciaVendas } from '../../../core/services/produto.service';
import { detalheTendencia, esperadoRecente, fatorTendencia, resumoTendencia, valorTendencia } from './tendencia';

const t = (over: {
  tendencia?: TendenciaVendas | null; quantidade?: number; vendidoRecente?: number;
  diasComEstoqueRecente?: number; giroRecente?: number; giroAnterior?: number | null;
}) => ({
  tendencia: null, quantidade: 1, vendidoRecente: 0, diasComEstoqueRecente: 14, giroRecente: 0, giroAnterior: null, ...over,
});

describe('mudanca brusca nas vendas (textos)', () => {
  it('em alta: quantas vezes o normal e quando acaba nesse ritmo', () => {
    // 7 em 14 dias (0,5/dia) contra 3 em 90 (0,033/dia)
    const pistola = t({ tendencia: 'ALTA', quantidade: 1, vendidoRecente: 7, giroRecente: 0.5, giroAnterior: 0.033 });

    expect(fatorTendencia(pistola)).toBeCloseTo(15.15, 1);
    expect(valorTendencia(pistola)).toBe('15x o normal');
    expect(resumoTendencia(pistola, 14)).toBe('Em alta: vendeu 7 em 14 dias (antes ~1/mês)');
    expect(detalheTendencia(pistola, 14))
      .toBe('Vendeu 7 nos últimos 14 dias (~3,5/semana) · antes ~1/mês · 1 em estoque: acaba em ~2 dias nesse ritmo');

    expect(valorTendencia(t({ tendencia: 'ALTA', giroRecente: 0.357, giroAnterior: 0.178 }))).toBe('2x o normal');
    expect(valorTendencia(t({ tendencia: 'ALTA', giroRecente: 0.9, giroAnterior: 0.37 }))).toBe('2,4x o normal');
  });

  it('em alta sem vender antes, e que ja acabou com estoque so em parte dos dias', () => {
    const nova = t({ tendencia: 'ALTA', quantidade: 0, vendidoRecente: 6, diasComEstoqueRecente: 9.4, giroRecente: 0.638, giroAnterior: 0 });

    expect(fatorTendencia(nova)).toBeNull();
    expect(valorTendencia(nova)).toBe('começou a vender');
    expect(resumoTendencia(nova, 14)).toBe('Em alta: vendeu 6 em 14 dias (antes não vendia)');
    expect(detalheTendencia(nova, 14))
      .toBe('Vendeu 6 nos últimos 14 dias, com estoque em 9 deles (~4,5/semana) · antes não vendia · acabou');
  });

  it('em queda: parou ou quanto caiu, contra o esperado no ritmo de antes', () => {
    const chiclets = t({ tendencia: 'QUEDA', quantidade: 62, giroAnterior: 0.811 });
    expect(esperadoRecente(chiclets)).toBeCloseTo(11.35, 2);
    expect(valorTendencia(chiclets)).toBe('parou');
    expect(resumoTendencia(chiclets, 14)).toBe('Em queda: não vendeu nos últimos 14 dias (esperado ~11)');
    expect(detalheTendencia(chiclets, 14)).toBe(
      'Vendia ~5,7/semana · nos últimos 14 dias, com estoque o tempo todo, não vendeu nenhum (esperado ~11) · 62 em estoque');

    const cartolina = t({ tendencia: 'QUEDA', quantidade: 124, vendidoRecente: 1, giroRecente: 0.071, giroAnterior: 0.644 });
    expect(valorTendencia(cartolina)).toBe('-89%');
    expect(resumoTendencia(cartolina, 14)).toBe('Em queda: vendeu 1 em 14 dias (esperado ~9)');

    const parcial = t({ tendencia: 'QUEDA', quantidade: 3, vendidoRecente: 1, diasComEstoqueRecente: 8, giroAnterior: 0.5 });
    expect(detalheTendencia(parcial, 14))
      .toBe('Vendia ~3,5/semana · nos últimos 14 dias, com estoque em 8 deles, vendeu 1 (esperado ~4) · 3 em estoque');
  });

  it('sem mudanca, nada a dizer', () => {
    const normal = t({ vendidoRecente: 4, giroRecente: 0.3, giroAnterior: 0.3 });
    expect(valorTendencia(normal)).toBe('');
    expect(resumoTendencia(normal, 14)).toBe('');
    expect(detalheTendencia(normal, 14)).toBe('');
  });
});
