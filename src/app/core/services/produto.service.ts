// src/app/core/services/produto.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Produto retornado pelos endpoints de listagem
 * (ativos / desativados / etc.)
 */
export interface Produto {
  // backend precisa enviar esse id para permitir edição / desativação
  id?: number;
  ativo?: boolean;

  setorFilhoId: number;
  nome: string;
  precoCusto: number;
  precoVenda: number;
  quantidade: number;
  margemLucro: number;
  codigoBarra: string | null;
  /** Estoque maximo digitado (minimo = 1/4, meio = 1/2): null = automatico pelas vendas; 0 = nao acompanhar. */
  estoqueMaximo?: number | null;
}

/** Colunas do quadro de reposicao, da mais urgente para a menos urgente. */
export type ReposicaoColuna =
  | 'SEM_ESTOQUE'
  | 'REPOR'
  | 'ATENCAO'
  | 'OK'
  | 'EXCESSO'
  | 'SEM_HISTORICO'
  | 'NAO_MONITORADO';

/** De onde saiu o ritmo de vendas: media de 3 meses, ou de 6 meses quando vendeu menos de 3 nos ultimos 3. */
export type ReposicaoBaseGiro = 'TRIMESTRE' | 'SEMESTRE';

/** Mudanca brusca nas vendas das 2 ultimas semanas: em alta (dobro ou mais) ou em queda (um terco ou menos). */
export type TendenciaVendas = 'ALTA' | 'QUEDA';

export interface ReposicaoItemDto {
  id: number;
  nome: string;
  codigoBarra?: string | null;
  setorFilhoId: number;
  quantidade: number;
  /** Digitado pelo usuario (null = automatico). */
  estoqueMaximo?: number | null;
  /** Pelas vendas (null = sem vendas para calcular). */
  maximoAutomatico?: number | null;
  /** null = sem historico ou nao acompanhado. */
  minimo?: number | null;
  meio?: number | null;
  /** O que vale: digitado ou automatico. */
  maximo?: number | null;
  precoCusto: number;
  precoVenda: number;
  margemLucro: number;
  /** null = sem vendas em 6 meses. */
  giroDiario?: number | null;
  baseGiro?: ReposicaoBaseGiro | null;
  /** Dias zerado no periodo usado (nao entram na media). */
  diasSemEstoque: number;
  diasDeEstoque?: number | null;
  diasAteMinimo?: number | null;
  /** Quanto comprar para chegar no maximo. */
  sugestaoCompra: number;
  /** Quanto passa do maximo. */
  excedente: number;
  coluna: ReposicaoColuna;
  /** 0 a 100: 60% pelo quanto falta para o minimo + 40% pela rapidez com que vai acabar. */
  prioridade: number;
  ultimaMovimentacao?: string | null;
  ultimaCompra?: string | null;
  ultimaVenda?: string | null;
  /** Dias com estoque desde a ultima venda (ou desde que o produto existe), ate 180; null = nao da para saber. */
  diasSemVender?: number | null;
  /** Com estoque e `diasEncalhado` dias ou mais sem vender. */
  encalhado: boolean;
  /** Dias sem estoque nos ultimos `diasVendaPerdida` dias. */
  diasZeradoRecente: number;
  /** Estimativa do que deixou de vender nesses dias (unidades e R$ pelo preco de venda). */
  vendaPerdida: number;
  valorVendaPerdida: number;
  /** Vendido (menos devolucoes) nos ultimos `diasTendencia` dias e quantos deles o produto teve estoque. */
  vendidoRecente: number;
  diasComEstoqueRecente: number;
  /** Por dia nesses dias e nos 3 meses antes deles, so nos dias com estoque (null = pouco tempo para comparar). */
  giroRecente: number;
  giroAnterior?: number | null;
  tendencia?: TendenciaVendas | null;
}

export interface ReposicaoDto {
  /** Minimo, meio e maximo automaticos, em dias de venda (7, 14 e 28). */
  diasMinimo: number;
  diasMeio: number;
  diasMaximo: number;
  /** Janela da venda perdida (30) e dias sem vender para ser encalhado (60). */
  diasVendaPerdida: number;
  diasEncalhado: number;
  /** Dias recentes comparados com os 3 meses antes deles na mudanca brusca (14). */
  diasTendencia: number;
  itens: ReposicaoItemDto[];
}

