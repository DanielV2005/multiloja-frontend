// Lista de compra: filtros sobre o quadro de reposicao, quantidade a comprar (sugestao ou digitada) e o texto
// para mandar ao fornecedor. Funcoes puras; a tela guarda a selecao e chama estas.
import { ReposicaoColuna, ReposicaoItemDto, TendenciaVendas } from '../../../core/services/produto.service';
import { ClasseAbc } from '../../../shared/curva-abc';
import { formatDecimal } from '../../../shared/format';
import { semAcento } from './mais-vendidos';

export type SituacaoCompra = Extract<ReposicaoColuna, 'SEM_ESTOQUE' | 'REPOR' | 'ATENCAO' | 'OK' | 'SEM_HISTORICO'>;

export const SITUACOES_COMPRA: ReadonlyArray<{ id: SituacaoCompra; rotulo: string; dica: string }> = [
  { id: 'SEM_ESTOQUE', rotulo: 'Sem estoque', dica: 'Acabou' },
  { id: 'REPOR', rotulo: 'Repor', dica: 'Abaixo do mínimo' },
  { id: 'ATENCAO', rotulo: 'Atenção', dica: 'Abaixo do meio ou acaba em menos de 2 semanas' },
  { id: 'OK', rotulo: 'Em dia', dica: 'Não precisa comprar agora (digite uma quantidade para incluir)' },
  { id: 'SEM_HISTORICO', rotulo: 'Sem vendas', dica: 'Sem vendas nos últimos 6 meses' },
];

export const SITUACOES_PADRAO: readonly SituacaoCompra[] = ['SEM_ESTOQUE', 'REPOR', 'ATENCAO'];

/** Mudanca brusca nas vendas das ultimas semanas (calculada no Catalogo). */
export const TENDENCIAS_COMPRA: ReadonlyArray<{ id: TendenciaVendas; rotulo: string; dica: string }> = [
  {
    id: 'ALTA',
    rotulo: '↑ Em alta',
    dica: 'Vendendo o dobro ou mais nas últimas semanas: a sugestão, pela média de 3 meses, pode ser pouca',
  },
  {
    id: 'QUEDA',
    rotulo: '↓ Em queda',
    dica: 'Com estoque, vendeu um terço ou menos do normal nas últimas semanas: confira antes de comprar mais',
  },
];

/** Classe da curva ABC ou "sem venda" (nao vendeu nos ultimos 90 dias). */
export type FiltroCurva = ClasseAbc | 'SEM_VENDA';

export type OrdemCompra = 'prioridade' | 'nome' | 'setor' | 'valor';

export interface FiltrosCompra {
  situacoes: ReadonlySet<SituacaoCompra>;
  /** Vazio = todas. */
  curvas: ReadonlySet<FiltroCurva>;
  /** Vazio = todos (com ou sem mudanca nas vendas). */
  tendencias: ReadonlySet<TendenciaVendas>;
  setorId: number | null;
  busca: string;
  ordem: OrdemCompra;
}

export function filtrosCompraPadrao(): FiltrosCompra {
  return {
    situacoes: new Set(SITUACOES_PADRAO), curvas: new Set(), tendencias: new Set(), setorId: null, busca: '', ordem: 'prioridade',
  };
}

export function curvaDoItem(item: ReposicaoItemDto, curva: ReadonlyMap<number, ClasseAbc> | null): FiltroCurva | null {
  if (!curva) return null;
  return curva.get(item.id) ?? 'SEM_VENDA';
}

/** Digitada pelo usuario ou, se nao, a sugestao do quadro (o que falta para chegar no maximo). */
export function quantidadeDe(item: ReposicaoItemDto, digitadas: ReadonlyMap<number, number>): number {
  return digitadas.get(item.id) ?? item.sugestaoCompra;
}

/** Custo da compra (quantidade x preco de custo). */
export function valorDe(item: ReposicaoItemDto, digitadas: ReadonlyMap<number, number>): number {
  return quantidadeDe(item, digitadas) * (item.precoCusto || 0);
}

