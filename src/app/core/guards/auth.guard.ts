import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStorageService } from '../services/auth-storage.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthStorageService);
  const router = inject(Router);

  if (!auth.token || auth.isExpired) {
    auth.clear();
    alert('Sessao expirada. Faca login novamente.');
    router.navigate(['/login'], {
      queryParams: { returnUrl: state.url }
    });
    return false;
  }

  if (auth.nivelAcesso === 3) {
    const isPdv = /^\/loja\/\d+\/pdv(\/|$)/.test(state.url);
    if (!isPdv) {
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