export interface AjusteSaidaDto {
  data: string;
  quantidade: number;
  saldoAnterior: number;
  saldoPosterior: number;
  /** Logo depois de uma entrada do mesmo produto: correcao, nao conta nas somas nem nos alertas. */
  correcaoDeEntrada: boolean;
}

export interface AjustesProdutoDto {
  produtoId: number;
  nome: string;
  codigoBarra?: string | null;
  setorId: number;
  ativo: boolean;
  precoCusto: number;
  quantidade: number;
  /** Quantidade x preco de custo. */
  valor: number;
  /** Dias diferentes com saida por ajuste. */
  dias: number;
  grande: boolean;
  repetido: boolean;
  /** Grande ou repetido. */
  conferir: boolean;
  /** Do mais recente para o mais antigo. */
  ajustes: AjusteSaidaDto[];
}

export interface AjustesSaidaDto {
  dias: number;
  /** A partir de quanto, pelo custo, uma saida e grande. */
  valorGrande: number;
  quantidade: number;
  valor: number;
  /** Os para conferir primeiro, depois pelo valor. */
  produtos: AjustesProdutoDto[];
}

/**
 * DTO para criação/atualização de produto
 * (POST /api/Produtos e PUT /api/Produtos/{id})
 *
 * {
 *   "codigoBarra": "string",
 *   "setorId": 0,
 *   "nome": "string",
 *   "precoCusto": 0,
 *   "precoVenda": 0,
 *   "quantidade": 0,
 *   "ativo": true
 * }
 */
export interface SalvarProdutoRequest {
  codigoBarra: string | null;
  setorId: number;
  nome: string;
  precoCusto: number;
  precoVenda: number;
  quantidade: number;
  ativo: boolean;
}

export enum EstoqueMovimentoTipo {
  Entrada = 1,
  Saida = 2,
}

export enum EstoqueMovimentoMotivo {
  Compra = 1,
  DevolucaoCliente = 2,
  TransferenciaRecebida = 3,
  TransferenciaEnviada = 4,
  Venda = 5,
  Perda = 6,
  Avaria = 7,
  Roubo = 8,
  Vencimento = 9,
  ConsumoInterno = 10,
  Ajuste = 11,
  Defeito = 12,
  Troca = 13,
}

export interface EstoqueMovimentoRequest {
  produtoId: number;
  tipo: EstoqueMovimentoTipo;
  motivo: EstoqueMovimentoMotivo;
  quantidade: number;
  referenciaTipo?: string | null;
  referenciaId?: string | null;
  observacao?: string | null;
}

