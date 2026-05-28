// src/app/features/loja/estoque/estoque-page.component.ts
import { Component, HostListener, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { PdvService } from '../../../core/services/pdv.service';
import { ProdutoService, Produto } from '../../../core/services/produto.service';
import { SetorService } from '../../../core/services/setor.service';
import { UsuarioService, Loja } from '../../../core/services/usuario.service';
import {
  ProdutoFormDialogComponent,
  ProdutoFormDialogData,
} from './produto-form.dialog';
import { EstoqueMovimentoDialogComponent } from './estoque-movimento.dialog';
import { EstoqueTransferenciaDialogComponent } from './estoque-transferencia.dialog';
import { VendaDetalhesDialogComponent } from '../relatorios/vendas-page.component';

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
      <div class="stock-layout">
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
              class="icon-btn"
              type="button"
              title="Ranking por setor"
              (click)="abrirRankingSetores()"
            >
              <span class="material-symbols-outlined">visibility</span>
            </button>

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
  .stock-layout{
    display:grid;
    grid-template-columns: 1fr;
    gap:8px;
    align-items:start;
  }

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
  .table .col-produto{ width:20%; }
  .table .col-numero { width:11%; }
  .table .col-setor { width:13%; }
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
  private pdv = inject(PdvService);
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

  get setoresRank(): Array<{
    setorId: number;
    nome: string;
    custoTotal: number;
    vendaTotal: number;
    quantidade: number;
    lucroTotal: number;
    percCusto: number;
    percVenda: number;
    percLucro: number;
  }> {
    const map = new Map<number, { setorId: number; nome: string; custoTotal: number; vendaTotal: number; quantidade: number; lucroTotal: number }>();
    for (const p of this.produtos) {
      const setorId = p.setorFilhoId ?? 0;
      const nome = setorId ? (this.setoresPorId.get(setorId) ?? `#${setorId}`) : 'Sem setor';
      const qtd = Number(p.quantidade ?? 0);
      const custo = Number(p.precoCusto ?? 0) * qtd;
      const venda = Number(p.precoVenda ?? 0) * qtd;
      const lucro = venda - custo;
      const current = map.get(setorId) ?? { setorId, nome, custoTotal: 0, vendaTotal: 0, quantidade: 0, lucroTotal: 0 };
      current.custoTotal += custo;
      current.vendaTotal += venda;
      current.quantidade += qtd;
      current.lucroTotal += lucro;
      map.set(setorId, current);
    }
    const totals = Array.from(map.values());
    const totalCusto = totals.reduce((sum, item) => sum + item.custoTotal, 0);
    const totalVenda = totals.reduce((sum, item) => sum + item.vendaTotal, 0);
    const totalLucro = totals.reduce((sum, item) => sum + item.lucroTotal, 0);
    return Array.from(map.values())
      .map(item => ({
        ...item,
        percCusto: totalCusto > 0 ? (item.custoTotal / totalCusto) * 100 : 0,
        percVenda: totalVenda > 0 ? (item.vendaTotal / totalVenda) * 100 : 0,
        percLucro: totalLucro > 0 ? (item.lucroTotal / totalLucro) * 100 : 0,
      }))
      .sort((a, b) => b.vendaTotal - a.vendaTotal);
  }

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

  abrirRankingSetores(): void {
    this.dialog.open(EstoqueRankingDialogComponent, {
      autoFocus: false,
      maxWidth: '96vw',
      panelClass: 'ml-dialog',
      data: { setores: this.setoresRank },
    });
  }

  setScrollable(pill: HTMLElement, name: HTMLElement){
    if (!pill || !name) return;
    if (name.scrollWidth > name.clientWidth) {
      pill.classList.add('scrollable');
    } else {
      pill.classList.remove('scrollable');
    }
  }

  clearScrollable(pill: HTMLElement){
    pill?.classList.remove('scrollable');
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

  private truncateTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.trunc(value * factor) / factor;
  }

  private trimTrailingZeros(value: string): string {
    if (!value.includes(',') && !value.includes('.')) return value;
    return value.replace(/([,.]\d*?)0+$/g, '$1').replace(/[,.]\s*$/g, '');
  }

  fmtMoneyResumo(value: number | string | null | undefined): string {
    const n = this.toNumber(value);
    const abs = Math.abs(n);
    if (abs < 1000) return this.fmtMoney(n);

    let scaled = n;
    let suffix = '';
    if (abs >= 1_000_000_000) {
      scaled = n / 1_000_000_000;
      suffix = 'bi';
    } else if (abs >= 1_000_000) {
      scaled = n / 1_000_000;
      suffix = 'mi';
    } else {
      scaled = n / 1_000;
      suffix = 'mil';
    }

    const truncated = this.truncateTo(scaled, 2);
    const formatted = truncated.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `R$ ${this.trimTrailingZeros(formatted)}${suffix}`;
  }

  fmtPercentResumo(value: number | string | null | undefined): string {
    const n = this.toNumber(value);
    const truncated = this.truncateTo(n, 2);
    const formatted = truncated.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${this.trimTrailingZeros(formatted)}%`;
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

  @HostListener('window:keydown', ['$event'])
  onAtalhoDetalhes(event: KeyboardEvent): void {
    if (event.altKey && (event.key === 'v' || event.key === 'V')) {
      if (this.isTextInput(event.target)) return;
      event.preventDefault();
      this.abrirUltimaVenda();
    }
  }

  private abrirUltimaVenda(): void {
    this.pdv.list(undefined, undefined, undefined, 0, 200).subscribe({
      next: (vendas) => {
        if (!vendas?.length) return;
        const ordered = [...vendas].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const saleIds = ordered.map(v => v.id);
        this.dialog.open(VendaDetalhesDialogComponent, {
          autoFocus: false,
          maxWidth: '95vw',
          panelClass: 'ml-dialog',
          data: { saleId: saleIds[0], saleIds, index: 0 },
        });
      },
    });
  }

  private isTextInput(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }
}

type EstoqueRankItem = {
  setorId: number;
  nome: string;
  custoTotal: number;
  vendaTotal: number;
  quantidade: number;
  lucroTotal: number;
  percCusto: number;
  percVenda: number;
  percLucro: number;
};

@Component({
  standalone: true,
  selector: 'app-estoque-ranking-dialog',
  imports: [CommonModule, MatDialogModule],
  template: `
    <div class="dialog">
      <header class="dialog__header">
        <div>
          <h3>Ranking por setor</h3>
          <small class="muted">Setores: {{ data.setores.length }}</small>
        </div>
        <button type="button" class="icon-btn" (click)="close()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </header>

      <div *ngIf="!data.setores.length" class="empty">
        Nenhum setor com produtos.
      </div>

      <div *ngIf="data.setores.length" class="rank-table">
        <div class="rank-header">
          <span class="rank-col-setor">Setor</span>
          <span class="num rank-col-money">Custo total</span>
          <span class="num rank-col-pct">% investido</span>
          <span class="num rank-col-money">Venda total</span>
          <span class="num rank-col-pct">% retorno</span>
          <span class="num rank-col-money">Lucro</span>
          <span class="num rank-col-pct">% lucro</span>
          <span class="num rank-col-qty">Qtd.</span>
        </div>
        <div class="rank-row" *ngFor="let s of data.setores">
          <span class="rank-name rank-col-setor">{{ s.nome }}</span>
          <span class="num rank-col-money" [attr.title]="fmtMoney(s.custoTotal)">{{ fmtMoneyResumo(s.custoTotal) }}</span>
          <span class="num rank-col-pct" [attr.title]="fmtNumber(s.percCusto) + '%'">{{ fmtPercentResumo(s.percCusto) }}</span>
          <span class="num rank-col-money" [attr.title]="fmtMoney(s.vendaTotal)">{{ fmtMoneyResumo(s.vendaTotal) }}</span>
          <span class="num rank-col-pct" [attr.title]="fmtNumber(s.percVenda) + '%'">{{ fmtPercentResumo(s.percVenda) }}</span>
          <span class="num rank-col-money" [attr.title]="fmtMoney(s.lucroTotal)">{{ fmtMoneyResumo(s.lucroTotal) }}</span>
          <span class="num rank-col-pct" [attr.title]="fmtNumber(s.percLucro) + '%'">{{ fmtPercentResumo(s.percLucro) }}</span>
          <span class="num rank-col-qty" [attr.title]="s.quantidade">{{ s.quantidade }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog{
      background:var(--surface);
      border:1px solid var(--border);
      border-radius:18px;
      box-shadow:var(--shadow);
      padding:16px 16px 18px;
      max-width:1000px;
      width:90vw;
      color:var(--text);
    }
    .dialog__header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:16px;
      margin-bottom:12px;
    }
    .dialog__header h3{
      margin:0;
      font-size:1.1rem;
    }
    .muted{ color:var(--muted); }
    .empty{
      margin:10px 4px;
      color:var(--muted);
    }
    .rank-table{
      border:1px solid var(--border);
      border-radius:12px;
      overflow:hidden;
      background:#050814;
      display:table;
      width:100%;
      border-collapse:collapse;
      table-layout:fixed;
      max-height:60vh;
      overflow-y:auto;
    }
    .rank-header, .rank-row{
      display:table-row;
      align-items:center;
    }
    .rank-header{
      background:rgba(15,21,40,.96);
      font-size:.74rem;
      text-transform:uppercase;
      letter-spacing:.04em;
      color:var(--muted);
    }
    .rank-row{
      font-size:.9rem;
    }
    .rank-header span,
    .rank-row span{
      display:table-cell;
      padding:10px 12px;
      border-bottom:1px solid rgba(148,163,184,.25);
      border-right:1px solid rgba(148,163,184,.25);
      vertical-align:middle;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .rank-header span:last-child,
    .rank-row span:last-child{
      border-right:none;
    }
    .rank-col-setor{ width:18%; }
    .rank-col-money{ width:14%; }
    .rank-col-pct{ width:10%; }
    .rank-col-qty{ width:8%; }
    .rank-name{ font-weight:600; }
    .num{ text-align:right; font-variant-numeric: tabular-nums; }
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
    .icon-btn:hover{
      background:rgba(240,210,122,.14);
      color:var(--text);
      border-color:#f0d27a;
      box-shadow:0 0 0 1px rgba(240,210,122,.45);
      transform:translateY(-1px);
    }
  `],
})
export class EstoqueRankingDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { setores: EstoqueRankItem[] },
    private ref: MatDialogRef<EstoqueRankingDialogComponent>
  ) {}

  close(): void {
    this.ref.close();
  }

  private toNumber(value: number | string | null | undefined): number {
    const raw = typeof value === 'string' ? value.trim().replace(/\s/g, '').replace(',', '.') : value;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  private truncateTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.trunc(value * factor) / factor;
  }

  private trimTrailingZeros(value: string): string {
    if (!value.includes(',') && !value.includes('.')) return value;
    return value.replace(/([,.]\d*?)0+$/g, '$1').replace(/[,.]\s*$/g, '');
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

  fmtMoneyResumo(value: number | string | null | undefined): string {
    const n = this.toNumber(value);
    const abs = Math.abs(n);
    if (abs < 1000) return this.fmtMoney(n);

    let scaled = n;
    let suffix = '';
    if (abs >= 1_000_000_000) {
      scaled = n / 1_000_000_000;
      suffix = 'bi';
    } else if (abs >= 1_000_000) {
      scaled = n / 1_000_000;
      suffix = 'mi';
    } else {
      scaled = n / 1_000;
      suffix = 'mil';
    }

    const truncated = this.truncateTo(scaled, 2);
    const formatted = truncated.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `R$ ${this.trimTrailingZeros(formatted)}${suffix}`;
  }

  fmtPercentResumo(value: number | string | null | undefined): string {
    const n = this.toNumber(value);
    const truncated = this.truncateTo(n, 2);
    const formatted = truncated.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${this.trimTrailingZeros(formatted)}%`;
  }

  fmtNumber(value: number | string | null | undefined): string {
    const n = this.toNumber(value);
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
