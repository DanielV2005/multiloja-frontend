// src/app/features/loja/relatorios/vendas-page.component.ts
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { UsuarioService, Loja } from '../../../core/services/usuario.service';
import { PdvService, SaleListItemDto } from '../../../core/services/pdv.service';

@Component({
  standalone: true,
  selector: 'app-vendas-page',
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
  <section class="page">
    <header class="topbar">
      <a class="link" [routerLink]="['/loja', lojaId]">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>Voltar para o painel</span>
      </a>

      <div class="title">
        <h2>Vendas</h2>
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
            <h3>Histórico de vendas</h3>
            <small class="muted">
              {{ loading ? 'Carregando...' : 'Itens: ' + vendas.length }}
            </small>
          </div>

          <form class="filters" [formGroup]="form" (ngSubmit)="buscar(true)">
            <div class="field status-group">
              <label class="check">
                <input type="checkbox" formControlName="statusOpen" />
                <span>Aberta</span>
              </label>
              <label class="check">
                <input type="checkbox" formControlName="statusCompleted" />
                <span>Finalizada</span>
              </label>
              <label class="check">
                <input type="checkbox" formControlName="statusCancelled" />
                <span>Cancelada</span>
              </label>
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
          <span>Carregando vendas...</span>
        </div>

        <p *ngIf="!loading && vendas.length === 0" class="empty">
          Nenhuma venda encontrada.
        </p>

        <div *ngIf="!loading && vendas.length > 0" class="table-wrap" (scroll)="onTableScroll($event)">
          <div class="table">
            <div class="table-header">
              <span class="th col-data">Data</span>
              <span class="th col-atendente">Atendente</span>
              <span class="th col-total">Total</span>
              <span class="th col-numero">Desconto</span>
              <span class="th col-numero">Acréscimo</span>
              <span class="th col-status">Status</span>
              <span class="th col-acoes">Ações</span>
            </div>

            <div class="table-row" *ngFor="let v of vendas; trackBy: trackById">
              <span class="cell col-data">{{ fmtDate(v.createdAt) }}</span>
              <span class="cell col-atendente">{{ atendenteLabel(v.operadorId, v.operadorNome) }}</span>
              <span class="cell col-total">R$ {{ v.total | number:'1.2-2' }}</span>
              <span class="cell col-numero">R$ {{ desconto(v) | number:'1.2-2' }}</span>
              <span class="cell col-numero">R$ {{ acrescimo(v) | number:'1.2-2' }}</span>
              <span class="cell col-status">
                <span class="pill"
                  [class.open]="statusKey(v.status) === 'Open'"
                  [class.done]="statusKey(v.status) === 'Completed'"
                  [class.cancel]="statusKey(v.status) === 'Cancelled'">
                  {{ statusLabel(v.status) }}
                </span>
              </span>
              <span class="cell col-acoes">
                <button type="button" class="btn-link" (click)="abrirDetalhes(v)">
                  Ver detalhes
                </button>
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
    input[type="text"]{
      height:36px;
      border-radius:10px;
      border:1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      padding: 0 8px;
      outline: none;
      min-width: 160px;
    }
    .status-group{
      display:flex;
      align-items:center;
      gap:10px;
      padding:0 6px;
    }
    .check{
      display:flex;
      align-items:center;
      gap:6px;
      font-size:.85rem;
      color:var(--text);
      border:1px solid var(--border);
      border-radius:999px;
      padding:4px 10px;
      background:rgba(15,23,42,.6);
    }
    .check input{
      width:14px;
      height:14px;
    }
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

    .table .col-data{ width:16%; }
    .table .col-atendente{ width:18%; }
    .table .col-total{ width:12%; text-align:right; }
    .table .col-numero{ width:12%; text-align:right; }
    .table .col-status{ width:12%; }
    .table .col-acoes{ width:12%; text-align:right; }

    .pill{
      padding:4px 10px;
      border-radius:999px;
      border:1px solid var(--border);
      font-size:.82rem;
      display:inline-flex;
      align-items:center;
      gap:6px;
    }
    .pill.open{ color:#f59e0b; border-color:rgba(245,158,11,.45); }
    .pill.done{ color:#22c55e; border-color:rgba(34,197,94,.45); }
    .pill.cancel{ color:#ef4444; border-color:rgba(239,68,68,.45); }

    .btn-link{
      background:transparent;
      border:1px solid rgba(212,175,55,.55);
      color:var(--text);
      border-radius:999px;
      height:28px;
      padding:0 10px;
      cursor:pointer;
      font-size:.8rem;
    }
    .btn-link:hover{
      background:rgba(240,210,122,.10);
      box-shadow:0 0 10px rgba(240,210,122,.35);
    }
    .loading-more{
      display:flex;
      align-items:center;
      gap:10px;
      padding:10px 12px;
      border-top:1px solid rgba(148,163,184,.25);
    }
  `],
})
export class VendasPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private usuarioService = inject(UsuarioService);
  private pdv = inject(PdvService);
  private fb = inject(FormBuilder);
  private formSub?: Subscription;

  lojaId = 0;
  loja: Loja | null = null;
  vendas: SaleListItemDto[] = [];
  loading = false;
  loadingMore = false;
  hasMore = true;
  skip = 0;
  readonly pageSize = 100;

  form = this.fb.group({
    statusOpen: [false],
    statusCompleted: [false],
    statusCancelled: [false],
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

    this.buscar(true);

    this.formSub = this.form.valueChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
      )
      .subscribe(() => {
        if (!this.filtersValid()) return;
        this.buscar(true);
      });
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
  }

  buscar(reset = false): void {
    if (reset) {
      this.vendas = [];
      this.skip = 0;
      this.hasMore = true;
    }
    if (!this.hasMore || this.loadingMore) return;

    const dataInicio = this.normalizeDate(this.form.value.dataInicio || undefined);
    const dataFim = this.normalizeDate(this.form.value.dataFim || undefined);
    const statuses = this.selectedStatuses();

    this.loading = this.skip === 0;
    this.loadingMore = this.skip > 0;

    this.pdv
      .list(dataInicio, dataFim, statuses, this.skip, this.pageSize)
      .subscribe({
        next: itens => {
          const novos = itens ?? [];
          this.vendas = this.skip === 0 ? novos : [...this.vendas, ...novos];
          this.skip += novos.length;
          this.hasMore = novos.length === this.pageSize;
          this.loading = false;
          this.loadingMore = false;
        },
        error: err => {
          console.error('[Vendas] erro ao carregar', err);
          if (this.skip === 0) this.vendas = [];
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

  trackById(_: number, item: SaleListItemDto): number {
    return item.id;
  }

  desconto(v: SaleListItemDto): number {
    return v.discountPercent >= 0 ? v.discountValue : 0;
  }

  acrescimo(v: SaleListItemDto): number {
    return v.discountPercent < 0 ? v.discountValue : 0;
  }

  atendenteLabel(operadorId?: number | null, nome?: string | null): string {
    if (nome) return nome;
    if (!operadorId) return '-';
    return `Operador #${operadorId}`;
  }

  statusLabel(status: string): string {
    switch (this.statusKey(status)) {
      case 'Open': return 'Aberta';
      case 'Completed': return 'Finalizada';
      case 'Cancelled': return 'Cancelada';
      default: return status || '-';
    }
  }

  statusKey(value: string | number): string {
    if (value === 1 || value === '1') return 'Open';
    if (value === 2 || value === '2') return 'Completed';
    if (value === 3 || value === '3') return 'Cancelled';
    return String(value);
  }

  fmtDate(raw: string): string {
    if (!raw) return '—';
    const d = new Date(raw);
    return d.toLocaleString('pt-BR');
  }

  abrirDetalhes(venda: SaleListItemDto): void {
    // Esqueleto: detalhes em breve
    console.debug('[Vendas] detalhes', venda.id);
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

  private selectedStatuses(): string[] | undefined {
    const open = this.form.value.statusOpen;
    const done = this.form.value.statusCompleted;
    const cancel = this.form.value.statusCancelled;
    const list: string[] = [];
    if (open) list.push('Open');
    if (done) list.push('Completed');
    if (cancel) list.push('Cancelled');
    if (list.length === 0 || list.length === 3) return undefined;
    return list;
  }
}
