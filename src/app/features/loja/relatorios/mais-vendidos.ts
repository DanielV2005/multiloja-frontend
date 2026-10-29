// Ranking de mais vendidos: junta o resumo de vendas do PDV com o catalogo, calcula a curva ABC e aplica os filtros.
// Tudo aqui e funcao pura: a tela so pede os dados de novo quando o periodo muda; o resto filtra na memoria.
import { SaleItemSummaryDto } from '../../../core/services/pdv.service';
import { ReposicaoColuna, ReposicaoItemDto } from '../../../core/services/produto.service';
import { ehProduto } from '../../../core/services/curva-abc.service';
import { ClasseAbc, classificarAbc } from '../../../shared/curva-abc';
import { isoLocal, ultimosDias } from '../../../shared/datas';

export type AtalhoPeriodo = 'hoje' | '7d' | '30d' | '90d' | 'mes' | 'mes-passado' | 'ano';

export const ATALHOS_PERIODO: ReadonlyArray<{ id: AtalhoPeriodo; rotulo: string }> = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: '7d', rotulo: '7 dias' },
  { id: '30d', rotulo: '30 dias' },
  { id: '90d', rotulo: '90 dias' },
  { id: 'mes', rotulo: 'Este mês' },
  { id: 'mes-passado', rotulo: 'Mês passado' },
  { id: 'ano', rotulo: 'Este ano' },
];

export function periodoDoAtalho(atalho: AtalhoPeriodo, hoje = new Date()): { inicio: string; fim: string } {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  switch (atalho) {
    case 'hoje': return { inicio: isoLocal(hoje), fim: isoLocal(hoje) };
    case '7d': return ultimosDias(7, hoje);
    case '30d': return ultimosDias(30, hoje);
    case '90d': return ultimosDias(90, hoje);
    case 'mes': return { inicio: isoLocal(new Date(ano, mes, 1)), fim: isoLocal(hoje) };
    case 'mes-passado': return { inicio: isoLocal(new Date(ano, mes - 1, 1)), fim: isoLocal(new Date(ano, mes, 0)) };
    case 'ano': return { inicio: isoLocal(new Date(ano, 0, 1)), fim: isoLocal(hoje) };
  }
}

export type TipoItem = 'PRODUTO' | 'SERVICO';

export interface LinhaRanking {
  /** Produto e servico podem ter o mesmo id: a chave junta os dois. */
  chave: string;
  produtoId: number;
  tipo: TipoItem;
  nome: string;
  codigoBarra: string | null;
  setorId: number | null;
  quantidade: number;
  total: number;
  /** Fatia do faturamento do tipo no periodo (0 a 1). */
  percentual: number;
  classe: ClasseAbc;
  /** null = servico ou produto que nao esta mais ativo. */
  estoque: number | null;
  coluna: ReposicaoColuna | null;
  /** Nome e codigo sem acento e em minusculas, para a busca. */
  busca: string;
}

export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Uma linha por produto (ou servico) vendido no periodo, com setor, codigo e estoque do catalogo.
 * Curva ABC e percentual sao calculados dentro de cada tipo. Item todo devolvido (quantidade 0) fica de fora.
 */
