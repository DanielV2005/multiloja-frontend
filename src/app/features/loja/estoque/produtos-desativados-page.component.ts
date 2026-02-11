import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { ProdutoService, Produto } from '../../../core/services/produto.service';
import { SetorService } from '../../../core/services/setor.service';
import { UsuarioService, Loja } from '../../../core/services/usuario.service';

@Component({
  standalone: true,
  selector: 'app-produtos-desativados-page',
  imports: [CommonModule, RouterLink, MatDialogModule],
  template: `
  <section class="page">
    <header class="topbar">
      <a class="link" [routerLink]="['/loja', lojaId, 'estoque']">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>Voltar para o estoque</span>
      </a>

      <div class="title">
        <h2>Produtos desativados</h2>
        <small class="muted" *ngIf="loja">
          {{ loja.nome }}
        </small>
      </div>

      <span class="spacer"></span>
    </header>

    <main class="content">
      <div class="card">
        <header class="card__header">
          <div>
            <h3>Produtos desativados</h3>
            <small class="muted">
              {{ loading ? 'Carregando...' : 'Itens: ' + produtos.length }}
            </small>
          </div>
        </header>

        <!-- LOADING -->
        <div *ngIf="loading" class="loading">
          <div class="spinner"></div>
          <span>Carregando produtos desativados...</span>
        </div>

        <!-- EMPTY -->
        <p *ngIf="!loading && produtos.length === 0" class="empty">
          Nenhum produto desativado no momento.
        </p>

        <!-- TABLE -->
        <div *ngIf="!loading && produtos.length > 0" class="table">
          <div class="table-header">
            <span class="th col-produto">Produto</span>
            <span class="th col-numero">Qtd.</span>
            <span class="th col-setor">Setor</span>
            <span class="th col-acoes">Ações</span>
          </div>

          <div class="table-row" *ngFor="let p of produtos; trackBy: trackById">
            <div class="cell col-produto">
              <div class="prod-name">{{ p.nome }}</div>
              <div class="prod-code muted" *ngIf="p.codigoBarra">
                cód: {{ p.codigoBarra }}
              </div>
            </div>

            <span class="cell col-numero">
              {{ p.quantidade }}
            </span>

            <span class="cell col-setor">
              {{ nomeSetor(p) }}
            </span>

            <span class="cell col-acoes">
              <button
                type="button"
                class="icon-btn"
                title="Reativar (desfazer)"
                (click)="reativarProduto(p)"
                [disabled]="!p.id || reativandoId === p.id"
              >
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
    .material-symbols-outlined{
      font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
    }

    .page{
      min-height:100dvh;
      padding:20px 18px;
      background:var(--bg);
      color:var(--text);
    }

    .topbar{
      display:flex;
      align-items:center;
      gap:16px;
      margin:4px 0 16px;
    }
    .link{
      display:inline-flex;
      align-items:center;
      gap:6px;
      background:transparent;
      border:1px solid #d4af37;
      color:var(--text);
      border-radius:999px;
      height:36px;
      padding:0 12px;
      cursor:pointer;
      text-decoration:none;
    }
    .link:hover{
      background:rgba(240,210,122,.10);
      box-shadow:0 0 14px rgba(240,210,122,.45);
    }

    .title h2{
      margin:0;
      font-size:1.4rem;
    }
    .title .muted{
      font-size:.85rem;
    }
    .spacer{ flex:1; }

    .content{ display:block; }

    .card{
      background:var(--surface);
      border:1px solid var(--border);
      border-radius:var(--radius);
      box-shadow:var(--shadow);
      padding:16px 16px 18px;
      max-width:1120px;
      margin:0 auto;
    }
    .card__header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:16px;
      margin-bottom:12px;
    }

    .loading{
      display:flex;
      align-items:center;
      gap:10px;
      padding:10px 4px;
    }
    .spinner{
      width:18px;
      height:18px;
      border-radius:50%;
      border:2px solid rgba(255,255,255,.45);
      border-top-color:#fff;
      animation:spin .8s linear infinite;
    }
    @keyframes spin{ to{ transform:rotate(360deg); } }

    .empty{
      margin:18px 4px 6px;
      font-size:.9rem;
      color:var(--muted);
    }

    /* ---------- TABELA (mesmo padrão do estoque) ---------- */

    .table{
      margin-top:10px;
      border-radius:12px;
      border:1px solid var(--border);
      overflow:hidden;
      background:#050814;

      display:table;
      width:100%;
      border-collapse:collapse;
      table-layout:fixed;
    }

    .table-header{
      display:table-row;
      background:rgba(15,21,40,.96);
      font-size:.78rem;
      text-transform:uppercase;
      letter-spacing:.04em;
      color:var(--muted);
    }

    .table-row{
      display:table-row;
      font-size:.9rem;
    }

    .table-header .th,
    .table-row .cell{
      display:table-cell;
      padding:8px 12px;
      border-bottom:1px solid rgba(148,163,184,.25);
      border-right:1px solid rgba(148,163,184,.25);
      vertical-align:middle;
    }

    .table-header .th:last-child,
    .table-row .cell:last-child{
      border-right:none;
    }

    /* larguras das colunas */
    .table .col-produto{ width:52%; }
    .table .col-numero { width:14%; }
    .table .col-setor  { width:22%; }
    .table .col-acoes  { width:12%; }

    /* alinhamento */
    .table-header .col-numero{ text-align:right; }
    .table-row .col-numero{
      text-align:right;
      font-variant-numeric:tabular-nums;
    }
    .table-header .col-acoes{ text-align:right; }
    .table-row .col-acoes{ text-align:right; }

    /* zebra */
    .table-row:nth-of-type(odd){ background:#050814; }
    .table-row:nth-of-type(even){ background:#070b19; }

    .prod-name{
      font-weight:500;
      word-break:break-word;
    }
    .prod-code{
      font-size:.78rem;
      margin-top:2px;
    }

    .col-setor{
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    .icon-btn{
      width:30px;
      height:30px;
      padding:0;
      border-radius:999px;
      border:1px solid rgba(240,210,122,.6);
      background:transparent;
      display:inline-grid;
      place-items:center;
      cursor:pointer;
      color:var(--muted);
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
      opacity:.45;
      cursor:default;
      box-shadow:none;
      border-color:rgba(127,127,127,.5);
    }

    .muted{ color:var(--muted); }

    @media (max-width: 720px){
      .table .col-setor{
        display:none;
      }
      .table .col-produto{ width:66%; }
      .table .col-numero { width:22%; }
      .table .col-acoes  { width:12%; }
    }
  `],
})
export class ProdutosDesativadosPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private usuarioService = inject(UsuarioService);
  private produtoService = inject(ProdutoService);
  private setorService = inject(SetorService);
  private dialog = inject(MatDialog);

  lojaId = 0;
  loja: Loja | null = null;

  produtos: Produto[] = [];
  loading = false;

  reativandoId: number | null = null;

  private setoresPorId = new Map<number, string>();
  private setoresAtivos = new Set<number>();

  ngOnInit(): void {
    this.lojaId = Number(this.route.snapshot.paramMap.get('id')) || 0;
    if (!this.lojaId) {
      this.router.navigate(['/minhas-lojas']);
      return;
    }
    this.carregarDados();
  }

  private toNumber(value: number | string | null | undefined): number {
    const raw = typeof value === 'string' ? value.trim().replace(/\s/g, '').replace(',', '.') : value;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  private carregarDados(): void {
    this.loading = true;

    forkJoin({
      loja: this.usuarioService.loja(this.lojaId),
      setores: this.setorService.listar(),
      produtos: this.produtoService.listarDesativados(),
    }).subscribe({
      next: ({ loja, setores, produtos }) => {
        this.loja = loja ?? null;

        this.setoresPorId.clear();
        this.setoresAtivos.clear();
        for (const s of setores ?? []) {
          this.setoresPorId.set(s.id, s.nome);
          if (s.ativo === true) {
            this.setoresAtivos.add(s.id);
          }
        }

        this.produtos = (produtos ?? []).map(p => ({
          ...p,
          quantidade: this.toNumber(p.quantidade),
        }));

        this.loading = false;
      },
      error: err => {
        console.error('[ProdutosDesativadosPage] erro ao carregar dados', err);
        this.loading = false;
      },
    });
  }

  trackById(_: number, item: Produto): number | undefined {
    return item.id;
  }

  nomeSetor(p: Produto): string {
    if (!p.setorFilhoId) return '—';
    return this.setoresPorId.get(p.setorFilhoId) ?? `#${p.setorFilhoId}`;
  }

  setorAtivo(p: Produto): boolean {
    return !!p.setorFilhoId && this.setoresAtivos.has(p.setorFilhoId);
  }

  reativarProduto(produto: Produto): void {
    if (!produto.id) {
      console.warn('[ProdutosDesativadosPage] produto sem id, não é possível reativar', produto);
      return;
    }

    if (!this.setorAtivo(produto)) {
      const setorId = produto.setorFilhoId ?? 0;
      if (setorId <= 0) {
        return;
      }
      this.dialog.open(ReativacaoSetorConfirmDialogComponent, {
        autoFocus: false,
        data: {
          setorNome: this.nomeSetor(produto),
        },
      }).afterClosed().subscribe((confirmou: boolean | undefined) => {
        if (!confirmou) return;

        this.reativandoId = produto.id!;
        this.setorService.reativar(setorId).subscribe({
          next: () => {
            this.setoresAtivos.add(setorId);
            this.produtoService.reativar(produto.id!).subscribe({
              next: () => {
                this.produtos = this.produtos.filter(x => x.id !== produto.id);
                this.reativandoId = null;
              },
              error: err => {
                console.error('[ProdutosDesativadosPage] erro ao reativar produto', err);
                this.reativandoId = null;
              },
            });
          },
          error: err => {
            console.error('[ProdutosDesativadosPage] erro ao reativar setor para produto', err);
            this.reativandoId = null;
          },
        });
      });
      return;
    }

    this.reativandoId = produto.id;

    this.produtoService.reativar(produto.id).subscribe({
      next: () => {
        // remove da lista sem precisar recarregar tudo
        this.produtos = this.produtos.filter(x => x.id !== produto.id);
        this.reativandoId = null;
      },
      error: err => {
        console.error('[ProdutosDesativadosPage] erro ao reativar produto', err);
        this.reativandoId = null;
      },
    });
  }
}

