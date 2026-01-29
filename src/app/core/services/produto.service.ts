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

@Injectable({ providedIn: 'root' })
export class ProdutoService {
  private readonly api = `${environment.apiBase.catalogo}/api/Produtos`;

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
}