export function montarRanking(resumo: readonly SaleItemSummaryDto[], catalogo: readonly ReposicaoItemDto[]): LinhaRanking[] {
  const produtos = new Map(catalogo.map(p => [p.id, p]));
  const somas = new Map<string, { tipo: TipoItem; produtoId: number; nome: string; quantidade: number; total: number }>();
  for (const r of resumo) {
    const tipo: TipoItem = ehProduto(r) ? 'PRODUTO' : 'SERVICO';
    const chave = `${tipo}:${r.produtoId}`;
    const soma = somas.get(chave) ?? { tipo, produtoId: r.produtoId, nome: r.nome, quantidade: 0, total: 0 };
    soma.quantidade += Number(r.quantidade) || 0;
    soma.total += Number(r.total) || 0;
    somas.set(chave, soma);
  }

  const vendidos = [...somas].filter(([, s]) => s.quantidade > 0);
  const linhas: LinhaRanking[] = [];
  for (const tipo of ['PRODUTO', 'SERVICO'] as const) {
    const doTipo = vendidos.filter(([, s]) => s.tipo === tipo);
    const totalTipo = doTipo.reduce((t, [, s]) => t + Math.max(0, s.total), 0);
    const classes = classificarAbc(doTipo.map(([, s]) => ({ produtoId: s.produtoId, total: s.total })));
    for (const [chave, s] of doTipo) {
      const p = tipo === 'PRODUTO' ? produtos.get(s.produtoId) : undefined;
      const nome = p?.nome ?? s.nome;
      const codigoBarra = p?.codigoBarra ?? null;
      linhas.push({
        chave,
        produtoId: s.produtoId,
        tipo,
        nome,
        codigoBarra,
        setorId: p?.setorFilhoId ?? null,
        quantidade: s.quantidade,
        total: s.total,
        percentual: totalTipo > 0 ? Math.max(0, s.total) / totalTipo : 0,
        classe: classes.get(s.produtoId) ?? 'C',
        estoque: p ? p.quantidade : null,
        coluna: p?.coluna ?? null,
        busca: semAcento(`${nome} ${codigoBarra ?? ''}`),
      });
    }
  }
  return linhas;
}

export type OrdemRanking = 'quantidade' | 'faturamento';

export interface FiltrosRanking {
  tipo: TipoItem | 'TODOS';
  busca: string;
  setorId: number | null;
  classe: ClasseAbc | null;
  ordem: OrdemRanking;
  /** null = todos. */
  limite: number | null;
}

export const FILTROS_PADRAO: FiltrosRanking = {
  tipo: 'PRODUTO',
  busca: '',
  setorId: null,
  classe: null,
  ordem: 'quantidade',
  limite: 50,
};

export type LinhaVisivel = LinhaRanking & { posicao: number };

export interface RankingFiltrado {
  linhas: LinhaVisivel[];
  /** Quantos passaram nos filtros (antes do limite). */
  encontrados: number;
  quantidade: number;
  total: number;
}

export function ordenarRanking(ordem: OrdemRanking): (a: LinhaRanking, b: LinhaRanking) => number {
  return ordem === 'quantidade'
    ? (a, b) => b.quantidade - a.quantidade || b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR')
    : (a, b) => b.total - a.total || b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR');
}

/**
 * A posicao e a do ranking do tipo escolhido, antes da busca, do setor e da curva:
 * buscando "caneta", a linha mostra em que lugar ela esta entre todos os vendidos.
 */
export function filtrarRanking(linhas: readonly LinhaRanking[], f: FiltrosRanking): RankingFiltrado {
  const termo = semAcento(f.busca.trim());
  const ranking = linhas
    .filter(l => f.tipo === 'TODOS' || l.tipo === f.tipo)
    .sort(ordenarRanking(f.ordem))
    .map((l, i): LinhaVisivel => ({ ...l, posicao: i + 1 }));
  const filtradas = ranking.filter(l =>
    (f.setorId == null || l.setorId === f.setorId) &&
    (f.classe == null || l.classe === f.classe) &&
    (!termo || l.busca.includes(termo)));
  return {
    linhas: f.limite ? filtradas.slice(0, f.limite) : filtradas,
    encontrados: filtradas.length,
    quantidade: filtradas.reduce((s, l) => s + l.quantidade, 0),
    total: filtradas.reduce((s, l) => s + l.total, 0),
  };
}

export interface ResumoClasse {
  classe: ClasseAbc;
  itens: number;
  total: number;
  /** Fatia do faturamento (0 a 1). */
  percentual: number;
}

/** Quantos itens e quanto do faturamento ficam em cada classe (do tipo escolhido; "todos" junta os dois). */
export function resumirCurva(linhas: readonly LinhaRanking[], tipo: FiltrosRanking['tipo']): ResumoClasse[] {
  const doTipo = linhas.filter(l => tipo === 'TODOS' || l.tipo === tipo);
  const total = doTipo.reduce((s, l) => s + Math.max(0, l.total), 0);
  return (['A', 'B', 'C'] as const).map(classe => {
    const daClasse = doTipo.filter(l => l.classe === classe);
    const soma = daClasse.reduce((s, l) => s + Math.max(0, l.total), 0);
    return { classe, itens: daClasse.length, total: soma, percentual: total > 0 ? soma / total : 0 };
  });
}
