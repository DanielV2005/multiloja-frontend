// src/app/core/services/setor.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Setor {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  setorPaiId?: number | null;
}

export interface NovoSetor {
  nome: string;
  descricao?: string | null;
  setorPaiId?: number | null;
}

@Injectable({ providedIn: 'root' })
export class SetorService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBase.organizacao}/api/Setores`;

  private normalizeList<T>(res: unknown): T[] {
    if (Array.isArray(res)) return res as T[];
    const items = (res as { items?: T[] })?.items;
    if (Array.isArray(items)) return items;
    const data = (res as { data?: T[] })?.data;
    if (Array.isArray(data)) return data;
    return [];
  }

  /** Lista setores ATIVOS */
  listar(filtro: string = ''): Observable<Setor[]> {
    let params = new HttpParams().set('_ts', String(Date.now()));
    if (filtro?.trim()) {
      params = params.set('filtro', filtro.trim());
    }

    return this.http
      .get<Setor[] | { items?: Setor[] } | { data?: Setor[] }>(this.baseUrl, { params })
      .pipe(map(res => this.normalizeList<Setor>(res)));
  }

  /** Lista setores DESATIVADOS */
  listarDesativados(filtro: string = ''): Observable<Setor[]> {
    let params = new HttpParams().set('_ts', String(Date.now()));
    if (filtro?.trim()) {
      params = params.set('filtro', filtro.trim());
    }

    return this.http
      .get<Setor[] | { items?: Setor[] } | { data?: Setor[] }>(`${this.baseUrl}/desativados`, { params })
      .pipe(map(res => this.normalizeList<Setor>(res)));
  }

  criar(dto: NovoSetor): Observable<void> {
    return this.http.post<void>(this.baseUrl, dto);
  }

  atualizar(id: number, dto: NovoSetor): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, dto);
  }

  desativar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  reativar(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/reativar`, {});
  }
}
