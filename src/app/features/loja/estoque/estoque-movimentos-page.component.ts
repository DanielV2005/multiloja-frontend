// src/app/features/loja/estoque/estoque-movimentos-page.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import {
  EstoqueMovimentoDto,
  EstoqueMovimentoMotivo,
  EstoqueMovimentoTipo,
  Produto,
  ProdutoService,
} from '../../../core/services/produto.service';
import { UsuarioService, Loja } from '../../../core/services/usuario.service';

@Component({
  standalone: true,
  selector: 'app-estoque-movimentos-page',
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
  <section class="page">
    <header class="topbar">
      <a class="link" [routerLink]="['/loja', lojaId, 'estoque']">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>Voltar para o estoque</span>
      </a>

      <div class="title">
        <h2>Movimentos de estoque</h2>
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
            <h3>Historico</h3>
            <small class="muted">
              {{
                loading
                  ? 'Carregando...'
                  : totalMovimentos !== null
                    ? 'Mostrando ' + movimentos.length + ' de ' + totalMovimentos
                    : 'Itens: ' + movimentos.length
              }}
            </small>
          </div>

          <form class="filters" [formGroup]="form" (ngSubmit)="buscar(true)">
            <div class="field">
              <div class="combo">
                <div class="combo-input-wrap">
                  <input
                    type="text"
                    formControlName="produtoNome"
                    placeholder="Todos os produtos"
                    autocomplete="off"
                    (input)="onProdutoInput()"
                    (focus)="menuProdutoAberto = true"
                    (blur)="fecharMenuProdutoComDelay()"
                  />
                  <button
                    type="button"
                    class="combo-toggle"
                    (mousedown)="$event.preventDefault()"
                    (click)="toggleMenuProduto()"
                  >
                    <span class="material-symbols-outlined">expand_more</span>
                  </button>
                </div>
                <div class="combo-menu" *ngIf="menuProdutoAberto">
                  <button
                    type="button"
                    class="combo-item"
                    *ngFor="let p of produtosFiltradosPorTexto"
                    (mousedown)="$event.preventDefault()"
                    (click)="selecionarProduto(p)"
                  >
                    {{ p.nome }}
                  </button>
                  <div class="combo-empty" *ngIf="produtosFiltradosPorTexto.length === 0">
                    Nenhum produto encontrado.
                  </div>
                </div>
              </div>
            </div>

            <div class="field">
              <input
                type="text"
                formControlName="dataInicio"
                placeholder="dd/mm/aaaa"
                inputmode="numeric"
                autocomplete="off"
              />
            </div>
            <span class="range-sep">-</span>
            <div class="field">
              <input
                type="text"
                formControlName="dataFim"
                placeholder="dd/mm/aaaa"
                inputmode="numeric"
                autocomplete="off"
              />
            </div>

            <button class="btn-secondary" type="submit">Atualizar</button>
          </form>
        </header>

        <div *ngIf="loading" class="loading">
          <div class="spinner"></div>
          <span>Carregando movimentos...</span>
        </div>

        <p *ngIf="!loading && movimentos.length === 0" class="empty">
          Nenhum movimento encontrado.
        </p>

        <div *ngIf="!loading && movimentos.length > 0" class="table-wrap" (scroll)="onTableScroll($event)">
          <div class="table">
          <div class="table-header">
            <span class="th col-data">Data</span>
            <span class="th col-produto">Produto</span>
            <span class="th col-tipo">Tipo</span>
            <span class="th col-motivo">Motivo</span>
            <span class="th col-numero">Qtd.</span>
            <span class="th col-numero">Estoque</span>
            <span class="th col-ref">Origem</span>
          </div>

          <div class="table-row" *ngFor="let m of movimentos; trackBy: trackById">
            <span class="cell col-data">{{ fmtDate(m.createdAt) }}</span>
            <span class="cell col-produto">{{ produtoNome(m.produtoId) }}</span>
            <span class="cell col-tipo">
              <span class="pill" [class.in]="m.tipo === EstoqueMovimentoTipo.Entrada" [class.out]="m.tipo === EstoqueMovimentoTipo.Saida">
                {{ m.tipo === EstoqueMovimentoTipo.Entrada ? 'Entrada' : 'Saida' }}
              </span>
            </span>
            <span class="cell col-motivo">{{ motivoLabel(m.motivo) }}</span>
            <span class="cell col-numero">{{ m.quantidade }}</span>
            <span class="cell col-numero">{{ m.saldoAnterior }} -> {{ m.saldoPosterior }}</span>
            <span class="cell col-ref">
              <span *ngIf="m.referenciaTipo">{{ referenciaLabel(m.referenciaTipo) }}</span>
              <span class="muted" *ngIf="!m.referenciaTipo">-</span>
            </span>
          </div>
          </div>
          <div class="loading-more" *ngIf="loadingMore">
            <div class="spinner"></div>
            <span>Carregando mais...</span>
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

    .card{
      background:var(--surface);
      border:1px solid var(--border);
      border-radius:var(--radius);
      box-shadow:var(--shadow);
      padding:16px 16px 18px;
      max-width:1200px;
      margin:0 auto;
    }
    .card__header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:16px;
      margin-bottom:12px;
    }
    .filters{
      display:flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
    }
    .field{
      display:flex;
      align-items:center;
    }
    .combo{ position:relative; width:100%; }
    .combo-input-wrap{ position:relative; display:flex; width:100%; }
    .combo-input-wrap input{ padding-right:38px; width:100%; }
    .combo-toggle{
      position:absolute;
      right:6px;
      top:4px;
      width:28px;
      height:28px;
      border:none;
      border-radius:8px;
      background:transparent;
      color:var(--muted);
      display:grid;
      place-items:center;
      cursor:pointer;
    }
    .combo-toggle:hover{ background:rgba(148,163,184,.14); color:var(--text); }
    .combo-menu{
      position:absolute;
      left:0;
      right:0;
      top:40px;
      z-index:20;
      border:1px solid var(--border);
      border-radius:10px;
      background:#111827;
      box-shadow:var(--shadow);
      max-height:180px;
      overflow-y:auto;
      overflow-x:hidden;
    }
    .combo-item{
      width:100%;
      text-align:left;
      border:none;
      background:transparent;
      color:var(--text);
      padding:10px 12px;
      cursor:pointer;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .combo-item:hover{ background:rgba(148,163,184,.16); }
    .combo-empty{
      color:var(--muted);
      padding:10px 12px;
      font-size:.9rem;
    }
    input[type="text"],
    input[type="date"],
    select{
      height:36px;
      border-radius:10px;
      border:1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      padding: 0 8px;
      outline: none;
    }
    input[type="text"]{ min-width: 220px; }
    .range-sep{ color: var(--muted); padding: 0 4px; }
    select:focus{ border-color: var(--primary); box-shadow: var(--focus); }
    .btn-secondary{
      height:36px;
      padding:0 12px;
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

    .empty{ margin:18px 4px 6px; font-size:.9rem; color:var(--muted); }

    .table-wrap{
      margin-top:10px;
      border-radius:12px;
      border:1px solid var(--border);
      overflow:auto;
      max-height:60vh;
      background:#050814;
    }
    .table{
      border-radius:12px;
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
    .table-row{ display:table-row; font-size:.9rem; }
    .table-header .th,
    .table-row .cell{
      display:table-cell;
      padding:8px 12px;
      border-bottom:1px solid rgba(148,163,184,.25);
      border-right:1px solid rgba(148,163,184,.25);
      vertical-align:middle;
    }
    .table-header .th:last-child,
    .table-row .cell:last-child{ border-right:none; }

    .table .col-data{ width:14%; }
    .table .col-produto{ width:24%; }
    .table .col-tipo{ width:10%; }
    .table .col-motivo{ width:16%; }
    .table .col-numero{ width:10%; text-align:right; }
    .table .col-ref{ width:26%; }

    .pill{
      padding:4px 10px;
      border-radius:999px;
      border:1px solid var(--border);
      font-size:.82rem;
    }
    .pill.in{ color: #22c55e; border-color: rgba(34,197,94,.4); }
    .pill.out{ color: #ef4444; border-color: rgba(239,68,68,.4); }
    .muted{ color:var(--muted); }

    .loading-more{
      display:flex;
      align-items:center;
      gap:10px;
      padding:10px 12px;
      border-top:1px solid rgba(148,163,184,.25);
    }
  `],
})
export class EstoqueMovimentosPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private usuarioService = inject(UsuarioService);
  private produtoService = inject(ProdutoService);
  private fb = inject(FormBuilder);
  private formSub?: Subscription;

  lojaId = 0;
  loja: Loja | null = null;
  produtos: Produto[] = [];
  movimentos: EstoqueMovimentoDto[] = [];
  loading = false;
  loadingMore = false;
  hasMore = true;
  skip = 0;
  readonly pageSize = 100;
  private selectedProdutoId?: number;
  menuProdutoAberto = false;
  totalMovimentos: number | null = null;

  EstoqueMovimentoTipo = EstoqueMovimentoTipo;

  form = this.fb.group({
    produtoNome: [''],
    dataInicio: [''],
    dataFim: [''],
  });

  ngOnInit(): void {
    this.lojaId = Number(this.route.snapshot.paramMap.get('id')) || 0;
    if (!this.lojaId) {
      this.router.navigate(['/minhas-lojas']);
      return;
    }

    this.loading = true;
    this.usuarioService.loja(this.lojaId).subscribe({
      next: loja => (this.loja = loja ?? null),
      error: () => (this.loja = null),
    });

    this.produtoService.listar().subscribe({
      next: produtos => (this.produtos = produtos ?? []),
      error: () => (this.produtos = []),
    });

    this.buscar(true);

    this.formSub = this.form.valueChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
      )
      .subscribe(() => {
        this.onProdutoInput();
        if (!this.filtersValid()) return;
        this.buscar(true);
      });
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
  }

  onProdutoInput(): void {
    const nome = (this.form.value.produtoNome ?? '').trim();
    if (!nome) {
      this.selectedProdutoId = undefined;
      return;
    }
    const lower = nome.toLowerCase();
    const exact = this.produtos.find(p => p.nome.toLowerCase() === lower);
    if (exact) {
      this.selectedProdutoId = exact.id;
      return;
    }
    const matches = this.produtos.filter(p => p.nome.toLowerCase().includes(lower));
    this.selectedProdutoId = matches.length === 1 ? matches[0].id : undefined;
  }

  get produtosFiltradosPorTexto(): Produto[] {
    const nome = (this.form.value.produtoNome ?? '').trim().toLowerCase();
    if (!nome) return this.produtos;
    return this.produtos.filter(p => (p.nome ?? '').toLowerCase().includes(nome));
  }

  toggleMenuProduto(): void {
    this.menuProdutoAberto = !this.menuProdutoAberto;
  }

  fecharMenuProdutoComDelay(): void {
    setTimeout(() => (this.menuProdutoAberto = false), 120);
  }

  selecionarProduto(produto: Produto): void {
    this.form.get('produtoNome')?.setValue(produto.nome ?? '');
    this.selectedProdutoId = produto.id;
    this.menuProdutoAberto = false;
  }

  buscar(reset = false): void {
    if (reset) {
      this.movimentos = [];
      this.skip = 0;
      this.hasMore = true;
      this.totalMovimentos = null;
    }
    if (!this.hasMore || this.loadingMore) return;

    const dataInicio = this.normalizeDate(this.form.value.dataInicio || undefined);
    const dataFim = this.normalizeDate(this.form.value.dataFim || undefined);
    const produtoId = this.selectedProdutoId;

    this.loading = this.skip === 0;
    this.loadingMore = this.skip > 0;

    console.debug('[Movimentos] filtros', { produtoId, dataInicio, dataFim, skip: this.skip });

    this.produtoService
      .listarMovimentos(produtoId, this.pageSize, this.skip, dataInicio, dataFim)
      .subscribe({
        next: res => {
          const novos = res.items ?? [];
          this.movimentos = this.skip === 0 ? novos : [...this.movimentos, ...novos];
          this.skip += novos.length;
          if (this.skip === novos.length) {
            this.totalMovimentos = res.total ?? null;
          } else if (res.total != null) {
            this.totalMovimentos = res.total;
          }
          this.hasMore =
            this.totalMovimentos !== null
              ? this.movimentos.length < this.totalMovimentos
              : novos.length === this.pageSize;
          this.loading = false;
          this.loadingMore = false;
        },
        error: err => {
          console.error('[Movimentos] erro ao carregar', err);
          if (this.skip === 0) this.movimentos = [];
          this.loading = false;
          this.loadingMore = false;
        },
      });
  }

  onTableScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    if (nearBottom) this.buscar(false);
  }

  private normalizeDate(value?: string): string | undefined {
    if (!value) return undefined;
    const v = value.trim();
    if (!v) return undefined;

    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return v;
    }

    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (br) {
      const day = br[1];
      const month = br[2];
      const year = br[3];
      return `${year}-${month}-${day}`;
    }

    return undefined;
  }

  private filtersValid(): boolean {
    const inicio = (this.form.value.dataInicio ?? '').trim();
    const fim = (this.form.value.dataFim ?? '').trim();
    if (inicio && !this.normalizeDate(inicio)) return false;
    if (fim && !this.normalizeDate(fim)) return false;
    return true;
  }

  trackById(_: number, item: EstoqueMovimentoDto): number {
    return item.id;
  }

  produtoNome(id: number): string {
    return this.produtos.find(p => p.id === id)?.nome ?? `#${id}`;
  }

  motivoLabel(motivo: EstoqueMovimentoMotivo): string {
    switch (motivo) {
      case EstoqueMovimentoMotivo.Compra: return 'Compra';
      case EstoqueMovimentoMotivo.DevolucaoCliente: return 'Devolucao cliente';
      case EstoqueMovimentoMotivo.TransferenciaRecebida: return 'Transferencia recebida';
      case EstoqueMovimentoMotivo.TransferenciaEnviada: return 'Transferencia enviada';
      case EstoqueMovimentoMotivo.Venda: return 'Venda';
      case EstoqueMovimentoMotivo.Perda: return 'Perda';
      case EstoqueMovimentoMotivo.Avaria: return 'Avaria';
      case EstoqueMovimentoMotivo.Roubo: return 'Roubo';
      case EstoqueMovimentoMotivo.Vencimento: return 'Vencimento';
      case EstoqueMovimentoMotivo.ConsumoInterno: return 'Consumo interno';
      case EstoqueMovimentoMotivo.Ajuste: return 'Ajuste';
      default: return '—';
    }
  }

  fmtDate(raw: string): string {
    if (!raw) return '—';
    const d = new Date(raw);
    return d.toLocaleString('pt-BR');
  }

  referenciaLabel(referenciaTipo?: string | null): string {
    if (!referenciaTipo) return '—';
    switch (referenciaTipo) {
      case 'Sale':
        return 'Venda';
      case 'Transferencia':
        return 'Transferência';
      case 'MovimentacaoManual':
        return 'Movimentação manual';
      case 'AjusteManual':
        return 'Ajuste manual';
      case 'EdicaoProduto':
        return 'Edição de produto';
      default:
        return referenciaTipo;
    }
  }
}