interface ReativacaoSetorConfirmData {
  setorNome: string;
}

@Component({
  standalone: true,
  selector: 'app-reativacao-setor-confirm-dialog',
  imports: [CommonModule, MatDialogModule],
  template: `
    <section class="dialog-card">
      <header class="dialog-header">
        <div class="avatar">
          <span class="material-symbols-outlined">help</span>
        </div>
        <div class="title">
          <h3>Reativar setor</h3>
          <p>
            O setor "<strong>{{ data.setorNome }}</strong>" está desativado.
            Deseja reativar o setor e também reativar este produto?
          </p>
        </div>
      </header>

      <footer class="dialog-footer">
        <button class="btn btn-outline" type="button" (click)="fechar(false)">Não</button>
        <button class="btn btn-gold" type="button" (click)="fechar(true)">Sim</button>
      </footer>
    </section>
  `,
  styles: [`
    .dialog-card{
      min-width:min(520px, 94vw);
      background:var(--surface);
      color:var(--text);
      border:1px solid rgba(240,210,122,.7);
      border-radius:16px;
      box-shadow:0 0 0 1px rgba(0,0,0,.7), 0 0 38px rgba(240,210,122,.35);
      padding:16px;
    }
    .dialog-header{ display:flex; gap:12px; align-items:flex-start; }
    .avatar{
      width:40px; height:40px; border-radius:12px; flex-shrink:0;
      display:grid; place-items:center; color:#151515;
      background: linear-gradient(180deg, rgba(255,255,255,.35), transparent 40%),
                  linear-gradient(135deg,#F5D97A 0%,#D4AF37 45%,#B8860B 100%);
    }
    .title h3{ margin:0 0 6px; font-size:1.1rem; }
    .title p{ margin:0; color:var(--muted); line-height:1.4; }
    .dialog-footer{
      display:flex; justify-content:flex-end; gap:10px; margin-top:16px;
    }
    .btn{
      height:38px; padding:0 16px; border-radius:999px; border:1px solid transparent;
      cursor:pointer; font-weight:600;
    }
    .btn-outline{
      background:transparent; border-color:var(--border); color:var(--muted);
    }
    .btn-outline:hover{ background:rgba(127,127,127,.12); color:var(--text); }
    .btn-gold{
      border-color:#9e7b14;
      color:#151515;
      background:
        radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.20), transparent 60%),
        linear-gradient(180deg, #F5DF7B 0%, var(--primary) 55%, var(--primary-600) 100%);
      box-shadow:0 8px 20px rgba(218,171,31,.40), inset 0 -2px 0 rgba(0,0,0,.18);
    }
  `],
})
export class ReativacaoSetorConfirmDialogComponent {
  constructor(
    private ref: MatDialogRef<ReativacaoSetorConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: ReativacaoSetorConfirmData,
  ) {}

  fechar(ok: boolean): void {
    this.ref.close(ok);
  }
}
