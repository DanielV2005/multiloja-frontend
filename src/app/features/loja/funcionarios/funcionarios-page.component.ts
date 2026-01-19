import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { UsuarioService, Loja } from '../../../core/services/usuario.service';
import { FuncionarioService, FuncionarioListItem } from '../../../core/services/funcionario.service';
import { FuncionarioFormDialogComponent, FuncionarioFormDialogData } from './funcionario-form.dialog';
import { FuncionarioVincularDialogComponent } from './funcionario-vincular.dialog';

@Component({
  standalone: true,
  selector: 'app-funcionarios-page',
  imports: [CommonModule, RouterLink, MatDialogModule],
  template: `
  <section class="page">
    <header class="topbar">
      <a class="link" [routerLink]="['/loja', lojaId]">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>Voltar para o painel</span>
      </a>

      <div class="title">
        <h2>Funcionários</h2>
        <small class="muted" *ngIf="loja">{{ loja.nome }}</small>
      </div>

      <span class="spacer"></span>
    </header>

    <main class="content">
      <div class="card">
        <header class="card__header">
          <div>
            <h3>Funcionários cadastrados</h3>
            <small class="muted">
              {{ loading ? 'Carregando...' : 'Itens: ' + funcionarios.length }}
            </small>
          </div>

          <div class="header-actions">
            <button class="btn-secondary" type="button" (click)="abrirVinculo()">
              <span class="material-symbols-outlined">link</span>
              <span>Vincular</span>
            </button>

            <button class="btn-gold" type="button" (click)="novoFuncionario()">
              <span class="material-symbols-outlined">person_add</span>
              <span>Novo funcionário</span>
            </button>
          </div>
        </header>

        <div *ngIf="loading" class="loading">
          <div class="spinner"></div>
          <span>Carregando funcionários...</span>
        </div>

        <p *ngIf="!loading && funcionarios.length === 0" class="empty">
          Nenhum funcionário cadastrado ainda.
        </p>

        <div *ngIf="!loading && funcionarios.length > 0" class="table">
          <div class="table-header">
            <span class="th col-nome">Nome</span>
            <span class="th col-email">E-mail</span>
            <span class="th col-nivel">Nível</span>
            <span class="th col-acoes">Ações</span>
          </div>

          <div class="table-row" *ngFor="let f of funcionarios; trackBy: trackById">
            <div class="cell col-nome">
              <div class="prod-name">{{ f.nome }}</div>
            </div>

            <span class="cell col-email">{{ f.email }}</span>
            <span class="cell col-nivel">{{ nivelLabel(f.nivelAcesso) }}</span>

            <span class="cell col-acoes">
              <button type="button" class="icon-btn" title="Editar" (click)="editarFuncionario(f)">
                <span class="material-symbols-outlined">edit</span>
              </button>

              <button
                type="button"
                class="icon-btn"
                title="Desativar"
                (click)="desativarFuncionario(f)"
                [disabled]="loading || !f.usuarioId || desativandoId === f.usuarioId"
              >
                <span class="material-symbols-outlined">delete</span>
              </button>

              <button type="button" class="icon-btn" title="Reativar (somente na lista de desativados)" disabled>
                <span class="material-symbols-outlined">history</span>
              </button>
            </span>
          </div>
        </div>
      </div>
    </main>
  </section>
  `,
  styles: [`
    .material-symbols-outlined{ font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; }

    .page{ min-height:100dvh; padding:20px 18px; background:var(--bg); color:var(--text); }
    .topbar{ display:flex; align-items:center; gap:16px; margin:4px 0 16px; }

    .link{
      display:inline-flex; align-items:center; gap:6px;
      background:transparent; border:1px solid #d4af37; color:var(--text);
      border-radius:999px; height:36px; padding:0 12px; cursor:pointer; text-decoration:none;
    }
    .link:hover{ background:rgba(240,210,122,.10); box-shadow:0 0 14px rgba(240,210,122,.45); }

    .title h2{ margin:0; font-size:1.4rem; }
    .title .muted{ font-size:.85rem; }
    .spacer{ flex:1; }

    .card{
      background:var(--surface); border:1px solid var(--border);
      border-radius:var(--radius); box-shadow:var(--shadow);
      padding:16px 16px 18px; max-width:1120px; margin:0 auto;
    }
    .card__header{
      display:flex; align-items:center; justify-content:space-between;
      gap:16px; margin-bottom:12px;
    }

    .header-actions{ display:flex; gap:10px; align-items:center; }

    .btn-secondary{
      display:inline-flex; align-items:center; gap:6px;
      padding:6px 14px; border-radius:999px;
      border:1px solid var(--border);
      background:rgba(15,23,42,.9);
      color:var(--muted); font-size:.85rem; cursor:pointer;
    }
    .btn-secondary:hover{ border-color:#e5e7eb; color:var(--text); background:rgba(148,163,184,.16); }

    .btn-gold{
      display:inline-flex; align-items:center; gap:6px;
      padding:6px 16px; border-radius:999px;
      border:1px solid #9e7b14; cursor:pointer;
      background:
        radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.20), transparent 60%),
        linear-gradient(180deg,#F5DF7B 0%, var(--primary) 55%, var(--primary-600) 100%);
      color:#151515;
      box-shadow:0 8px 20px rgba(218,171,31,.45), inset 0 -2px 0 rgba(0,0,0,.18);
      font-weight:600; font-size:.9rem;
    }
    .btn-gold:hover{
      background:
        radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.26), transparent 60%),
        linear-gradient(180deg,#F9E992 0%, #E3BD43 55%, #BE8E1A 100%);
    }

    .loading{ display:flex; align-items:center; gap:10px; padding:10px 4px; }
    .spinner{
      width:18px; height:18px; border-radius:50%;
      border:2px solid rgba(255,255,255,.45);
      border-top-color:#fff; animation:spin .8s linear infinite;
    }
    @keyframes spin{ to{ transform:rotate(360deg); } }

    .empty{ margin:18px 4px 6px; font-size:.9rem; color:var(--muted); }

    .table{
      margin-top:10px; border-radius:12px; border:1px solid var(--border);
      overflow:hidden; background:#050814;
      display:table; width:100%;
      border-collapse:collapse; table-layout:fixed;
    }

    .table-header{
      display:table-row; background:rgba(15,21,40,.96);
      font-size:.78rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted);
    }
    .table-row{ display:table-row; font-size:.9rem; }

    .table-header .th, .table-row .cell{
      display:table-cell; padding:8px 12px;
      border-bottom:1px solid rgba(148,163,184,.25);
      border-right:1px solid rgba(148,163,184,.25);
      vertical-align:middle;
    }
    .table-header .th:last-child, .table-row .cell:last-child{ border-right:none; }

    .table .col-nome{ width:36%; }
    .table .col-email{ width:36%; }
    .table .col-nivel{ width:14%; }
    .table .col-acoes{ width:14%; }

    .table-header .col-nome, .table-header .col-email{ text-align:left; }
    .table-header .col-nivel, .table-header .col-acoes{ text-align:right; }

    .table-row .col-nome, .table-row .col-email{ text-align:left; }
    .table-row .col-nivel{ text-align:right; font-variant-numeric:tabular-nums; }
    .col-acoes{ text-align:right; }

    .table-row:nth-of-type(odd){ background:#050814; }
    .table-row:nth-of-type(even){ background:#070b19; }

    .prod-name{ font-weight:500; word-break:break-word; }

    .icon-btn{
      width:30px; height:30px; padding:0;
      border-radius:999px;
      border:1px solid rgba(240,210,122,.6);
      background:transparent;
      display:inline-grid; place-items:center;
      cursor:pointer; color:var(--muted);
      transition:background .15s, box-shadow .2s, transform .05s, color .15s, border-color .15s;
      margin-left:4px;
    }
    .icon-btn:hover:not(:disabled){
      background:rgba(240,210,122,.14);
      color:var(--text);
      border-color:#f0d27a;
      box-shadow:0 0 0 1px rgba(240,210,122,.45);
      transform:translateY(-1px);
    }
    .icon-btn:disabled{
      opacity:.45; cursor:default; box-shadow:none; border-color:rgba(127,127,127,.5);
    }

    .muted{ color:var(--muted); }

    @media (max-width: 900px){
      .card{ padding:12px; }
      .card__header h3{ font-size:1rem; }
      .table-row .cell{ font-size:.85rem; }
    }

    @media (max-width: 720px){
      .table .col-email{ display:none; }
    }

    @media (max-width: 560px){
      .table .col-nivel{ display:none; }
    }
  `],
})
export class FuncionariosPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private usuarioService = inject(UsuarioService);
  private api = inject(FuncionarioService);
  private dialog = inject(MatDialog);

  lojaId = 0;
  loja: Loja | null = null;

  funcionarios: FuncionarioListItem[] = [];
  loading = false;
  desativandoId: string | null = null;

  ngOnInit(): void {
    this.lojaId = Number(this.route.snapshot.paramMap.get('id')) || 0;
    if (!this.lojaId) {
      this.router.navigate(['/minhas-lojas']);
      return;
    }

    this.usuarioService.loja(this.lojaId).subscribe({
      next: (l) => (this.loja = l ?? null),
      error: () => (this.loja = null),
    });

    this.carregar();
  }

  carregar(): void {
    this.loading = true;

    this.api.listar(false).subscribe({
      next: (items) => {
        this.funcionarios = (items ?? []).filter(x => x.ativo !== false);
        this.loading = false;
      },
      error: (err) => {
        console.error('[FuncionariosPage] erro ao carregar', err);
        this.loading = false;
      },
    });
  }

  trackById(_: number, item: FuncionarioListItem): string {
    return item.usuarioId;
  }

  nivelLabel(n: number): string {
    if (n === 1) return 'Admin';
    if (n === 2) return 'Gerente';
    if (n === 3) return 'Operador';
    return String(n);
  }

  abrirVinculo(): void {
    this.dialog.open(FuncionarioVincularDialogComponent, {
      autoFocus: false,
      maxWidth: '95vw',
      panelClass: 'ml-dialog',
    })
    .afterClosed()
    .subscribe((ok: boolean) => {
      if (ok) {
        this.carregar();
      }
    });
  }

  novoFuncionario(): void {
    this.dialog.open(FuncionarioFormDialogComponent, {
      autoFocus: false,
      maxWidth: '95vw',
      panelClass: 'ml-dialog',
    })
    .afterClosed()
    .subscribe((ok: FuncionarioListItem | boolean | null) => {
      if (ok === true) {
        this.carregar();
      }
    });
  }

  editarFuncionario(funcionario: FuncionarioListItem): void {
    const data: FuncionarioFormDialogData = { funcionario };

    this.dialog.open(FuncionarioFormDialogComponent, {
      autoFocus: false,
      maxWidth: '95vw',
      panelClass: 'ml-dialog',
      data,
    })
    .afterClosed()
    .subscribe((result: FuncionarioListItem | boolean | null) => {
      if (!result || result === true) return;
      this.funcionarios = this.funcionarios.map(x =>
        x.usuarioId === result.usuarioId ? { ...x, ...result } : x
      );
    });
  }

  desativarFuncionario(func: FuncionarioListItem): void {
    if (!func?.usuarioId) return;

    if (!confirm(`Desativar o funcionário "${func.nome}"?`)) return;

    const snapshot = [...this.funcionarios];
    this.desativandoId = func.usuarioId;
    this.funcionarios = this.funcionarios.filter(x => x.usuarioId !== func.usuarioId);

    this.api.desativar(func.usuarioId).subscribe({
      next: () => {
        this.desativandoId = null;
      },
      error: (err) => {
        console.error('[FuncionariosPage] erro ao desativar', err);
        this.funcionarios = snapshot;
        this.desativandoId = null;
      },
    });
  }
}