export function filtrarCompra(
  itens: readonly ReposicaoItemDto[],
  f: FiltrosCompra,
  curva: ReadonlyMap<number, ClasseAbc> | null,
  digitadas: ReadonlyMap<number, number>,
  nomeSetor: (id: number) => string
): ReposicaoItemDto[] {
  const termo = semAcento(f.busca.trim());
  const filtrados = itens.filter(i =>
    f.situacoes.has(i.coluna as SituacaoCompra) &&
    (f.setorId == null || i.setorFilhoId === f.setorId) &&
    (!f.curvas.size || !curva || f.curvas.has(curvaDoItem(i, curva)!)) &&
    (!f.tendencias.size || (i.tendencia != null && f.tendencias.has(i.tendencia))) &&
    (!termo || semAcento(`${i.nome} ${i.codigoBarra ?? ''}`).includes(termo)));

  const porNome = (a: ReposicaoItemDto, b: ReposicaoItemDto) => a.nome.localeCompare(b.nome, 'pt-BR');
  switch (f.ordem) {
    case 'nome':
      return filtrados.sort(porNome);
    case 'setor':
      return filtrados.sort((a, b) => nomeSetor(a.setorFilhoId).localeCompare(nomeSetor(b.setorFilhoId), 'pt-BR') || porNome(a, b));
    case 'valor':
      return filtrados.sort((a, b) => valorDe(b, digitadas) - valorDe(a, digitadas) || porNome(a, b));
    default:
      // O servidor ja manda por prioridade (empate: quem vende mais)
      return filtrados;
  }
}

/**
 * Quantos em alta e em queda aparecem com os outros filtros (situacao, curva, setor e busca): o numero do botao
 * e o que aparece ao clicar nele. O "em dia" so entra se a situacao estiver marcada.
 */
export function contarTendencias(
  itens: readonly ReposicaoItemDto[],
  f: FiltrosCompra,
  curva: ReadonlyMap<number, ClasseAbc> | null,
  nomeSetor: (id: number) => string
): Map<TendenciaVendas, number> {
  const contagem = new Map<TendenciaVendas, number>();
  for (const i of filtrarCompra(itens, { ...f, tendencias: new Set(), ordem: 'prioridade' }, curva, new Map(), nomeSetor)) {
    if (i.tendencia) contagem.set(i.tendencia, (contagem.get(i.tendencia) ?? 0) + 1);
  }
  return contagem;
}

export interface ItemLista {
  nome: string;
  codigoBarra: string | null;
  setor: string;
  quantidade: number;
  custo: number;
}

export interface GrupoLista {
  setor: string;
  itens: ItemLista[];
  total: number;
}

/** Itens selecionados, por setor (em ordem alfabetica) e por nome dentro de cada um. */
export function agruparPorSetor(itens: readonly ItemLista[]): GrupoLista[] {
  const grupos = new Map<string, ItemLista[]>();
  for (const i of itens) grupos.set(i.setor, [...(grupos.get(i.setor) ?? []), i]);
  return [...grupos]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([setor, lista]) => ({
      setor,
      itens: [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      total: lista.reduce((s, i) => s + i.quantidade * i.custo, 0),
    }));
}

const qtd = (v: number) => formatDecimal(v, 0, 3);

/**
 * Texto para colar no WhatsApp ou e-mail do fornecedor: quantidade e produto, sem custo.
 * Ex.: "28 un — CAMISETA (cód. 789...)".
 */
export function textoListaCompra(itens: readonly ItemLista[], loja: string, data: string): string {
  const grupos = agruparPorSetor(itens);
  const linhas = [`Lista de compra${loja ? ' — ' + loja : ''} — ${data}`, ''];
  for (const g of grupos) {
    if (grupos.length > 1) linhas.push(`*${g.setor}*`);
    for (const i of g.itens) {
      linhas.push(`${qtd(i.quantidade)} un — ${i.nome}${i.codigoBarra ? ` (cód. ${i.codigoBarra})` : ''}`);
    }
    if (grupos.length > 1) linhas.push('');
  }
  const unidades = itens.reduce((s, i) => s + i.quantidade, 0);
  if (linhas[linhas.length - 1] !== '') linhas.push('');
  linhas.push(`Total: ${itens.length} ${itens.length === 1 ? 'produto' : 'produtos'}, ${qtd(unidades)} ${unidades === 1 ? 'unidade' : 'unidades'}`);
  return linhas.join('\n');
}
