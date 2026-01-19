import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { UsuarioService, Loja } from '../../../core/services/usuario.service';
import {
  ProdutoServicoService,
  ProdutoServico,
  SalvarProdutoServicoRequest,
} from '../../../core/services/produto-servico.service';

import {
  ServicoFormDialogComponent,
  ServicoFormDialogData,
} from './servico-form.dialog';

@Component({
  standalone: true,
  selector: 'app-servicos-page',
  imports: [CommonModule, RouterLink, MatDialogModule],
  template: `
  <section class="page">
    <header class="topbar">
      <a class="link" [routerLink]="['/loja', lojaId]">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>Voltar para o painel</span>
      </a>

      <div class="title">
        <h2>Serviços</h2>
        <small class="muted" *ngIf="loja">{{ loja.nome }}</small>
      </div>

      <span class="spacer"></span>
    </header>

    <main class="content">
      <div class="card">
        <header class="card__header">
          <div>
            <h3>Serviços cadastrados</h3>
            <small class="muted">
              {{ loading ? 'Carregando...' : 'Itens: ' + servicos.length }}
            </small>
          </div>

          <div class="header-actions">
            <button class="btn-secondary" type="button" (click)="verDesativados()">
              <span class="material-symbols-outlined">history</span>
              <span>Desativados</span>
            </button>

            <button class="btn-gold" type="button" (click)="novoServico()">
              <span class="material-symbols-outlined">add</span>
              <span>Novo serviço</span>
            </button>
          </div>
        </header>

        <div *ngIf="loading" class="loading">
          <div class="spinner"></div>
          <span>Carregando serviços...</span>
        </div>

        <p *ngIf="!loading && servicos.length === 0" class="empty">
          Nenhum serviço cadastrado ainda.
        </p>

        <div *ngIf="!loading && servicos.length > 0" class="table">
          <div class="table-header">
            <span class="th col-servico">Serviço</span>
            <span class="th col-numero">Preço venda</span>
            <span class="th col-acoes">Ações</span>
          </div>

          <div class="table-row" *ngFor="let s of servicos; trackBy: trackById">
            <div class="cell col-servico">
              <div class="prod-name">{{ s.nome }}</div>
            </div>

            <span class="cell col-numero">{{ fmtMoney(s.precoVenda) }}</span>

            <span class="cell col-acoes">
              <button type="button" class="icon-btn" title="Editar" (click)="editarServico(s)">
                <span class="material-symbols-outlined">edit</span>
              </button>

              <button
                type="button"
                class="icon-btn"
                title="Desativar"
                (click)="desativarServico(s)"
                [disabled]="!s.id"
              >
                <span class="material-symbols-outlined">delete</span>
              </button>

              <button type="button" class="icon-btn" title="Reativar (apenas na lista de desativados)" disabled>
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

    .btn-secondary{
      display:inline-flex; align-items:center; gap:6px;
      padding:6px 14px; border-radius:999px;
      border:1px solid var(--border);
      background:rgba(15,23,42,.9);
      color:var(--muted); font-size:.85rem; cursor:pointer;
    }
    .btn-secondary:hover{ border-color:#e5e7eb; color:var(--text); background:rgba(148,163,184,.16); }

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

    .table .col-servico{ width:62%; }
    .table .col-numero{ width:18%; }
    .table .col-acoes{ width:20%; }

    .table-header .col-servico{ text-align:left; }
    .table-header .col-numero, .table-header .col-acoes{ text-align:right; }

    .table-row .col-servico{ text-align:left; }
    .table-row .col-numero{ text-align:right; font-variant-numeric:tabular-nums; }
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
  `],
})
export class ServicosPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private usuarioService = inject(UsuarioService);
  private api = inject(ProdutoServicoService);
  private dialog = inject(MatDialog);

  lojaId = 0;
  loja: Loja | null = null;

  servicos: ProdutoServico[] = [];
  loading = false;

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

    this.carregarServicos();
  }

  private carregarServicos(): void {
    this.loading = true;
    this.api.listarAtivos().subscribe({
      next: (items) => {
        this.servicos = (items ?? []).map(s => ({
          ...s,
          precoVenda: this.toNumber((s as any).precoVenda),
        }));
        this.loading = false;
      },
      error: (err) => {
        console.error('[ServicosPage] erro ao carregar', err);
        this.loading = false;
      },
    });
  }

  private toNumber(value: number | string | null | undefined): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  fmtMoney(value: number | string | null | undefined): string {
    const n = this.toNumber(value);
    return n.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  trackById(_: number, item: ProdutoServico): number | undefined {
    return item.id;
  }

  verDesativados(): void {
    this.router.navigate(['/loja', this.lojaId, 'servicos', 'desativados']);
  }

  novoServico(): void {
    const data: ServicoFormDialogData = { lojaId: this.lojaId };

    this.dialog.open(ServicoFormDialogComponent, {
      autoFocus: false,
      data,
      maxWidth: '95vw',
      panelClass: 'no-x-scroll-dialog',
    })
    .afterClosed()
    .subscribe((result: ProdutoServico | boolean | null) => {
      if (!result || result === true) return;

      // adiciona sem reload
      const saved = { ...result, precoVenda: this.toNumber((result as any).precoVenda) };
      this.servicos = [saved, ...this.servicos];
    });
  }

  editarServico(servico: ProdutoServico): void {
    if (!servico?.id) return;

    const data: ServicoFormDialogData = { lojaId: this.lojaId, servico };

    this.dialog.open(ServicoFormDialogComponent, {
      autoFocus: false,
      data,
      maxWidth: '95vw',
      panelClass: 'no-x-scroll-dialog',
    })
    .afterClosed()
    .subscribe((result: ProdutoServico | boolean | null) => {
      if (!result) return;
      this.carregarServicos();
    });
  }

  desativarServico(servico: ProdutoServico): void {
    if (!servico?.id) return;

    if (!confirm(`Desativar o serviço "${servico.nome}"?`)) return;

    // otimista: remove sem loading/reload
    const snapshot = [...this.servicos];
    this.servicos = this.servicos.filter(x => x.id !== servico.id);

    // se seu backend usa DELETE pra desativar, mantenha "desativar" no service chamando DELETE.
    this.api.desativar(servico.id).subscribe({
      next: () => {},
      error: (err) => {
        console.error('[ServicosPage] erro ao desativar', err);
        this.servicos = snapshot;
      },
    });
  }
}
