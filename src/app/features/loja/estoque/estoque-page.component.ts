// src/app/features/loja/estoque/estoque-page.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { ProdutoService, Produto } from '../../../core/services/produto.service';
import { SetorService } from '../../../core/services/setor.service';
import { UsuarioService, Loja } from '../../../core/services/usuario.service';
import {
  ProdutoFormDialogComponent,
  ProdutoFormDialogData,
} from './produto-form.dialog';
import { EstoqueMovimentoDialogComponent } from './estoque-movimento.dialog';
import { EstoqueTransferenciaDialogComponent } from './estoque-transferencia.dialog';

@Component({
  standalone: true,
  selector: 'app-estoque-page',
  imports: [CommonModule, FormsModule, RouterLink, MatDialogModule],
  template: `
  <section class="page">
    <header class="topbar">
      <a class="link" [routerLink]="['/loja', lojaId]">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>Voltar para o painel</span>
      </a>

      <div class="title">
        <h2>Estoque</h2>
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
            <h3>Produtos em estoque</h3>
            <small class="muted">
              {{ loading ? 'Carregando...' : 'Itens: ' + produtos.length }}
            </small>
          </div>

          <div class="header-actions">
            <button
              class="btn-secondary"
              type="button"
              (click)="verMovimentos()"
            >
              <span class="material-symbols-outlined">swap_vert</span>
              <span>Movimentos</span>
            </button>

            <button
              class="btn-secondary"
              type="button"
              (click)="verDesativados()"
            >
              <span class="material-symbols-outlined">history</span>
              <span>Desativados</span>
            </button>

            <button class="btn-gold" type="button" (click)="adicionarProduto()">
              <span class="material-symbols-outlined">add</span>
              <span>Novo produto</span>
            </button>
          </div>
        </header>

        <div class="search-row">
          <span class="material-symbols-outlined">search</span>
          <input
            type="text"
            [(ngModel)]="filtro"
            (ngModelChange)="onFiltroChange($event)"
            placeholder="Buscar por nome ou codigo de barras..."
          />
        </div>

        <!-- LOADING -->
        <div *ngIf="loading" class="loading">
          <div class="spinner"></div>
          <span>Carregando produtos...</span>
        </div>

        <!-- EMPTY -->
        <p *ngIf="!loading && produtosFiltrados.length === 0" class="empty">
          Nenhum produto cadastrado ainda.
        </p>

        <!-- TABLE -->
        <div *ngIf="!loading && produtosFiltrados.length > 0" class="table">
          <div class="table-header">
            <span class="th col-produto">Produto</span>
            <span class="th col-numero">Qtd.</span>
            <span class="th col-numero">Preço custo</span>
            <span class="th col-numero">Preço venda</span>
            <span class="th col-numero">Margem</span>
            <span class="th col-setor">Setor</span>
            <span class="th col-acoes">Ações</span>
          </div>

          <div
            class="table-row"
            *ngFor="let p of produtosFiltrados; trackBy: trackById"
          >
            <!-- produto + código -->
            <div class="cell col-produto">
              <div class="prod-name">{{ p.nome }}</div>
              <div class="prod-code muted" *ngIf="p.codigoBarra">
                cód: {{ p.codigoBarra }}
              </div>
            </div>

            <span class="cell col-numero">
              {{ p.quantidade }}
            </span>

            <span class="cell col-numero">
              {{ fmtMoney(p.precoCusto) }}
            </span>

            <span class="cell col-numero">
              {{ fmtMoney(p.precoVenda) }}
            </span>

            <span class="cell col-numero">
              {{ fmtNumber(p.margemLucro) }}%
            </span>

            <span class="cell col-setor">
              {{ nomeSetor(p) }}
            </span>

            <span class="cell col-acoes">
              <button
                type="button"
                class="icon-btn"
                title="Editar produto"
                (click)="editarProduto(p)"
                [disabled]="loading || !p.id || desativandoId === p.id"
              >
                <span class="material-symbols-outlined">edit</span>
              </button>

              <button
                type="button"
                class="icon-btn"
                title="Movimentar estoque"
                (click)="movimentarEstoque(p)"
                [disabled]="loading || !p.id || desativandoId === p.id"
              >
                <span class="material-symbols-outlined">swap_vert</span>
              </button>

              <button
                type="button"
                class="icon-btn"
                title="Transferir estoque"
                (click)="transferirEstoque(p)"
                [disabled]="loading || !p.id || desativandoId === p.id"
              >
                <span class="material-symbols-outlined">storefront</span>
              </button>

              <button
                type="button"
                class="icon-btn"
                title="Desativar produto"
                (click)="desativarProduto(p)"
                [disabled]="loading || !p.id || desativandoId === p.id"
              >
                <span class="material-symbols-outlined">delete</span>
              </button>

              <!-- botão de reativar fica apenas na lista de desativados -->
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

  .header-actions{
    display:flex;
    gap:10px;
    align-items:center;
  }

  .search-row{
    display:flex;
    align-items:center;
    gap:8px;
    border:1px solid var(--border);
    border-radius:12px;
    background:#060b18;
    padding:0 10px;
    height:40px;
    margin-bottom:10px;
  }
  .search-row input{
    flex:1;
    background:transparent;
    border:none;
    color:var(--text);
    outline:none;
    font-size:.95rem;
  }
  .search-row .material-symbols-outlined{
    color:var(--muted);
    font-size:20px;
  }

  .btn-gold{
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding:6px 16px;
    border-radius:999px;
    border:1px solid #9e7b14;
    cursor:pointer;
    background:
      radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.20), transparent 60%),
      linear-gradient(180deg,#F5DF7B 0%, var(--primary) 55%, var(--primary-600) 100%);
    color:#151515;
    box-shadow:0 8px 20px rgba(218,171,31,.45), inset 0 -2px 0 rgba(0,0,0,.18);
    font-weight:600;
    font-size:.9rem;
  }
  .btn-gold:hover{
    background:
      radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.26), transparent 60%),
      linear-gradient(180deg,#F9E992 0%, #E3BD43 55%, #BE8E1A 100%);
  }

  .btn-secondary{
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding:6px 14px;
    border-radius:999px;
    border:1px solid var(--border);
    background:rgba(15,23,42,.9);
    color:var(--muted);
    font-size:.85rem;
    cursor:pointer;
  }
  .btn-secondary:hover{
    border-color:#e5e7eb;
    color:var(--text);
    background:rgba(148,163,184,.16);
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

  /* ------------ TABELA EM "DISPLAY: TABLE" ------------ */

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

  /* larguras das colunas (todas compartilham) */
  .table .col-produto{ width:32%; }
  .table .col-numero { width:11%; }
  .table .col-setor { width:18%; }
  .table .col-acoes { width:12%; }

  /* alinhamento dos títulos */
  .table-header .col-produto,
  .table-header .col-setor{
    text-align:left;
  }
  .table-header .col-numero{
    text-align:right;
  }
  .table-header .col-acoes{
    text-align:right;
  }

  /* alinhamento das células de dados */
  .table-row .col-produto,
  .table-row .col-setor{
    text-align:left;
  }
  .table-row .col-numero{
    text-align:right;
    font-variant-numeric:tabular-nums;
  }

  /* zebra */
  .table-row:nth-of-type(odd){
    background:#050814;
  }
  .table-row:nth-of-type(even){
    background:#070b19;
  }

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

  .col-acoes{
    text-align:right;
  }
  .col-acoes .icon-btn{
    margin-left:4px;
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

  /* ---------- RESPONSIVO ---------- */

  @media (max-width: 900px){
    .card{ padding:12px; }
    .card__header h3{ font-size:1rem; }
    .table-row .cell{ font-size:.85rem; }
  }

  @media (max-width: 720px){
    /* esconde coluna "Setor" nas telas pequenas */
    .table .col-setor{
      display:none;
    }
  }
  `],
})
export class EstoquePageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private usuarioService = inject(UsuarioService);
  private produtoService = inject(ProdutoService);
  private setorService = inject(SetorService);
  private dialog = inject(MatDialog);

  lojaId = 0;
  loja: Loja | null = null;
  produtos: Produto[] = [];
  filtro = '';
  filtroAplicado = '';
  loading = false;
  private filtroTimer: ReturnType<typeof setTimeout> | null = null;

  // ✅ loading por linha (para desativar sem derrubar a tela toda)
  desativandoId: number | null = null;

  private setoresPorId = new Map<number, string>();

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

  fmtMoney(value: number | string | null | undefined): string {
    const n = this.toNumber(value);
    return n.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  fmtNumber(value: number | string | null | undefined): string {
    const n = this.toNumber(value);
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private carregarDados(): void {
    this.loading = true;

    forkJoin({
      loja: this.usuarioService.loja(this.lojaId),
      setores: this.setorService.listar(),
      produtos: this.produtoService.listar(),
    }).subscribe({
      next: ({ loja, setores, produtos }) => {
        this.loja = loja ?? null;

        this.setoresPorId.clear();
        for (const s of setores ?? []) {
          this.setoresPorId.set(s.id, s.nome);
        }

        this.produtos = (produtos ?? []).map(p => ({
          ...p,
          quantidade: this.toNumber(p.quantidade),
          precoCusto: this.toNumber(p.precoCusto),
          precoVenda: this.toNumber(p.precoVenda),
          margemLucro: this.toNumber(p.margemLucro),
        }));

        this.loading = false;
      },
      error: err => {
        console.error('[EstoquePage] erro ao carregar dados', err);
        this.loading = false;
      }
    });
  }

  trackById(_: number, item: Produto): number | undefined {
    return item.id;
  }

  get produtosFiltrados(): Produto[] {
    const f = this.filtroAplicado.trim().toLowerCase();
    if (!f) return this.produtos;
    return this.produtos.filter(p => {
      const nome = (p.nome ?? '').toLowerCase();
      const codigo = (p.codigoBarra ?? '').toLowerCase();
      return nome.includes(f) || codigo.includes(f);
    });
  }

  onFiltroChange(value: string): void {
    this.filtro = value ?? '';
    if (this.filtroTimer) clearTimeout(this.filtroTimer);
    this.filtroTimer = setTimeout(() => {
      this.filtroAplicado = this.filtro;
    }, 200);
  }

  nomeSetor(p: Produto): string {
    if (!p.setorFilhoId) return '—';
    return this.setoresPorId.get(p.setorFilhoId) ?? `#${p.setorFilhoId}`;
  }

  editarProduto(produto: Produto): void {
    if (!this.lojaId) return;

    const data: ProdutoFormDialogData = {
      lojaId: this.lojaId,
      produto,
    };

    this.dialog.open(ProdutoFormDialogComponent, {
      autoFocus: false,
      data,
    })
    .afterClosed()
    .subscribe((ok: boolean) => {
      if (ok) {
        this.carregarDados();
      }
    });
  }

  movimentarEstoque(produto: Produto): void {
    if (!produto?.id) return;

    this.dialog.open(EstoqueMovimentoDialogComponent, {
      autoFocus: false,
      width: '1000px',
      maxWidth: '96vw',
      panelClass: 'movimento-dialog-panel',
      data: { produto },
    })
    .afterClosed()
    .subscribe((res?: { novaQuantidade?: number }) => {
      if (!res || typeof res.novaQuantidade !== 'number') return;
      const idx = this.produtos.findIndex(p => p.id === produto.id);
      if (idx >= 0) {
        this.produtos[idx] = {
          ...this.produtos[idx],
          quantidade: res.novaQuantidade,
        };
      }
    });
  }

  transferirEstoque(produto: Produto): void {
    if (!produto?.id) return;

    this.dialog.open(EstoqueTransferenciaDialogComponent, {
      autoFocus: false,
      width: '1100px',
      maxWidth: '96vw',
      panelClass: 'transfer-dialog-panel',
      data: { produto, lojaId: this.lojaId },
    })
    .afterClosed()
    .subscribe((ok?: boolean) => {
      if (ok) this.carregarDados();
    });
  }

  // ✅ NÃO chama carregarDados() -> não ativa loading global
  desativarProduto(produto: Produto): void {
    if (!produto.id) return;

    if (!confirm(`Desativar o produto "${produto.nome}"?`)) {
      return;
    }

    this.desativandoId = produto.id;

    this.produtoService.desativar(produto.id).subscribe({
      next: () => {
        // remove da lista sem recarregar tudo (sem "Carregando...")
        this.produtos = this.produtos.filter(x => x.id !== produto.id);
        this.desativandoId = null;
      },
      error: err => {
        console.error('[EstoquePage] erro ao desativar produto', err);
        this.desativandoId = null;
      },
    });
  }

  adicionarProduto(): void {
    if (!this.lojaId) return;

    const data: ProdutoFormDialogData = { lojaId: this.lojaId };

    this.dialog.open(ProdutoFormDialogComponent, {
      autoFocus: false,
      data,
    })
    .afterClosed()
    .subscribe((ok: boolean) => {
      if (ok) {
        this.carregarDados();
      }
    });
  }

  verDesativados(): void {
    this.router.navigate(['/loja', this.lojaId, 'estoque', 'desativados']);
  }

  verMovimentos(): void {
    this.router.navigate(['/loja', this.lojaId, 'estoque', 'movimentos']);
  }
}
