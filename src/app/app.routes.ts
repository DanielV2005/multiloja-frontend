import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { lojaGuard } from './core/guards/loja.guard';

import { LoginComponent } from './features/identity/login/login.component';
import { MinhasLojasComponent } from './features/identity/minhas-lojas/minhas-lojas.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },

  {
    path: 'minhas-lojas',
    canActivate: [authGuard, lojaGuard],
    component: MinhasLojasComponent,
  },

  {
    path: 'loja/:id',
    canActivate: [authGuard, lojaGuard],
    loadComponent: () =>
      import('./features/loja/painel-loja.component').then(m => m.PainelLojaComponent),
  },

  // =========================
  // ESTOQUE (produtos)
  // =========================
  {
    path: 'loja/:id/estoque',
    canActivate: [authGuard, lojaGuard],
    loadComponent: () =>
      import('./features/loja/estoque/estoque-page.component').then(m => m.EstoquePageComponent),
  },
  {
    path: 'loja/:id/estoque/movimentos',
    canActivate: [authGuard, lojaGuard],
    loadComponent: () =>
      import('./features/loja/estoque/estoque-movimentos-page.component').then(m => m.EstoqueMovimentosPageComponent),
  },
  {
    path: 'loja/:id/estoque/desativados',
    canActivate: [authGuard, lojaGuard],
    loadComponent: () =>
      import('./features/loja/estoque/produtos-desativados-page.component').then(m => m.ProdutosDesativadosPageComponent),
  },

  // =========================
  // SERVIÃ‡OS
  // =========================
  {
    path: 'loja/:id/servicos',
    canActivate: [authGuard, lojaGuard],
    loadComponent: () =>
      import('./features/loja/servicos/servicos-page.component').then(m => m.ServicosPageComponent),
  },
  {
    path: 'loja/:id/servicos/desativados',
    canActivate: [authGuard, lojaGuard],
    loadComponent: () =>
      import('./features/loja/servicos/servicos-desativados-page.component').then(m => m.ServicosDesativadosPageComponent),
  },

  // =========================
  // FUNCIONÃRIOS
  // =========================
  {
    path: 'loja/:id/funcionarios',
    canActivate: [authGuard, lojaGuard],
    loadComponent: () =>
      import('./features/loja/funcionarios/funcionarios-page.component').then(m => m.FuncionariosPageComponent),
  },
  {
    path: 'loja/:id/funcionarios/desativados',
    canActivate: [authGuard, lojaGuard],
    loadComponent: () =>
      import('./features/loja/funcionarios/funcionarios-desativados-page.component').then(m => m.FuncionariosDesativadosPageComponent),
  },

  // =========================
  // PDV
  // =========================
  {
    path: 'loja/:id/pdv',
    canActivate: [authGuard, lojaGuard],
    loadComponent: () =>
      import('./features/pdv/pdv.component').then(m => m.PdvComponent),
  },

  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];


