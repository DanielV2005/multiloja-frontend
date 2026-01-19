import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

import { LoginComponent } from './features/identity/login/login.component';
import { MinhasLojasComponent } from './features/identity/minhas-lojas/minhas-lojas.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },

  {
    path: 'minhas-lojas',
    canActivate: [authGuard],
    component: MinhasLojasComponent,
  },

  {
    path: 'loja/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/loja/painel-loja.component').then(m => m.PainelLojaComponent),
  },

  // =========================
  // ESTOQUE (produtos)
  // =========================
  {
    path: 'loja/:id/estoque',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/loja/estoque/estoque-page.component').then(m => m.EstoquePageComponent),
  },
  {
    path: 'loja/:id/estoque/desativados',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/loja/estoque/produtos-desativados-page.component').then(m => m.ProdutosDesativadosPageComponent),
  },

  // =========================
  // SERVIÇOS
  // =========================
  {
    path: 'loja/:id/servicos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/loja/servicos/servicos-page.component').then(m => m.ServicosPageComponent),
  },
  {
    path: 'loja/:id/servicos/desativados',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/loja/servicos/servicos-desativados-page.component').then(m => m.ServicosDesativadosPageComponent),
  },

  // =========================
  // FUNCIONÁRIOS
  // =========================
  {
    path: 'loja/:id/funcionarios',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/loja/funcionarios/funcionarios-page.component').then(m => m.FuncionariosPageComponent),
  },
  {
    path: 'loja/:id/funcionarios/desativados',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/loja/funcionarios/funcionarios-desativados-page.component').then(m => m.FuncionariosDesativadosPageComponent),
  },

  // =========================
  // PDV
  // =========================
  {
    path: 'loja/:id/pdv',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pdv/pdv.component').then(m => m.PdvComponent),
  },

  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
