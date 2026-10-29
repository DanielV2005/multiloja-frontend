// Alertas do painel montados a partir do quadro de reposicao e das saidas por ajuste (funcoes puras).
import { AjustesProdutoDto, AjustesSaidaDto, ReposicaoItemDto } from '../../core/services/produto.service';
import { formatBRL } from '../../shared/format';
import { fmtQuantidade, textoRitmo } from './estoque/estoque-maximo';
import { detalheTendencia, esperadoRecente, valorTendencia } from './estoque/tendencia';

export interface AlertDialogItem {
  name: string;
  detail: string;
  value?: string;
  /** Destaque curto ao lado do nome (ex.: "Grande"). */
  tag?: string;
  /** Cor do destaque: verde (subiu) ou amarela (caiu); sem, vermelha. */
  tagTone?: 'up' | 'down';
}

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export interface AlertaVendaPerdida {
  itens: AlertDialogItem[];
  valor: number;
  unidades: number;
}

/** Quem ficou sem estoque e deixou de vender nos ultimos 30 dias, do maior valor para o menor. */
export function alertaVendaPerdida(itens: readonly ReposicaoItemDto[]): AlertaVendaPerdida {
  const lista = itens
    .filter(i => i.valorVendaPerdida > 0)
    .sort((a, b) => b.valorVendaPerdida - a.valorVendaPerdida || a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    valor: lista.reduce((s, i) => s + i.valorVendaPerdida, 0),
    unidades: lista.reduce((s, i) => s + i.vendaPerdida, 0),
    itens: lista.map(i => ({
      name: i.nome,
      detail: `${dias(i.diasZeradoRecente)} sem estoque · vende ${textoRitmo(i.giroDiario ?? 0)}` +
        (i.quantidade <= 0 ? ' · ainda está zerado' : ''),
      value: `~${formatBRL(i.valorVendaPerdida)} (${fmtQuantidade(i.vendaPerdida)} un.)`,
    })),
  };
}

export interface AlertaTendencia {
  itens: AlertDialogItem[];
  alta: number;
  queda: number;
}

/**
 * Mudanca brusca nas vendas: primeiro os em alta, de quem acaba antes nesse ritmo (zerado na frente);
 * depois os em queda, de quem mais deixou de vender em relacao ao normal.
 */
export function alertaTendencia(itens: readonly ReposicaoItemDto[], dias: number): AlertaTendencia {
  const porNome = (a: ReposicaoItemDto, b: ReposicaoItemDto) => a.nome.localeCompare(b.nome, 'pt-BR');
  const acabaEm = (i: ReposicaoItemDto) => (i.quantidade <= 0 ? 0 : i.quantidade / i.giroRecente);
  const faltou = (i: ReposicaoItemDto) => esperadoRecente(i) - Math.max(0, i.vendidoRecente);
  const alta = itens.filter(i => i.tendencia === 'ALTA').sort((a, b) => acabaEm(a) - acabaEm(b) || porNome(a, b));
  const queda = itens.filter(i => i.tendencia === 'QUEDA').sort((a, b) => faltou(b) - faltou(a) || porNome(a, b));
  return {
    alta: alta.length,
    queda: queda.length,
    itens: [...alta, ...queda].map(i => ({
      name: i.nome,
      detail: detalheTendencia(i, dias),
      value: valorTendencia(i),
      tag: i.tendencia === 'ALTA' ? 'Em alta' : 'Em queda',
      tagTone: i.tendencia === 'ALTA' ? 'up' : 'down',
    })),
  };
}

export interface AlertaEncalhados {
  itens: AlertDialogItem[];
  /** Quanto custou o que esta parado (produtos sem preco de custo nao somam). */
  valorCusto: number;
}

/** "80 dias com estoque sem vender · última venda em 01/07/2026"; nunca vendeu tambem aparece. */
export function textoSemVender(item: Pick<ReposicaoItemDto, 'diasSemVender' | 'ultimaVenda'>): string {
  const n = item.diasSemVender ?? 0;
  const tempo = n >= 180 ? 'mais de 6 meses' : dias(n);
  return item.ultimaVenda
    ? `${tempo} com estoque sem vender · última venda em ${data(item.ultimaVenda)}`
    : `nunca vendeu (${tempo} com estoque)`;
}

/** Com estoque e sem vender ha 60 dias ou mais, de onde ha mais dinheiro parado. */
export function alertaEncalhados(itens: readonly ReposicaoItemDto[]): AlertaEncalhados {
  const parado = (i: ReposicaoItemDto) => Math.max(0, i.quantidade) * (i.precoCusto || 0);
  const lista = itens
    .filter(i => i.encalhado)
    .sort((a, b) => parado(b) - parado(a) || (b.diasSemVender ?? 0) - (a.diasSemVender ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    valorCusto: lista.reduce((s, i) => s + parado(i), 0),
    itens: lista.map(i => {
      const texto = textoSemVender(i);
      return {
        name: i.nome,
        detail: `${texto.charAt(0).toUpperCase()}${texto.slice(1)} · ${fmtQuantidade(i.quantidade)} em estoque`,
        value: i.precoCusto > 0 ? formatBRL(parado(i)) : 'sem custo',
      };
    }),
  };
}

export interface AlertaAjustes {
  itens: AlertDialogItem[];
  /** Quantos merecem conferencia (grandes ou repetidos). */
  conferir: number;
}

function detalheAjustes(p: AjustesProdutoDto): string {
  const contam = p.ajustes.filter(a => !a.correcaoDeEntrada);
  const correcoes = p.ajustes.length - contam.length;
  const correcao = correcoes
    ? `${correcoes} ${correcoes === 1 ? 'correção' : 'correções'} logo depois de uma entrada (não conta)`
    : '';
  if (!contam.length) return correcao.charAt(0).toUpperCase() + correcao.slice(1);
  const saidas = `${fmtQuantidade(p.quantidade)} un. em ${contam.length} ${contam.length === 1 ? 'saída' : 'saídas'}` +
    (p.dias > 1 ? ` (${dias(p.dias)} diferentes)` : '') +
    ` · última em ${data(contam[0].data)}`;
  return correcao ? `${saidas} · ${correcao}` : saidas;
}

/** Saidas por ajuste do periodo: as para conferir (grandes ou repetidas) vem primeiro, marcadas. */
export function alertaAjustes(dto: AjustesSaidaDto): AlertaAjustes {
  return {
    conferir: dto.produtos.filter(p => p.conferir).length,
    itens: dto.produtos.map(p => ({
      name: p.ativo ? p.nome : `${p.nome} (desativado)`,
      detail: detalheAjustes(p),
      value: p.valor > 0 ? formatBRL(p.valor) : `${fmtQuantidade(p.quantidade)} un.`,
      tag: p.grande && p.repetido ? 'Grande e repetido' : p.grande ? 'Grande' : p.repetido ? 'Repetido' : undefined,
    })),
  };
}
