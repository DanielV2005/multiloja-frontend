import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FuncionarioListItem {
  usuarioId: string;
  nome: string;
  email: string;
  cpf?: string;
  nivelAcesso: number;
  ativo: boolean;
  vinculadoEm?: string | null;
  desativadoEm?: string | null;
}

export interface NovoFuncionario {
  nome: string;
  email: string;
  cpf: string;
  senha: string;
  nivelAcesso: number;
}

@Injectable({ providedIn: 'root' })
export class FuncionarioService {
  private http = inject(HttpClient);

  private baseUrl = environment.apiBase.organizacao;

  listar(incluirDesativados = false, filtro?: string): Observable<FuncionarioListItem[]> {
    let params = new HttpParams().set('incluirDesativados', String(incluirDesativados));
    if (filtro?.trim()) params = params.set('filtro', filtro.trim());
    return this.http.get<FuncionarioListItem[]>(`${this.baseUrl}/api/Funcionarios`, { params });
  }

  cadastrarFuncionario(dto: NovoFuncionario): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/Funcionarios`, dto);
  }

  desativar(usuarioId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/Funcionarios/${usuarioId}`);
  }


  atualizarFuncionario(usuarioId: string, dto: { nome: string; email: string; cpf: string }): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/api/Funcionarios/${usuarioId}`, dto);
  }


  buscarPorCpf(cpf: string): Observable<FuncionarioListItem[]> {
    const params = new HttpParams().set('cpf', cpf ?? '');
    return this.http.get<FuncionarioListItem[]>(`${this.baseUrl}/api/Funcionarios/buscar`, { params });
  }

  alterarNivel(usuarioId: string, novoNivel: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/Funcionarios/alterar-nivel`, {
      usuarioId,
      novoNivel,
    });
  }

  /* Não existe endpoint "reativar", então tentamos vincular de novo (se seu backend aceitar reativação por aí) */
  vincular(usuarioId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/Funcionarios/vincular`, { usuarioId });
  }
}
