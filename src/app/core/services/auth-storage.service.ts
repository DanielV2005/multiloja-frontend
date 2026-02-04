// src/app/core/services/auth-storage.service.ts
import { Injectable } from '@angular/core';

interface JwtPayload {
  exp?: number;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class AuthStorageService {
  private readonly STORAGE_KEY = 'token';
  private readonly USER_KEY = 'auth_user';

  private _token: string | null = null;
  private _exp: number | null = null;
  private _nivelAcesso: number | null = null;
  private _lojaId: number | null = null;
  private _userId: string | null = null;
  private _email: string | null = null;

  constructor() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      this.applyToken(stored);
    }
  }

  /** Token atual usado pelo interceptor */
  get token(): string | null {
    return this._token;
  }

  /** Indica se o token atual esta expirado */
  get isExpired(): boolean {
    if (!this._token || !this._exp) return true;
    const nowSec = Math.floor(Date.now() / 1000);
    return this._exp <= nowSec;
  }

  /** Nivel de acesso do usuario (1=Admin, 2=Gerente, 3=Operador) */
  get nivelAcesso(): number | null {
    return this._nivelAcesso;
  }

  /** Loja selecionada no token */
  get lojaId(): number | null {
    return this._lojaId;
  }

  /** Usuario logado (sub) */
  get userId(): string | null {
    return this._userId;
  }

  /** Email do usuario, quando presente no token */
  get email(): string | null {
    return this._email;
  }

  /** Salva (ou limpa) o token em memoria + localStorage */
  setToken(token: string | null): void {
    if (!token) {
      this._token = null;
      this._exp = null;
      this._nivelAcesso = null;
      this._lojaId = null;
      this._userId = null;
      this._email = null;
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.USER_KEY);
      return;
    }

    this.applyToken(token);
    localStorage.setItem(this.STORAGE_KEY, token);
    if (this._userId || this._email) {
      const value = this._userId ?? this._email ?? '';
      if (value) localStorage.setItem(this.USER_KEY, value);
    } else {
      localStorage.removeItem(this.USER_KEY);
    }
  }

  /** Limpa completamente os dados de autenticacao */
  clear(): void {
    this.setToken(null);
  }

  // ---------------------- helpers ----------------------

  private applyToken(token: string): void {
    this._token = token;
    this._exp = null;
    this._nivelAcesso = null;
    this._lojaId = null;
    this._userId = null;
    this._email = null;

    try {
      const [, payloadBase64] = token.split('.');
      if (!payloadBase64) return;

      const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      const json = atob(normalized);
      const payload = JSON.parse(json) as JwtPayload;

      this._exp = typeof payload.exp === 'number' ? payload.exp : null;

      const subRaw = payload['sub'];
      this._userId = typeof subRaw === 'string' ? subRaw : null;

      const emailRaw = payload['email'];
      this._email = typeof emailRaw === 'string' ? emailRaw : null;

      const nivelRaw = payload['nivelAcesso'];
      const nivel =
        typeof nivelRaw === 'number'
          ? nivelRaw
          : typeof nivelRaw === 'string'
            ? Number(nivelRaw)
            : null;
      this._nivelAcesso = Number.isFinite(nivel as number) ? (nivel as number) : null;

      const lojaRaw = payload['lojaId'] ?? payload['loja'];
      const loja =
        typeof lojaRaw === 'number'
          ? lojaRaw
          : typeof lojaRaw === 'string'
            ? Number(lojaRaw)
            : null;
      this._lojaId = Number.isFinite(loja as number) ? (loja as number) : null;
    } catch {
      // se der erro ao decodificar, apenas mantem exp como null
      this._exp = null;
      this._nivelAcesso = null;
      this._lojaId = null;
    }
  }
}
