import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStorageService } from '../services/auth-storage.service';

/**
 * Trata erros HTTP de forma central:
 * - 401 com sessao ativa: limpa o token e volta para o login avisando que a sessao expirou.
 * - Corpo tecnico (stack trace / pagina HTML de erro) ou sem corpo: troca por mensagem amigavel
 *   em { message, error }, formato que as telas ja leem. O detalhe original vai para o console.
 * Mensagens de negocio enviadas pelo backend (JSON) sao mantidas como estao.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStorageService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);

      const isLoginRequest = /\/Usuario\/login$/i.test(req.url.split('?')[0]);

      if (err.status === 401 && !isLoginRequest && auth.token) {
        auth.clear();
        if (!router.url.startsWith('/login')) {
          router.navigate(['/login'], { queryParams: { sessao: 'expirada' } });
        }
      }

      const body = err.error;
      const semCorpo = body == null || (typeof body === 'string' && !body.trim());

      // Erro de validacao do ASP.NET ({ title, errors: { Campo: ["msg"] } }): as telas leem "message"
      const validacao = validationMessage(body);
      if (validacao) {
        return throwError(() => new HttpErrorResponse({
          error: { ...body, message: validacao, error: validacao },
          headers: err.headers,
          status: err.status,
          statusText: err.statusText,
          url: err.url ?? undefined,
        }));
      }

      if (!semCorpo && !isTechnical(body)) return throwError(() => err);

      if (!semCorpo) {
        console.error(`[HTTP ${err.status}] ${req.method} ${req.url}\n`, body);
      }

      const message = friendlyMessage(err.status);
      return throwError(() => new HttpErrorResponse({
        error: { message, error: message },
        headers: err.headers,
        status: err.status,
        statusText: err.statusText,
        url: err.url ?? undefined,
      }));
    }),
  );
};

function validationMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { message?: unknown; errors?: unknown };
  if (typeof b.message === 'string' && b.message.trim()) return null;
  if (!b.errors || typeof b.errors !== 'object') return null;
  const mensagens = Object.values(b.errors as Record<string, unknown>)
    .flatMap(v => (Array.isArray(v) ? v : [v]))
    .filter((m): m is string => typeof m === 'string' && !!m.trim());
  return mensagens.length ? mensagens.join(' ') : null;
}

function isTechnical(body: unknown): boolean {
  if (typeof body !== 'string') return false;
  const text = body.trimStart();
  return text.startsWith('<')                       // pagina HTML de erro
    || /\bat [\w.`<>|\[\]]+\(/.test(text)           // linhas de stack trace (.NET)
    || /^[\w.]+Exception\b/.test(text);             // "System.Xxx.YyyException: ..."
}

function friendlyMessage(status: number): string {
  if (status === 0) return 'Nao foi possivel conectar ao servidor. Verifique sua conexao e tente novamente.';
  if (status === 401) return 'Sua sessao expirou. Entre novamente.';
  if (status === 403) return 'Voce nao tem permissao para esta acao.';
  if (status === 404) return 'Registro nao encontrado.';
  if (status >= 500) return 'Ocorreu um erro inesperado no servidor. Tente novamente em instantes.';
  return 'Nao foi possivel concluir a operacao.';
}
