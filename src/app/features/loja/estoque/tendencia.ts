// Mudanca brusca nas vendas (as 2 ultimas semanas contra os 3 meses antes delas, calculada no Catalogo):
// textos do painel, do quadro de reposicao e da lista de compra.
import { ReposicaoItemDto } from '../../../core/services/produto.service';
import { formatDecimal } from '../../../shared/format';
import { fmtQuantidade, textoDuracao, textoRitmo } from './estoque-maximo';

type ItemTendencia = Pick<
  ReposicaoItemDto,
  'quantidade' | 'tendencia' | 'vendidoRecente' | 'diasComEstoqueRecente' | 'giroRecente' | 'giroAnterior'
>;

/** Quantas vezes o ritmo de antes (null quando antes nao vendia). */
export function fatorTendencia(item: ItemTendencia): number | null {
  return item.giroAnterior ? item.giroRecente / item.giroAnterior : null;
}

/** Quanto venderia nos dias com estoque das ultimas semanas, no ritmo de antes. */
export function esperadoRecente(item: ItemTendencia): number {
  return (item.giroAnterior ?? 0) * item.diasComEstoqueRecente;
}

const esperado = (item: ItemTendencia) => {
  const n = esperadoRecente(item);
  return `~${formatDecimal(n, 0, n < 10 ? 1 : 0)}`;
};

/** Em alta: "2,4x o normal" ou "começou a vender". Em queda: "parou" ou quanto caiu ("-70%"). */
export function valorTendencia(item: ItemTendencia): string {
  if (item.tendencia === 'ALTA') {
    const f = fatorTendencia(item);
    return f == null ? 'começou a vender' : `${formatDecimal(f, 0, f < 10 ? 1 : 0)}x o normal`;
  }
  if (item.tendencia !== 'QUEDA') return '';
  if (item.vendidoRecente <= 0) return 'parou';
  const n = esperadoRecente(item);
  return n > 0 ? `-${Math.round((1 - item.vendidoRecente / n) * 100)}%` : '';
}

const antes = (item: ItemTendencia) => (item.giroAnterior ? `antes ${textoRitmo(item.giroAnterior)}` : 'antes não vendia');

/**
 * Linha curta do cartao do quadro: "Em alta: vendeu 7 em 14 dias (antes ~1/mês)". Sem o "15x": ao lado da media
 * de 3 meses do cartao (que ja inclui a alta), a conta confundiria.
 */
export function resumoTendencia(item: ItemTendencia, dias: number): string {
  if (item.tendencia === 'ALTA') {
    return `Em alta: vendeu ${fmtQuantidade(item.vendidoRecente)} em ${dias} dias (${antes(item)})`;
  }
  if (item.tendencia === 'QUEDA') {
    return item.vendidoRecente <= 0
      ? `Em queda: não vendeu nos últimos ${dias} dias (esperado ${esperado(item)})`
      : `Em queda: vendeu ${fmtQuantidade(item.vendidoRecente)} em ${dias} dias (esperado ${esperado(item)})`;
  }
  return '';
}

/** Explicacao completa: o ritmo agora e antes, e o que isso faz com o estoque. */
export function detalheTendencia(item: ItemTendencia, dias: number): string {
  const inteiro = item.diasComEstoqueRecente >= dias - 0.5;
  const diasComEstoque = Math.round(item.diasComEstoqueRecente);
  if (item.tendencia === 'ALTA') {
    const periodo = inteiro ? '' : `, com estoque em ${diasComEstoque} deles`;
    const fim = item.quantidade <= 0
      ? 'acabou'
      : `${fmtQuantidade(item.quantidade)} em estoque: acaba em ${textoDuracao(item.quantidade / item.giroRecente)} nesse ritmo`;
    return `Vendeu ${fmtQuantidade(item.vendidoRecente)} nos últimos ${dias} dias${periodo} ` +
      `(${textoRitmo(item.giroRecente)}) · ${antes(item)} · ${fim}`;
  }
  if (item.tendencia === 'QUEDA') {
    const periodo = inteiro ? 'com estoque o tempo todo' : `com estoque em ${diasComEstoque} deles`;
    const vendeu = item.vendidoRecente <= 0 ? 'não vendeu nenhum' : `vendeu ${fmtQuantidade(item.vendidoRecente)}`;
    return `Vendia ${textoRitmo(item.giroAnterior ?? 0)} · nos últimos ${dias} dias, ${periodo}, ` +
      `${vendeu} (esperado ${esperado(item)}) · ${fmtQuantidade(item.quantidade)} em estoque`;
  }
  return '';
}
