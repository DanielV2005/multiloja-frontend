import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthStorageService } from '../services/auth-storage.service';
import { UsuarioService } from '../services/usuario.service';

export const lojaGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthStorageService);
  const usuario = inject(UsuarioService);
  const router = inject(Router);

  const hasLojaId = route.paramMap.has('id');
  if (!hasLojaId) {
    return true;
  }

  const lojaId = Number(route.paramMap.get('id')) || 0;
  if (!lojaId) {
    return router.parseUrl('/minhas-lojas');
  }

  if (!auth.token || auth.isExpired) {
    return router.parseUrl('/login');
  }

  if (auth.lojaId === lojaId) {
    return true;
  }

  return usuario.selecionarLoja(lojaId).pipe(
    map(() => true),
    catchError(() => of(router.parseUrl('/minhas-lojas')))
  );
};
