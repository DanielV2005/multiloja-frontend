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
  /** Estoque minimo digitado: null = automatico pelas vendas; 0 = nao acompanhar. */
  estoqueMinimo?: number | null;
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

/** De onde saiu o ritmo de vendas: ultimo mes + 3 meses, so 3 meses ou 6 meses (vende pouco). */
export type ReposicaoBaseGiro = 'RECENTE' | 'TRIMESTRE' | 'SEMESTRE';

export interface ReposicaoItemDto {
  id: number;
  nome: string;
  codigoBarra?: string | null;
  setorFilhoId: number;
  quantidade: number;
  /** Digitado pelo usuario (null = automatico). */
  estoqueMinimo?: number | null;
  /** Pelas vendas (null = sem vendas para calcular). */
  minimoAutomatico?: number | null;
  /** O que vale: digitado ou automatico (null = sem historico ou nao acompanhado). */
  minimo?: number | null;
  meio?: number | null;
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
  parado: boolean;
  ultimaMovimentacao?: string | null;
  ultimaCompra?: string | null;
}

export interface ReposicaoDto {
  /** Minimo, meio e maximo automaticos, em dias de venda (7, 14 e 28). */
  diasMinimo: number;
  diasMeio: number;
  diasMaximo: number;
  itens: ReposicaoItemDto[];
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
   * PUT /api/Produtos/{id}/estoque-minimo
   * (null = volta para o minimo automatico; 0 = nao acompanhar)
   */
  definirEstoqueMinimo(id: number, estoqueMinimo: number | null): Observable<void> {
    return this.http.put<void>(`${this.api}/${id}/estoque-minimo`, { estoqueMinimo });
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

  transferirEstoque(dto: TransferenciaEstoqueRequest): Observable<void> {
    return this.http.post<void>(this.estoqueTransferenciasApi, dto);
  }
}
