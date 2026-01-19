import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  private readonly baseUrl = '/api/ProdutosServicos';

  constructor(private http: HttpClient) {}

  listarAtivos(filtro?: string): Observable<ProdutoServico[]> {
    let params = new HttpParams();
    if (filtro) params = params.set('filtro', filtro);
    return this.http.get<ProdutoServico[]>(`${this.baseUrl}/ativos`, { params });
  }

  listarDesativados(filtro?: string): Observable<ProdutoServico[]> {
    let params = new HttpParams();
    if (filtro) params = params.set('filtro', filtro);
    return this.http.get<ProdutoServico[]>(`${this.baseUrl}/desativados`, { params });
  }

  criar(dto: SalvarProdutoServicoRequest): Observable<ProdutoServico> {
    return this.http.post<ProdutoServico>(this.baseUrl, dto);
  }

  atualizar(id: number, dto: SalvarProdutoServicoRequest): Observable<ProdutoServico> {
    return this.http.put<ProdutoServico>(`${this.baseUrl}/${id}`, dto);
  }

  desativar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  reativar(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/reativar`, {});
  }
}
