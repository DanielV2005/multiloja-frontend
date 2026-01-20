// src/app/core/services/itens-vendaveis.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ItemVendavelDto {
  id: number;
  tipo: string;
  nome: string;
  precoVenda: number;
  estoque?: number | null;
}

export interface ItensVendaveisResponse {
  page: number;
  size: number;
  total: number;
  items: ItemVendavelDto[];
}

@Injectable({ providedIn: 'root' })
export class ItensVendaveisService {
  private readonly api = `${environment.apiBase.catalogo}/api/ItensVendaveis`;

  constructor(private http: HttpClient) {}

  listar(
    filtro: string,
    tipo: string | null,
    somenteAtivos: boolean = true,
    pagina: number = 1,
    tamanho: number = 20
  ): Observable<ItensVendaveisResponse> {
    let params = new HttpParams()
      .set('somenteAtivos', String(!!somenteAtivos))
      .set('pagina', String(pagina))
      .set('tamanho', String(tamanho));

    if (filtro && filtro.trim()) {
      params = params.set('filtro', filtro.trim());
    }
    if (tipo) {
      params = params.set('tipo', tipo);
    }

    return this.http.get<ItensVendaveisResponse>(this.api, { params });
  }
}
