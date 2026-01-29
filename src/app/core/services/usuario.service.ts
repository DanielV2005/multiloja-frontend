// src/app/core/services/usuario.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { AuthStorageService } from './auth-storage.service';
import { environment } from '../../../environments/environment';

export interface Loja {
  id: number;
  nome: string;
  endereco?: string;
  ativa?: boolean;
}

export interface NovaLoja {
  nome: string;
  endereco?: string;
}

export interface LoginRequest {
  nome: string;
  senha: string;
}

export interface LoginResponse {
  token: string;
  expiresIn?: number | null;
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly identityApi = `${environment.apiBase.identity}/api`;
  private readonly organizacaoApi = `${environment.apiBase.organizacao}/api`;

  constructor(
    private http: HttpClient,
    private authStorage: AuthStorageService
  ) {}

  // ========== AUTH ==========

  /** Faz login e já salva o token no AuthStorageService */
  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.identityApi}/Usuario/login`, payload)
      .pipe(
        tap(res => {
          if (res?.token) {
            this.authStorage.setToken(res.token);
          }
        })
      );
  }

  trocarSenha(senhaAtual: string, novaSenha: string): Observable<void> {
    return this.http.post<void>(`${this.identityApi}/Usuario/trocar-senha`, {
      senhaAtual,
      novaSenha,
    });
  }

  // normalizar loja
  private readonly normalizeLoja = (x: any): Loja => ({
    id: Number(
      x?.id ??
      x?.lojaId ??
      x?.idLoja ??
      x?.lojaID ??
      x?.loja?.id
    ),
    nome: String(x?.nome ?? x?.lojaNome ?? x?.loja?.nome ?? ''),
    endereco: x?.endereco ?? x?.loja?.endereco ?? '',
    ativa: (x?.ativa ?? x?.loja?.ativa ?? true) as boolean,
  });

  // ========== LOJAS ==========

  minhasLojas(): Observable<Loja[]> {
    return this.http
      .get<any[]>(`${this.identityApi}/Usuario/minhas-lojas`)
      .pipe(
        map(arr => (Array.isArray(arr) ? arr : [])),
        map(arr => arr.map(this.normalizeLoja)),
        map(arr => arr.filter(l => Number.isFinite(l.id)))
      );
  }

  loja(id: number): Observable<Loja> {
    return this.http
      .get<any>(`${this.organizacaoApi}/Lojas/${id}`)
      .pipe(map(this.normalizeLoja));
  }

  criarLoja(dto: NovaLoja): Observable<number> {
    return this.http
      .post(`${this.organizacaoApi}/Lojas`, dto, { observe: 'response' })
      .pipe(
        map(res => {
          if (typeof res.body === 'number') return res.body as number;

          const bodyId =
            (res.body as any)?.id ??
            Number(/\d+$/.exec(res.headers.get('Location') ?? '')?.[0]);

          return Number.isFinite(bodyId) ? (bodyId as number) : 0;
        })
      );
  }

  atualizarLoja(id: number, dto: NovaLoja): Observable<void> {
    return this.http.put<void>(`${this.organizacaoApi}/Lojas/${id}`, dto);
  }

  desativarLoja(id: number): Observable<void> {
    return this.http.post<void>(`${this.organizacaoApi}/Lojas/${id}/desativar`, {});
  }

  reativarLoja(id: number): Observable<void> {
    return this.http.post<void>(`${this.organizacaoApi}/Lojas/${id}/reativar`, {});
  }

  lojasDesativadas(): Observable<Loja[]> {
    return this.http
      .get<any[]>(`${this.organizacaoApi}/Lojas/desativadas`)
      .pipe(
        map(arr => (Array.isArray(arr) ? arr : [])),
        map(arr => arr.map(this.normalizeLoja))
      );
  }

  /** Seleciona a loja e atualiza o token no AuthStorageService */
  selecionarLoja(id: number): Observable<void> {
    return this.http
      .post(
        `${this.identityApi}/Usuario/selecionar-loja`,
        { lojaId: id },
        { responseType: 'text' }
      )
      .pipe(
        tap(token => {
          const raw = token?.toString().trim() ?? '';
          const jwt = this.extractToken(raw);
          if (jwt) {
            this.authStorage.setToken(jwt);
            console.log('[selecionarLoja] novo token salvo', jwt);
          } else {
            console.warn('[selecionarLoja] resposta inesperada', token);
          }
        }),
        map(() => void 0)
      );
  }

  private extractToken(raw: string): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();

    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as { token?: string };
        if (parsed?.token) return String(parsed.token).trim();
      } catch {
        // ignore parse error and continue
      }
    }

    if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1).trim();
    }

    return trimmed;
  }
}
