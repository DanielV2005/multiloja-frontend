import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStorageService } from '../services/auth-storage.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthStorageService);
  const router = inject(Router);

  if (!auth.token || auth.isExpired) {
    // so avisa "sessao expirada" se havia um login; sem token e apenas acesso nao autenticado
    const expirou = !!auth.token;
    auth.clear();
    router.navigate(['/login'], {
      queryParams: expirou ? { sessao: 'expirada' } : {}
    });
    return false;
  }

  if (auth.nivelAcesso === 3) {
    const isPdv = /^\/loja\/\d+\/pdv(\/|$)/.test(state.url);
    const isVendas = /^\/loja\/\d+\/relatorios\/vendas(\/|$)/.test(state.url);
    if (!isPdv && !isVendas) {
      if (auth.lojaId) {
        router.navigate(['/loja', auth.lojaId, 'pdv']);
      } else {
        router.navigate(['/login']);
      }
      return false;
    }
  }

  return true;
};
