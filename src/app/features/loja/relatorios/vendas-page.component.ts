// src/app/features/loja/relatorios/vendas-page.component.ts
import { Component, Inject, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { UsuarioService, Loja } from '../../../core/services/usuario.service';
import { PdvService, SaleDetailsDto, SaleItemDto, SaleListItemDto, SaleReturnDto } from '../../../core/services/pdv.service';

@Component({
  standalone: true,
  selector: 'app-vendas-page',
  imports: [CommonModule, RouterLink, ReactiveFormsModule, MatDialogModule],
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
              <label class="check">
                <input type="checkbox" formControlName="statusReturned" />
                <span>Devolvida</span>
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
                  [class.cancel]="statusKey(v.status) === 'Cancelled'"
                  [class.returned]="statusKey(v.status) === 'Returned'">
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
    .pill.returned{ color:#38bdf8; border-color:rgba(56,189,248,.45); }

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
  private dialog = inject(MatDialog);
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
    statusReturned: [false],
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
      case 'Returned': return 'Devolvida';
      default: return status || '-';
    }
  }

  statusKey(value: string | number): string {
    if (value === 1 || value === '1') return 'Open';
    if (value === 2 || value === '2') return 'Completed';
    if (value === 3 || value === '3') return 'Cancelled';
    if (value === 4 || value === '4') return 'Returned';
    return String(value);
  }

  fmtDate(raw: string): string {
    if (!raw) return '-';
    const d = new Date(raw);
    return d.toLocaleString('pt-BR');
  }

  abrirDetalhes(venda: SaleListItemDto): void {
    const saleIds = this.vendas.map(v => v.id);
    const index = saleIds.indexOf(venda.id);
    this.dialog.open(VendaDetalhesDialogComponent, {
      autoFocus: false,
      maxWidth: '95vw',
      panelClass: 'ml-dialog',
      data: { saleId: venda.id, saleIds, index },
    })
    .afterClosed()
    .subscribe((updated?: SaleDetailsDto) => {
      if (!updated) return;
      this.vendas = this.vendas.map(v =>
        v.id === updated.id
          ? { ...v, status: updated.status, total: updated.total, discountPercent: updated.discountPercent, discountValue: updated.discountValue }
          : v
      );
    });
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
    const returned = this.form.value.statusReturned;
    const list: string[] = [];
    if (open) list.push('Open');
    if (done) list.push('Completed');
    if (cancel) list.push('Cancelled');
    if (returned) list.push('Returned');
    if (list.length === 0 || list.length === 4) return undefined;
    return list;
  }
}

interface VendaDetalhesDialogData {
  saleId: number;
  saleIds: number[];
  index: number;
}

interface ReturnLineItem {
  saleItemId: number;
  quantity: number;
  returnedQuantity: number;
}

interface ReturnLine {
  key: string;
  nome: string;
  unitPrice: number;
  quantity: number;
  returnedQuantity: number;
  returnQty: number;
  items: ReturnLineItem[];
}

@Component({
  standalone: true,
  selector: 'app-venda-detalhes-dialog',
  imports: [CommonModule, FormsModule, MatDialogModule],
  template: `
    <section class="dialog-card">
      <header class="dialog-header">
        <div class="title">
          <h3>Detalhes da venda</h3>
          <p class="muted" *ngIf="details">
            {{ fmtDate(details.createdAt) }} · {{ atendenteLabel(details.operadorId, details.operadorNome) }}
          </p>
        </div>

        <div class="nav">
          <button class="icon-btn" type="button" (click)="navigate(-1)" [disabled]="!hasPrev()">
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <button class="icon-btn" type="button" (click)="navigate(1)" [disabled]="!hasNext()">
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </header>

        <div class="summary" *ngIf="details">
          <div>
            <div class="label">Status</div>
            <div class="value">{{ statusLabel(details.status) }}</div>
          </div>
        <div>
          <div class="label">Total</div>
          <div class="value">R$ {{ details.total | number:'1.2-2' }}</div>
        </div>
        <div>
          <div class="label">Desconto</div>
          <div class="value">R$ {{ desconto(details) | number:'1.2-2' }}</div>
        </div>
        <div>
          <div class="label">Acréscimo</div>
          <div class="value">R$ {{ acrescimo(details) | number:'1.2-2' }}</div>
        </div>
      </div>

      <div *ngIf="loading" class="loading">
        <div class="spinner"></div>
        <span>Carregando venda...</span>
      </div>

      <div *ngIf="!loading && details" class="content">
        <div class="section">
          <h4>Itens vendidos</h4>
          <div class="table">
            <div class="table-header">
              <span>Produto</span>
              <span>Qtd</span>
              <span>Devolvida</span>
              <span>Disponível</span>
              <span>Valor</span>
              <span>Devolver</span>
            </div>
            <div class="table-row" *ngFor="let item of returnLines; trackBy: trackLine">
              <span>{{ item.nome }}</span>
              <span>{{ item.quantity }}</span>
              <span>{{ item.returnedQuantity }}</span>
              <span>{{ remaining(item) }}</span>
              <span>R$ {{ item.unitPrice | number:'1.2-2' }}</span>
              <span>
                <input
                  type="number"
                  class="qty-input"
                  [min]="0"
                  [max]="remaining(item)"
                  [step]="0.01"
                  [(ngModel)]="item.returnQty"
                  (ngModelChange)="clampReturnQty(item)"
                />
              </span>
            </div>
          </div>
        </div>

        <div class="section">
          <h4>Motivo da devolução (opcional)</h4>
          <div class="reason-actions">
            <label class="chip-opt">
              <input type="radio" name="returnType" [(ngModel)]="returnType" value="Devolução" />
              <span>Devolução</span>
            </label>
            <label class="chip-opt">
              <input type="radio" name="returnType" [(ngModel)]="returnType" value="Defeito" />
              <span>Defeito</span>
            </label>
          </div>
          <textarea class="reason" [(ngModel)]="returnReason" rows="2" placeholder="Ex.: cliente devolveu item"></textarea>
        </div>

        <div class="section" *ngIf="details.returns?.length">
          <h4>Devoluções registradas</h4>
          <div class="returns">
            <div class="return-card" *ngFor="let ret of details.returns; trackBy: trackReturn">
              <div class="return-head">
                <strong>{{ fmtDate(ret.createdAt) }}</strong>
                <span class="muted">Itens: {{ ret.items?.length || 0 }}</span>
              </div>
              <div class="muted" *ngIf="ret.reason">{{ ret.reason }}</div>
              <ul>
                <li *ngFor="let i of ret.items">{{ itemName(i.saleItemId) }} · {{ i.quantity }} x R$ {{ i.unitPrice | number:'1.2-2' }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <footer class="dialog-footer">
        <div class="totals" *ngIf="details">
          <span>Valor da devolução:</span>
          <strong>R$ {{ returnTotal | number:'1.2-2' }}</strong>
        </div>
        <button class="btn btn-outline" type="button" (click)="close()">Fechar</button>
        <button class="btn btn-gold" type="button" (click)="confirmReturn()" [disabled]="!canReturn() || saving">
          {{ saving ? 'Salvando...' : 'Confirmar devolução' }}
        </button>
      </footer>
    </section>
  `,
  styles: [`
    .dialog-card{
      min-width:min(900px, 96vw);
      background:var(--surface);
      color:var(--text);
      border:1px solid rgba(240,210,122,.7);
      border-radius:16px;
      box-shadow:0 0 0 1px rgba(0,0,0,.7), 0 0 38px rgba(240,210,122,.35);
      padding:16px;
      display:flex;
      flex-direction:column;
      gap:12px;
    }
    .dialog-header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
    }
    .title h3{ margin:0; font-size:1.1rem; }
    .title p{ margin:4px 0 0; }
    .nav{ display:flex; gap:8px; }
    .icon-btn{
      width:34px; height:34px; padding:0; border-radius:999px;
      border:1px solid rgba(240,210,122,.6); background:transparent;
      color:var(--muted); display:grid; place-items:center; cursor:pointer;
    }
    .icon-btn:disabled{ opacity:.45; cursor:default; }
    .summary{
      display:grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap:12px;
      padding:8px 0;
      border-top:1px solid rgba(148,163,184,.15);
      border-bottom:1px solid rgba(148,163,184,.15);
    }
    .summary .label{ font-size:.75rem; color:var(--muted); }
    .summary .value{ font-weight:600; }
    .loading{ display:flex; align-items:center; gap:10px; padding:10px 4px; }
    .spinner{
      width:18px; height:18px; border-radius:50%;
      border:2px solid rgba(255,255,255,.45); border-top-color:#fff;
      animation:spin .8s linear infinite;
    }
    @keyframes spin{ to{ transform:rotate(360deg); } }
    .content{ display:flex; flex-direction:column; gap:14px; }
    .section h4{ margin:0 0 8px; font-size:.95rem; }
    .table{
      border:1px solid var(--border);
      border-radius:12px;
      overflow:hidden;
      background:#050814;
      display:grid;
    }
    .table-header, .table-row{
      display:grid;
      grid-template-columns: 2.2fr .7fr .8fr .9fr .8fr .8fr;
      gap:10px;
      padding:8px 12px;
      align-items:center;
    }
    .table-header{
      background:rgba(15,21,40,.96);
      font-size:.75rem;
      text-transform:uppercase;
      letter-spacing:.04em;
      color:var(--muted);
    }
    .table-row{
      border-top:1px solid rgba(148,163,184,.2);
      font-size:.9rem;
    }
    .qty-input{
      width:90px;
      height:30px;
      border-radius:8px;
      border:1px solid var(--border);
      background:var(--bg);
      color:var(--text);
      padding:0 8px;
    }
    .reason-actions{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      margin-bottom:8px;
    }
    .chip-opt{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:6px 10px;
      border-radius:999px;
      border:1px solid var(--border);
      background:rgba(15,23,42,.6);
      font-size:.85rem;
      cursor:pointer;
    }
    .chip-opt input{ width:14px; height:14px; }
    .reason{
      width:100%;
      border-radius:10px;
      border:1px solid var(--border);
      background:var(--bg);
      color:var(--text);
      padding:8px 10px;
      resize:vertical;
    }
    .returns{
      display:grid;
      gap:10px;
    }
    .return-card{
      border:1px solid rgba(148,163,184,.25);
      border-radius:12px;
      padding:10px 12px;
      background:rgba(7,11,25,.7);
    }
    .return-head{
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:6px;
    }
    .return-card ul{
      margin:6px 0 0;
      padding-left:16px;
      color:var(--muted);
    }
    .dialog-footer{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      margin-top:6px;
    }
    .totals{ display:flex; align-items:center; gap:8px; }
    .btn{
      height:38px; padding:0 16px; border-radius:999px; border:1px solid transparent;
      cursor:pointer; font-weight:600;
    }
    .btn-outline{
      background:transparent; border-color:var(--border); color:var(--muted);
    }
    .btn-outline:hover{ background:rgba(127,127,127,.12); color:var(--text); }
    .btn-gold{
      border-color:#9e7b14; color:#151515;
      background:
        radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.20), transparent 60%),
        linear-gradient(180deg, #F5DF7B 0%, var(--primary) 55%, var(--primary-600) 100%);
      box-shadow:0 8px 20px rgba(218,171,31,.40), inset 0 -2px 0 rgba(0,0,0,.18);
    }
    @media (max-width: 900px){
      .summary{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .table-header, .table-row{ grid-template-columns: 2fr .7fr .7fr .8fr .8fr .8fr; }
    }
    @media (max-width: 720px){
      .table-header, .table-row{ grid-template-columns: 2fr .8fr .8fr 1fr; }
      .table-header span:nth-child(3),
      .table-header span:nth-child(4),
      .table-header span:nth-child(5),
      .table-row span:nth-child(3),
      .table-row span:nth-child(4),
      .table-row span:nth-child(5){ display:none; }
    }
  `],
})
export class VendaDetalhesDialogComponent {
  private pdv = inject(PdvService);
  private ref = inject(MatDialogRef<VendaDetalhesDialogComponent, SaleDetailsDto | undefined>);

  details?: SaleDetailsDto;
  loading = true;
  saving = false;
  returnLines: ReturnLine[] = [];
  returnReason = '';
  returnType: 'Devolução' | 'Defeito' = 'Devolução';

  private saleIds: number[];
  private index: number;

  constructor(@Inject(MAT_DIALOG_DATA) public data: VendaDetalhesDialogData) {
    this.saleIds = data.saleIds ?? [data.saleId];
    this.index = Math.max(0, data.index ?? 0);
    this.load(this.saleIds[this.index] ?? data.saleId);
  }

  hasPrev(): boolean {
    return this.index > 0;
  }

  hasNext(): boolean {
    return this.index < this.saleIds.length - 1;
  }

  navigate(dir: -1 | 1): void {
    const next = this.index + dir;
    if (next < 0 || next >= this.saleIds.length) return;
    this.index = next;
    this.load(this.saleIds[this.index]);
  }

  private load(saleId: number): void {
    this.loading = true;
    this.returnLines = [];
    this.returnReason = '';
    this.returnType = 'Devolução';
    this.pdv.getDetails(saleId).subscribe({
      next: (details) => {
        this.details = details;
        this.returnLines = this.groupLines(details.items ?? []);
        this.loading = false;
      },
      error: (err) => {
        console.error('[VendaDetalhes] erro ao carregar', err);
        this.loading = false;
      },
    });
  }

  private groupLines(items: SaleItemDto[]): ReturnLine[] {
    const map = new Map<string, ReturnLine>();
    for (const item of items) {
      const key = `${item.produtoId}|${item.tipo}|${item.unitPrice}`;
      const existing = map.get(key);
      const lineItem: ReturnLineItem = {
        saleItemId: item.id,
        quantity: item.quantity,
        returnedQuantity: item.returnedQuantity ?? 0,
      };
      if (!existing) {
        map.set(key, {
          key,
          nome: item.nome,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          returnedQuantity: item.returnedQuantity ?? 0,
          returnQty: 0,
          items: [lineItem],
        });
        continue;
      }
      existing.quantity += item.quantity;
      existing.returnedQuantity += item.returnedQuantity ?? 0;
      existing.items.push(lineItem);
    }
    return Array.from(map.values());
  }

  remaining(line: ReturnLine): number {
    return Math.max(0, (line.quantity ?? 0) - (line.returnedQuantity ?? 0));
  }

  clampReturnQty(line: ReturnLine): void {
    const max = this.remaining(line);
    if (line.returnQty < 0) line.returnQty = 0;
    if (line.returnQty > max) line.returnQty = max;
  }

  canReturn(): boolean {
    return this.returnLines.some(l => l.returnQty > 0);
  }

  get returnTotal(): number {
    return this.returnLines.reduce((sum, l) => sum + (l.returnQty * l.unitPrice), 0);
  }

  confirmReturn(): void {
    if (!this.details || !this.canReturn()) return;
    const items: Array<{ saleItemId: number; quantity: number }> = [];
    for (const line of this.returnLines) {
      let remainingToReturn = line.returnQty;
      if (remainingToReturn <= 0) continue;
      for (const item of line.items) {
        const available = Math.max(0, item.quantity - item.returnedQuantity);
        if (available <= 0) continue;
        const qty = Math.min(available, remainingToReturn);
        if (qty > 0) {
          items.push({ saleItemId: item.saleItemId, quantity: qty });
          remainingToReturn -= qty;
        }
        if (remainingToReturn <= 0) break;
      }
    }

    this.saving = true;
    const reason = [this.returnType, this.returnReason?.trim()].filter(Boolean).join(': ');
    this.pdv.returnSale(this.details.id, {
      saleId: this.details.id,
      reason: reason || undefined,
      items,
    })
    .subscribe({
      next: (updated) => {
        this.details = updated;
        this.returnLines = this.groupLines(updated.items ?? []);
        this.returnReason = '';
        this.returnType = 'Devolução';
        this.saving = false;
        this.ref.close(updated);
      },
      error: (err) => {
        console.error('[VendaDetalhes] erro ao salvar devolução', err);
        this.saving = false;
      },
    });
  }

  itemName(saleItemId: number): string {
    const item = this.details?.items?.find(i => i.id === saleItemId);
    return item?.nome ?? `Item ${saleItemId}`;
  }

  trackLine(_: number, item: ReturnLine): string {
    return item.key;
  }

  trackReturn(_: number, ret: SaleReturnDto): number {
    return ret.id;
  }

  close(): void {
    this.ref.close();
  }

  desconto(details: SaleDetailsDto): number {
    return details.discountPercent >= 0 ? details.discountValue : 0;
  }

  acrescimo(details: SaleDetailsDto): number {
    return details.discountPercent < 0 ? details.discountValue : 0;
  }

  atendenteLabel(operadorId?: number | null, nome?: string | null): string {
    if (nome) return nome;
    if (!operadorId) return '-';
    return `Operador #${operadorId}`;
  }

  statusLabel(status: string | number): string {
    const key = String(status);
    if (status === 'Returned' || key === '4') return 'Devolvida';
    if (status === 'Open' || key === '1') return 'Aberta';
    if (status === 'Completed' || key === '2') return 'Finalizada';
    if (status === 'Cancelled' || key === '3') return 'Cancelada';
    return key || '-';
  }

  fmtDate(raw: string): string {
    if (!raw) return '—';
    const d = new Date(raw);
    return d.toLocaleString('pt-BR');
  }
}
