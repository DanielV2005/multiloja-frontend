import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ProdutoServico {
  id?: number;
  nome: string;
  precoVenda: number;
  ativo: boolean;
}

export interface SalvarProdutoServicoRequest {
  nome: string;
  precoVenda: number;
  ativo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProdutoServicoService {
  private readonly baseUrl = `${environment.apiBase.catalogo}/api/ProdutosServicos`;

  constructor(private http: HttpClient) {}

  private normalizeList<T>(res: unknown): T[] {
    if (Array.isArray(res)) return res as T[];
    const items = (res as { items?: T[] })?.items;
    if (Array.isArray(items)) return items;
    const data = (res as { data?: T[] })?.data;
    if (Array.isArray(data)) return data;
    return [];
  }

  listarAtivos(filtro?: string): Observable<ProdutoServico[]> {
    let params = new HttpParams();
    if (filtro) params = params.set('filtro', filtro);
    return this.http
      .get<ProdutoServico[] | { items?: ProdutoServico[] } | { data?: ProdutoServico[] }>(
        `${this.baseUrl}/ativos`,
        { params }
      )
      .pipe(map(res => this.normalizeList<ProdutoServico>(res)));
  }

  listarDesativados(filtro?: string): Observable<ProdutoServico[]> {
    let params = new HttpParams();
    if (filtro) params = params.set('filtro', filtro);
    return this.http
      .get<ProdutoServico[] | { items?: ProdutoServico[] } | { data?: ProdutoServico[] }>(
        `${this.baseUrl}/desativados`,
        { params }
      )
      .pipe(map(res => this.normalizeList<ProdutoServico>(res)));
  }

  obter(id: number): Observable<ProdutoServico> {
    return this.http.get<ProdutoServico>(`${this.baseUrl}/${id}`);
  }

  criar(dto: SalvarProdutoServicoRequest): Observable<ProdutoServico | null> {
    return this.http
      .post<ProdutoServico | number>(this.baseUrl, dto)
      .pipe(
        switchMap(res => {
          if (res && typeof res === 'object') return of(res as ProdutoServico);
          const id = typeof res === 'number' ? res : Number(res);
          return Number.isFinite(id) && id > 0 ? this.obter(id) : of(null);
        })
      );
  }

  atualizar(id: number, dto: SalvarProdutoServicoRequest): Observable<ProdutoServico | null> {
    return this.http
      .put<void>(`${this.baseUrl}/${id}`, dto)
      .pipe(switchMap(() => this.obter(id)));
  }

  desativar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  reativar(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/reativar`, {});
  }
}