export interface EstoqueMovimentoDto {
  id: number;
  lojaId: number;
  produtoId: number;
  tipo: EstoqueMovimentoTipo;
  motivo: EstoqueMovimentoMotivo;
  quantidade: number;
  saldoAnterior: number;
  saldoPosterior: number;
  referenciaTipo?: string | null;
  referenciaId?: string | null;
  observacao?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface TransferenciaEstoqueRequest {
  produtoIdOrigem: number;
  lojaDestinoId: number;
  produtoIdDestino: number;
  quantidade: number;
  observacao?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProdutoService {
  private readonly api = `${environment.apiBase.catalogo}/api/Produtos`;
  private readonly estoqueMovimentosApi = `${environment.apiBase.catalogo}/api/estoque/movimentos`;
  private readonly estoqueTransferenciasApi = `${environment.apiBase.catalogo}/api/estoque/transferencias`;

  constructor(private http: HttpClient) {}

  private normalizeList<T>(res: unknown): T[] {
    if (Array.isArray(res)) return res as T[];
    const items = (res as { items?: T[] })?.items;
    if (Array.isArray(items)) return items;
    const data = (res as { data?: T[] })?.data;
    if (Array.isArray(data)) return data;
    return [];
  }

  /**
   * GET /api/Produtos/ativos
   */
  listar(filtro?: string): Observable<Produto[]> {
    let params = new HttpParams();
    if (filtro && filtro.trim().length > 0) {
      params = params.set('filtro', filtro.trim());
    }

    return this.http
      .get<Produto[] | { items?: Produto[] } | { data?: Produto[] }>(`${this.api}/ativos`, {
        params,
        responseType: 'json' as const,
      })
      .pipe(map(res => this.normalizeList<Produto>(res)));
  }

  /**
   * GET /api/Produtos/loja/{lojaId}/ativos
   */
  listarPorLoja(lojaId: number, filtro?: string): Observable<Produto[]> {
    let params = new HttpParams();
    if (filtro && filtro.trim().length > 0) {
      params = params.set('filtro', filtro.trim());
    }
    return this.http
      .get<Produto[] | { items?: Produto[] } | { data?: Produto[] }>(`${this.api}/loja/${lojaId}/ativos`, {
        params,
        responseType: 'json' as const,
      })
      .pipe(map(res => this.normalizeList<Produto>(res)));
  }

  /**
   * GET /api/Produtos/desativados
   */
  listarDesativados(filtro?: string): Observable<Produto[]> {
    let params = new HttpParams();
    if (filtro && filtro.trim().length > 0) {
      params = params.set('filtro', filtro.trim());
    }

    return this.http
      .get<Produto[] | { items?: Produto[] } | { data?: Produto[] }>(`${this.api}/desativados`, {
        params,
        responseType: 'json' as const,
      })
      .pipe(map(res => this.normalizeList<Produto>(res)));
  }

  /**
   * POST /api/Produtos
   */
  criar(dto: SalvarProdutoRequest): Observable<void> {
    return this.http.post<void>(this.api, dto);
  }

  /**
   * PUT /api/Produtos/{id}
   */
  atualizar(id: number, dto: SalvarProdutoRequest): Observable<void> {
    return this.http.put<void>(`${this.api}/${id}`, dto);
  }

  /**
   * PUT /api/Produtos/{id}/estoque-maximo
   * (null = volta para o maximo automatico; 0 = nao acompanhar)
   */
  definirEstoqueMaximo(id: number, estoqueMaximo: number | null): Observable<void> {
    return this.http.put<void>(`${this.api}/${id}/estoque-maximo`, { estoqueMaximo });
  }

  /**
   * GET /api/Produtos/reposicao
   * Produtos ativos da loja selecionada com minimo/meio/maximo, coluna do quadro, giro de vendas e prioridade.
   */
  listarReposicao(): Observable<ReposicaoDto> {
    return this.http.get<ReposicaoDto>(`${this.api}/reposicao`);
  }

  /**
   * DELETE /api/Produtos/{id}
   * (desativar)
   */
  desativar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  /**
   * POST /api/Produtos/{id}/reativar
   */
  reativar(id: number): Observable<void> {
    return this.http.post<void>(`${this.api}/${id}/reativar`, {});
  }

  /**
   * POST /api/estoque/movimentos
   */
  movimentarEstoque(dto: EstoqueMovimentoRequest): Observable<void> {
    return this.http.post<void>(this.estoqueMovimentosApi, dto);
  }

  listarMovimentos(
    produtoId?: number,
    take = 100,
    skip = 0,
    dataInicio?: string,
    dataFim?: string
  ): Observable<{ items: EstoqueMovimentoDto[]; total: number }> {
    let params = new HttpParams()
      .set('take', String(take))
      .set('skip', String(skip));
    if (produtoId) params = params.set('produtoId', String(produtoId));
    if (dataInicio) params = params.set('dataInicio', dataInicio);
    if (dataFim) params = params.set('dataFim', dataFim);
    return this.http
      .get<EstoqueMovimentoDto[]>(this.estoqueMovimentosApi, { params, observe: 'response' })
      .pipe(
        map(res => {
          const items = res.body ?? [];
          const totalHeader = res.headers.get('X-Total-Count');
          const parsed = totalHeader ? Number(totalHeader) : NaN;
          const total = Number.isFinite(parsed) ? parsed : items.length;
          return { items, total };
        })
      );
  }

  /**
   * GET /api/estoque/movimentos/ajustes-saida?dias=90
   * Saidas por ajuste do periodo, com as que merecem conferencia (grandes ou repetidas) primeiro.
   */
  listarAjustesSaida(dias?: number): Observable<AjustesSaidaDto> {
    let params = new HttpParams();
    if (dias) params = params.set('dias', String(dias));
    return this.http.get<AjustesSaidaDto>(`${this.estoqueMovimentosApi}/ajustes-saida`, { params });
  }

  transferirEstoque(dto: TransferenciaEstoqueRequest): Observable<void> {
    return this.http.post<void>(this.estoqueTransferenciasApi, dto);
  }
}
