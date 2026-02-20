// src/app/features/loja/painel-loja.component.ts
import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import * as echarts from 'echarts';

import { UsuarioService, Loja } from '../../core/services/usuario.service';
import { PdvService, SaleItemSummaryDto, SaleListItemDto } from '../../core/services/pdv.service';
import { Produto, ProdutoService } from '../../core/services/produto.service';
import { Setor, SetorService } from '../../core/services/setor.service';
import { FuncionarioFormDialogComponent } from './funcionarios/funcionario-form.dialog';
import { SetoresDialogComponent } from './setores/setores-dialog';
import { VendaDetalhesDialogComponent } from './relatorios/vendas-page.component';

@Component({
  standalone: true,
  selector: 'app-painel-loja',
  imports: [CommonModule, RouterLink, MatDialogModule],
  template: `
    <section class="page">
      <header class="topbar">
        <a class="link" [routerLink]="['/minhas-lojas']">
          <span class="material-symbols-outlined">arrow_back</span>
          <span>Minhas Lojas</span>
        </a>

        <div class="title">
          <h2>{{ loja?.nome || 'Loja' }}</h2>
          <small class="muted" *ngIf="loja?.endereco">
            {{ loja?.endereco }}
          </small>
        </div>

        <span class="spacer"></span>
      </header>

      <!-- HOTBAR -->
      <nav class="hotbar">
        <button class="tab active" type="button">
          <span class="material-symbols-outlined">dashboard</span>
          <span>Painel</span>
        </button>

        <!-- MENU INVENTÁRIO -->
        <div class="menu-inv" (click)="$event.stopPropagation()">
          <button
            type="button"
            class="tab"
            (click)="toggleMenuInventario($event)"
            [class.disabled]="!loja"
          >
            <span class="material-symbols-outlined">inventory_2</span>
            <span>Inventário</span>
            <span class="material-symbols-outlined caret">
              {{ menuInventarioAberto ? 'expand_less' : 'expand_more' }}
            </span>
          </button>

          <div class="inv-menu" *ngIf="menuInventarioAberto">
            <button class="action-btn" type="button" (click)="irParaEstoqueViaMenu()">
              <span class="material-symbols-outlined">inventory_2</span>
              <span>Estoque</span>
            </button>

            <button class="action-btn" type="button" (click)="irParaServicos()">
              <span class="material-symbols-outlined">build</span>
              <span>Serviços</span>
            </button>
          </div>
        </div>

        <!-- SETORES -->
        <button class="tab" type="button" (click)="abrirGerenciarSetores()">
          <span class="material-symbols-outlined">category</span>
          <span>Setores</span>
        </button>

        <!-- MENU FUNCIONÁRIOS -->
        <div class="menu-func" (click)="$event.stopPropagation()">
          <button class="tab" type="button" (click)="toggleMenuFuncionarios($event)" [class.disabled]="!loja">
            <span class="material-symbols-outlined">group</span>
            <span>Funcionários</span>
            <span class="material-symbols-outlined caret">
              {{ menuFuncionariosAberto ? 'expand_less' : 'expand_more' }}
            </span>
          </button>

          <div class="func-menu" *ngIf="menuFuncionariosAberto">
            <button class="action-btn" type="button" (click)="irParaFuncionarios()">
              <span class="material-symbols-outlined">list</span>
              <span>Lista</span>
            </button>

            <button class="action-btn" type="button" (click)="abrirCadastroFuncionario()">
              <span class="material-symbols-outlined">person_add</span>
              <span>Cadastrar</span>
            </button>
          </div>
        </div>

        <!-- MENU RELATÓRIOS -->
        <div class="menu-rel" (click)="$event.stopPropagation()">
          <button class="tab" type="button" (click)="toggleMenuRelatorios($event)" [class.disabled]="!loja">
            <span class="material-symbols-outlined">receipt_long</span>
            <span>Relatórios</span>
            <span class="material-symbols-outlined caret">
              {{ menuRelatoriosAberto ? 'expand_less' : 'expand_more' }}
            </span>
          </button>

          <div class="rel-menu" *ngIf="menuRelatoriosAberto">
            <button class="action-btn" type="button" (click)="irParaRelatorioVendas()">
              <span class="material-symbols-outlined">receipt</span>
              <span>Vendas</span>
            </button>
          </div>
        </div>

        <!-- PDV -->
        <button class="tab" type="button" (click)="irParaPdv()" [class.disabled]="!loja">
          <span class="material-symbols-outlined">point_of_sale</span>
          <span>PDV</span>
        </button>
      </nav>

      <!-- CONTEÚDO -->
      <main class="content">
        <div class="card chart">
          <header class="card__header">
            <h3>Painel geral</h3>
            <small class="muted"> {{ loja?.nome || 'Loja selecionada' }} — visão rápida</small>
          </header>

          <div class="overview">
            <div class="kpis">
              <div class="kpi">
                <span class="kpi__label">Faturamento</span>
                <strong class="kpi__value">{{ visibleRevenueLabel }}</strong>
                <small class="muted">Periodo: {{ salesRangeLabel }}</small>
              </div>
              <div class="kpi">
                <span class="kpi__label">Lucro lÃ­quido</span>
                <strong class="kpi__value">Manutenção</strong>
                <small class="muted">Fluxo de caixa</small>
              </div>
              <div class="kpi">
                <span class="kpi__label">Patrimônio (custo)</span>
                <strong class="kpi__value">{{ visibleInventoryCostLabel }}</strong>
                <small class="muted">Capital investido</small>
              </div>
              <div class="kpi">
                <span class="kpi__label">Patrimônio (venda)</span>
                <strong class="kpi__value">{{ visibleInventorySaleLabel }}</strong>
                <small class="muted">Valor potencial</small>
              </div>
              <div class="kpi">
                <span class="kpi__label">Margem média</span>
                <strong class="kpi__value">Manutenção</strong>
                <small class="muted">Liquida (em breve)</small>
              </div>
              <div class="kpi">
                <span class="kpi__label">Ticket médio</span>
                <strong class="kpi__value">{{ visibleTicketLabel }}</strong>
                <small class="muted">Vendas finalizadas</small>
              </div>
              <div class="kpi">
                <span class="kpi__label">Vendas (qtde)</span>
                <strong class="kpi__value">{{ visibleSalesCount }}</strong>
                <small class="muted">Periodo visivel</small>
              </div>
            </div>

            <div class="overview-panels">
              <div class="panel">
                <div class="panel__header">
                  <h4>Resumo por setor</h4>
                  <span class="muted">Top 5</span>
                </div>
                <div class="panel__body">
                  <div class="sector-row" *ngFor="let setor of topSetores">
                    <span>{{ setor.nome }}</span>
                    <span class="muted">{{ formatMoney(setor.valor) }}</span>
                    <span class="badge">{{ setor.percentual.toFixed(0) }}%</span>
                  </div>
                  <div class="muted" *ngIf="!topSetores.length">Sem dados de setores ainda.</div>
                </div>
              </div>

              <div class="panel">
                <div class="panel__header">
                  <h4>Alertas</h4>
                  <span class="muted">Ativos</span>
                </div>
                <div class="panel__body">
                  <div class="alert-row">
                    <span class="dot warn"></span>
                    <span>Produtos com estoque baixo</span>
                  </div>
                  <div class="alert-row">
                    <span class="dot warn"></span>
                    <span>Produtos parados (30+ dias)</span>
                  </div>
                  <div class="alert-row">
                    <span class="dot neutral"></span>
                    <span>Margens abaixo do esperado</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card chart sales-card">
            <header class="card__header">
              <div>
                <h3>Vendas gerais</h3>
                <small class="muted">Faturamento no periodo visivel: {{ visibleRevenueLabel }}</small>
              </div>
              <div class="card__actions">
                <button class="btn-secondary" type="button" (click)="refreshSalesChart()" [disabled]="salesLoading">
                  Atualizar
                </button>
                <button class="btn-secondary" type="button" (click)="irParaRelatorioVendas()">
                  Ver lista
                </button>
              </div>
            </header>

          <div class="sales-chart" role="img" aria-label="Grafico de vendas">
            <div class="sales-chart__header">
              <div class="sales-chart__title">
                <span class="muted">Vendas finalizadas</span>
                <span class="muted">Periodo: {{ salesRangeLabel }}</span>
              </div>
              <div class="range">
                <button class="range-btn" type="button" [class.active]="salesView === 'day'" (click)="setSalesView('day')">
                  Dias
                </button>
                <button class="range-btn" type="button" [class.active]="salesView === 'week'" (click)="setSalesView('week')">
                  Semanas
                </button>
                <button class="range-btn" type="button" [class.active]="salesView === 'month'" (click)="setSalesView('month')">
                  Meses
                </button>
                <button class="range-btn" type="button" [class.active]="salesView === 'year'" (click)="setSalesView('year')">
                  Anos
                </button>
              </div>
              <div class="range">
                <button class="range-btn" type="button" [class.active]="salesMetric === 'profit'" (click)="setSalesMetric('profit')">
                  Lucro
                </button>
                <button class="range-btn" type="button" [class.active]="salesMetric === 'count'" (click)="setSalesMetric('count')">
                  Quantidade
                </button>
              </div>
              <div class="range">
                <button class="range-btn" type="button" [class.active]="salesRangeDays === 7" (click)="setSalesRange(7)">
                  1 semana
                </button>
                <button class="range-btn" type="button" [class.active]="salesRangeDays === 30" (click)="setSalesRange(30)">
                  1 mes
                </button>
                <button class="range-btn" type="button" [class.active]="salesRangeDays === 90" (click)="setSalesRange(90)">
                  3 meses
                </button>
                <button class="range-btn" type="button" [class.active]="salesRangeDays === 365" (click)="setSalesRange(365)">
                  1 ano
                </button>
              </div>
              <span class="muted" *ngIf="salesLoading">Carregando...</span>
              <span class="muted error" *ngIf="salesError">{{ salesError }}</span>
            </div>

            <div class="line-chart">
              <div class="echart" #salesChart></div>
            </div>
          </div>
        </div>
      </main>
    </section>
  `,
  styles: [
    `
      .material-symbols-outlined {
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      }

      .page {
        min-height: 100dvh;
        padding: 20px 18px;
        background: var(--bg);
        color: var(--text);
      }

      .topbar {
        display: flex;
        align-items: center;
        gap: 16px;
        margin: 4px 0 14px;
      }

      .link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: 1px solid #d4af37;
        color: var(--text);
        border-radius: 999px;
        height: 36px;
        padding: 0 12px;
        cursor: pointer;
        text-decoration: none;
      }
      .link:hover {
        background: rgba(240, 210, 122, 0.1);
        box-shadow: 0 0 14px rgba(240, 210, 122, 0.45);
      }

      .title h2 {
        margin: 0;
        font-size: 1.4rem;
      }
      .title .muted {
        font-size: 0.85rem;
      }
      .spacer {
        flex: 1;
      }

      .hotbar {
        display: flex;
        gap: 10px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .tab {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 999px;
        border: 1px solid #d4af37;
        background: #050814;
        color: var(--text);
        cursor: pointer;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
        transition: background 0.15s, box-shadow 0.2s, transform 0.05s, color 0.15s;
        font-size: 0.9rem;
      }

      .tab .material-symbols-outlined {
        font-size: 18px;
      }

      .tab:hover {
        background: rgba(250, 215, 100, 0.14);
        box-shadow: 0 0 0 1px rgba(250, 215, 100, 0.4), 0 0 18px rgba(250, 215, 100, 0.28);
        transform: translateY(-1px);
      }

      .tab.active {
        background: radial-gradient(120% 120% at 50% -20%, rgba(255, 255, 255, 0.2), transparent 55%),
          linear-gradient(180deg, #f5df7b 0%, #e3bd43 55%, #be8e1a 100%);
        color: #141414;
        box-shadow: 0 10px 24px rgba(218, 171, 31, 0.45);
        border-color: #9e7b14;
      }

      .tab.disabled {
        opacity: 0.5;
        cursor: default;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
        transform: none;
        pointer-events: none;
      }

      .caret {
        font-size: 18px;
        margin-left: 2px;
      }

      .menu-func,
      .menu-inv,
      .menu-rel {
        position: relative;
      }

      .func-menu,
      .inv-menu,
      .rel-menu {
        position: absolute;
        top: 110%;
        left: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        background: #050814;
        border-radius: 14px;
        border: 1px solid #d4af37;
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.8);
        z-index: 50;
        min-width: 210px;
      }

      .action-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 10px;
        border: 1px solid #d4af37;
        background: transparent;
        color: var(--text);
        cursor: pointer;
        font-size: 0.86rem;
        transition: background 0.15s, box-shadow 0.2s, transform 0.05s;
        text-align: left;
      }
      .action-btn .material-symbols-outlined {
        font-size: 18px;
      }

      .action-btn:hover {
        background: rgba(250, 215, 100, 0.14);
        box-shadow: 0 0 0 1px rgba(250, 215, 100, 0.4), 0 0 18px rgba(250, 215, 100, 0.2);
        transform: translateY(-1px);
      }

      .content {
        display: grid;
        gap: 18px;
      }

      .card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        padding: 16px 16px 18px;
      }
      .card__header {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin-bottom: 12px;
      }

      .card__actions {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .chart {
        min-height: 420px;
      }

      .sales-card {
        min-height: 360px;
      }

      .overview {
        display: grid;
        gap: 16px;
      }

      .kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
      }

      .kpi {
        background: rgba(6, 10, 24, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 14px;
        padding: 12px 14px;
        display: grid;
        gap: 6px;
        min-height: 90px;
      }

      .kpi__label {
        font-size: 0.8rem;
        color: var(--muted);
      }

      .kpi__value {
        font-size: 1.1rem;
        color: var(--text);
        font-weight: 600;
      }

      .overview-panels {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 14px;
      }

      .panel {
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 14px;
        padding: 12px 14px;
        background: rgba(5, 8, 20, 0.6);
        display: grid;
        gap: 10px;
      }

      .panel__header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }

      .panel__header h4 {
        margin: 0;
        font-size: 0.95rem;
      }

      .panel__body {
        display: grid;
        gap: 8px;
        min-height: 120px;
      }

      .sector-row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 10px;
        align-items: center;
        font-size: 0.85rem;
      }

      .badge {
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(240, 210, 122, 0.4);
        color: #f5df7b;
        font-size: 0.72rem;
      }

      .alert-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }

      .dot.warn {
        background: #f5df7b;
        box-shadow: 0 0 8px rgba(245, 223, 123, 0.45);
      }

      .dot.neutral {
        background: #94a3b8;
        box-shadow: 0 0 6px rgba(148, 163, 184, 0.35);
      }

      .chart-placeholder {
        position: relative;
        height: 360px;
        border: 1px dashed var(--border);
        border-radius: 14px;
        display: grid;
        place-items: center;
        overflow: hidden;
        background: radial-gradient(900px 500px at 100% 0, rgba(99, 102, 241, 0.05), transparent 55%),
          radial-gradient(900px 500px at 0 100%, rgba(37, 99, 235, 0.05), transparent 55%);
      }

      .chart-placeholder .spark {
        position: absolute;
        inset: -20% -10% auto -10%;
        height: 120px;
        filter: blur(18px);
        opacity: 0.25;
        background: linear-gradient(115deg, transparent 0%, #fff 15%, transparent 30%);
        animation: slide 2.8s ease-in-out infinite;
      }
      @keyframes slide {
        0% {
          transform: translateX(-60%);
        }
        100% {
          transform: translateX(160%);
        }
      }

      .chart-placeholder .grid {
        position: absolute;
        inset: 20px;
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 10px;
        opacity: 0.5;
      }
      .chart-placeholder .grid > div {
        background: rgba(127, 127, 127, 0.08);
        border-radius: 10px;
        height: 48%;
      }

      .chart-placeholder .legend {
        position: absolute;
        bottom: 12px;
        left: 16px;
      }

      .sales-chart {
        height: clamp(220px, 36vh, 360px);
        border: 1px dashed var(--border);
        border-radius: 14px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: radial-gradient(900px 500px at 100% 0, rgba(99, 102, 241, 0.05), transparent 55%),
          radial-gradient(900px 500px at 0 100%, rgba(37, 99, 235, 0.05), transparent 55%);
      }

      .sales-chart__header {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
        justify-content: space-between;
      }

      .sales-chart__title {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .range {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .range-btn {
        height: 28px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(15, 23, 42, 0.8);
        color: var(--muted);
        font-size: 0.78rem;
        cursor: pointer;
      }

      .range-btn.active {
        background: rgba(240, 210, 122, 0.18);
        color: var(--text);
        border-color: rgba(240, 210, 122, 0.7);
        box-shadow: 0 0 10px rgba(240, 210, 122, 0.25);
      }

      .line-chart {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
      }

      .echart {
        width: 100%;
        height: 100%;
        min-height: 200px;
      }

      .crosshair__h {
        position: absolute;
        left: 0;
        right: 0;
        height: 1px;
        background: rgba(240, 210, 122, 0.35);
      }

      .empty {
        display: grid;
        place-items: center;
        flex: 1;
      }

      .error {
        color: #fca5a5;
      }

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

      .muted {
        color: var(--muted);
      }
    `,
  ],
})
export class PainelLojaComponent implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(UsuarioService);
  private pdv = inject(PdvService);
  private produtos = inject(ProdutoService);
  private setores = inject(SetorService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  @ViewChild('salesChart') salesChartEl?: ElementRef<HTMLDivElement>;

  loja: Loja | null = null;
  salesProfitSeries: Array<{ label: string; value: number }> = [];
  salesCountSeries: Array<{ label: string; value: number }> = [];
  salesView: 'day' | 'week' | 'month' | 'year' = 'day';
  salesRangeDays = 90;
  salesRangeLabel = '3 meses';
  salesMetric: 'profit' | 'count' = 'profit';
  maxRangeDays = 1095;
  visibleRevenueLabel = 'R$ 0,00';
  visibleTicketLabel = 'R$ 0,00';
  visibleSalesCount = 0;
  visibleInventoryCostLabel = 'R$ 0,00';
  visibleInventorySaleLabel = 'R$ 0,00';
  topSetores: Array<{ nome: string; valor: number; percentual: number }> = [];
  private chart: echarts.ECharts | null = null;
  private zoomRange: { startIndex: number; endIndex: number } | null = null;
  private produtosMap = new Map<number, Produto>();
  private setoresMap = new Map<number, Setor>();
  private dailyStart: Date | null = null;
  private dailyTotals: number[] = [];
  private dailyCounts: number[] = [];
  private salesBucketStarts: Date[] = [];
  private salesBucketEnds: Date[] = [];
  private topSetoresTimer: number | null = null;
  private lastTopSetoresKey = '';
  salesLoading = false;
  salesError = '';

  menuFuncionariosAberto = false;
  menuInventarioAberto = false;
  menuRelatoriosAberto = false;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id)) return;

    this.api.loja(id).subscribe({
      next: (l) => {
        this.loja = l;
        this.loadInventorySnapshot();
      },
      error: () => (this.loja = null),
    });

    this.loadSalesChart();
  }

  ngAfterViewInit(): void {
    this.initChart();
  }

  ngOnDestroy(): void {
    this.chart?.dispose();
    this.chart = null;
    window.removeEventListener('resize', this.handleResize);
  }

  @HostListener('document:click')
  fecharMenus(): void {
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;
    this.menuRelatoriosAberto = false;
  }

  @HostListener('window:keydown', ['$event'])
  onAtalhoDetalhes(event: KeyboardEvent): void {
    if (event.altKey && (event.key === 'v' || event.key === 'V')) {
      if (this.isTextInput(event.target)) return;
      event.preventDefault();
      this.abrirUltimaVenda();
    }
  }

  toggleMenuFuncionarios(ev?: MouseEvent): void {
    ev?.stopPropagation();
    if (!this.loja) return;
    this.menuInventarioAberto = false;
    this.menuRelatoriosAberto = false;
    this.menuFuncionariosAberto = !this.menuFuncionariosAberto;
  }

  toggleMenuInventario(ev?: MouseEvent): void {
    ev?.stopPropagation();
    if (!this.loja) return;
    this.menuFuncionariosAberto = false;
    this.menuRelatoriosAberto = false;
    this.menuInventarioAberto = !this.menuInventarioAberto;
  }

  toggleMenuRelatorios(ev?: MouseEvent): void {
    ev?.stopPropagation();
    if (!this.loja) return;
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;
    this.menuRelatoriosAberto = !this.menuRelatoriosAberto;
  }

  irParaFuncionarios(): void {
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;
    if (!this.loja?.id) return;
    this.router.navigate(['/loja', this.loja.id, 'funcionarios']);
  }

  abrirCadastroFuncionario(): void {
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;

    this.dialog.open(FuncionarioFormDialogComponent, {
      autoFocus: false,
      panelClass: 'ml-dialog',
    });
  }

  abrirGerenciarSetores(): void {
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;

    this.dialog.open(SetoresDialogComponent, {
      autoFocus: false,
      panelClass: 'ml-dialog',
    });
  }

  irParaEstoqueViaMenu(): void {
    this.menuInventarioAberto = false;
    if (!this.loja?.id) return;
    this.router.navigate(['/loja', this.loja.id, 'estoque']);
  }

  irParaServicos(): void {
    this.menuInventarioAberto = false;
    if (!this.loja?.id) return;
    this.router.navigate(['/loja', this.loja.id, 'servicos']);
  }

  irParaPdv(): void {
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;
    this.menuRelatoriosAberto = false;

    if (!this.loja?.id) return;
    this.router.navigate(['/loja', this.loja.id, 'pdv']);
  }

  irParaRelatorioVendas(): void {
    this.menuRelatoriosAberto = false;
    if (!this.loja?.id) return;
    this.router.navigate(['/loja', this.loja.id, 'relatorios', 'vendas']);
  }

  private loadSalesChart(): void {
    this.salesLoading = true;
    this.salesError = '';

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (this.maxRangeDays - 1));

    const dataInicio = this.formatIsoDate(start);
    const dataFim = this.formatIsoDate(today);

    this.pdv.list(dataInicio, dataFim, [2], 0, 2000).subscribe({
      next: (items) => this.buildSalesSeries(items, start, this.maxRangeDays),
      error: () => {
        this.salesError = 'Falha ao carregar vendas.';
        this.salesProfitSeries = [];
        this.salesCountSeries = [];
        this.renderChart();
      },
      complete: () => (this.salesLoading = false),
    });
  }

  private buildSalesSeries(items: SaleListItemDto[], start: Date, days: number): void {
    const totals: number[] = Array.from({ length: days }, () => 0);
    const counts: number[] = Array.from({ length: days }, () => 0);

    items.forEach((s) => {
      const d = new Date(s.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const idx = Math.floor((this.startOfDay(d).getTime() - this.startOfDay(start).getTime()) / 86400000);
      if (idx < 0 || idx >= days) return;
      totals[idx] += Number(s.total || 0);
      counts[idx] += 1;
    });

    this.dailyStart = this.startOfDay(start);
    this.dailyTotals = totals;
    this.dailyCounts = counts;
    this.rebuildViewSeries();

    this.salesLoading = false;
    this.renderChart();
  }

  private initChart(): void {
    if (!this.salesChartEl?.nativeElement || this.chart) return;
    this.chart = echarts.init(this.salesChartEl.nativeElement, undefined, { renderer: 'canvas' });
    this.renderChart();
    window.addEventListener('resize', this.handleResize);
    this.chart.on('datazoom', (evt: any) => {
      this.captureZoomRange(evt);
      this.updateVisibleProfit();
    });
  }

  private handleResize = (): void => {
    this.chart?.resize();
  };

  private renderChart(): void {
    if (!this.chart) return;
    const activeSeries = this.salesMetric === 'count' ? this.salesCountSeries : this.salesProfitSeries;
    if (!activeSeries.length) {
      this.chart.clear();
      return;
    }

    const labels = activeSeries.map((s) => s.label);
    const values = activeSeries.map((s) => s.value);
    const endIndex = labels.length - 1;
    const rangeBuckets = this.getRangeBuckets();
    const startIndex = Math.max(0, endIndex - (rangeBuckets - 1));

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { left: 64, right: 24, top: 16, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(8, 12, 24, 0.95)',
        borderColor: 'rgba(240, 210, 122, 0.6)',
        textStyle: { color: '#e5e7eb' },
        valueFormatter: (value) => {
          const first = Array.isArray(value) ? value[0] : value;
          const numeric = typeof first === 'number' ? first : Number(first ?? 0);
          return this.salesMetric === 'count' ? `${numeric}` : this.formatMoney(numeric);
        },
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params];
          const p = list[0];
          const idx = typeof p?.dataIndex === 'number' ? p.dataIndex : 0;
          const countValue = this.salesCountSeries[idx]?.value ?? 0;
          const seriesValue = Array.isArray(p?.value) ? p.value[0] : p?.value;
          const numeric = typeof seriesValue === 'number' ? seriesValue : Number(seriesValue ?? 0);
          const valueLabel = this.salesMetric === 'count' ? `${numeric}` : this.formatMoney(numeric);
          const countLabel = `Qtd: ${countValue}`;
          const dateLabel = String((p as any)?.axisValue ?? '');
          return `${dateLabel}<br/>${valueLabel}<br/>${countLabel}`;
        },
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLabel: { color: '#94a3b8' },
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.2)' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#94a3b8',
          formatter: (value: number) =>
            this.salesMetric === 'count' ? `${Number(value)}` : this.formatMoney(Number(value)),
        },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.2)' } },
      },
      dataZoom: [
        {
          type: 'inside',
          startValue: labels[startIndex],
          endValue: labels[endIndex],
          zoomOnMouseWheel: true,
          moveOnMouseWheel: true,
          moveOnMouseMove: true,
        },
      ],
      series: [
        {
          type: 'line',
          data: values,
          showSymbol: true,
          symbolSize: 6,
          lineStyle: { color: '#f5df7b', width: 2 },
          itemStyle: { color: '#f5df7b' },
          areaStyle: { color: 'rgba(240, 210, 122, 0.25)' },
        },
      ],
    };

    this.chart.setOption(option, true);
    this.zoomRange = { startIndex, endIndex };
    this.updateVisibleProfit();
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private formatIsoDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private formatShortDate(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  private formatMonthLabel(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${yyyy}`;
  }

  private formatYearLabel(d: Date): string {
    return `${d.getFullYear()}`;
  }

  private rangeLabel(days: number): string {
    if (days === 7) return '1 semana';
    if (days === 30) return '1 mes';
    if (days === 90) return '3 meses';
    if (days === 365) return '1 ano';
    if (days > 365) return `${Math.round(days / 365)} anos`;
    return `${Math.round(days / 30)} meses`;
  }

  formatMoney(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  setSalesRange(days: number): void {
    this.salesRangeDays = days;
    this.salesRangeLabel = this.rangeLabel(days);
    if (this.dailyStart) {
      this.renderChart();
    } else {
      this.loadSalesChart();
    }
  }

  setSalesMetric(metric: 'profit' | 'count'): void {
    this.salesMetric = metric;
    this.renderChart();
  }

  refreshSalesChart(): void {
    this.loadSalesChart();
  }

  private async loadInventorySnapshot(): Promise<void> {
    if (!this.loja?.id) return;

    try {
      const [produtos, setores] = await Promise.all([
        firstValueFrom(this.produtos.listarPorLoja(this.loja.id)),
        firstValueFrom(this.setores.listar()),
      ]);

      this.produtosMap.clear();
      produtos.forEach((p) => {
        if (typeof p.id === 'number') {
          this.produtosMap.set(p.id, p);
        }
      });

      this.setoresMap.clear();
      setores.forEach((s) => this.setoresMap.set(s.id, s));

      let totalCost = 0;
      let totalSale = 0;

      produtos.forEach((p: Produto) => {
        const qtdRaw = (p as any).quantidade ?? (p as any).estoque ?? 0;
        const qtd = Number(qtdRaw ?? 0);
        if (qtd <= 0) return;
        const custo = Number(p.precoCusto ?? 0);
        const venda = Number(p.precoVenda ?? 0);

        totalCost += qtd * custo;
        totalSale += qtd * venda;
      });

      this.visibleInventoryCostLabel = this.formatMoney(totalCost);
      this.visibleInventorySaleLabel = this.formatMoney(totalSale);
      this.scheduleTopSetoresUpdate();
    } catch {
      this.visibleInventoryCostLabel = this.formatMoney(0);
      this.visibleInventorySaleLabel = this.formatMoney(0);
      this.topSetores = [];
    }
  }

  setSalesView(view: 'day' | 'week' | 'month' | 'year'): void {
    this.salesView = view;
    const defaultRange =
      view === 'day' ? 30 :
      view === 'year' ? 365 :
      90;
    this.salesRangeDays = defaultRange;
    this.salesRangeLabel = this.rangeLabel(this.salesRangeDays);
    this.rebuildViewSeries();
    this.renderChart();
  }

  private updateVisibleProfit(): void {
    if (!this.salesProfitSeries.length || !this.salesCountSeries.length || !this.chart) {
      this.visibleRevenueLabel = this.formatMoney(0);
      this.visibleTicketLabel = this.formatMoney(0);
      this.visibleSalesCount = 0;
      return;
    }

    const values = this.salesProfitSeries.map((s) => s.value);
    const counts = this.salesCountSeries.map((s) => s.value);
    const range = this.zoomRange ?? { startIndex: 0, endIndex: values.length - 1 };
    const startIndex = Math.max(0, Math.min(range.startIndex - 1, values.length - 1));
    const endIndex = Math.max(startIndex, Math.min(range.endIndex + 1, values.length - 1));

    let sum = 0;
    let countSum = 0;
    for (let i = startIndex; i <= endIndex; i += 1) {
      sum += Number(values[i] ?? 0);
      countSum += Number(counts[i] ?? 0);
    }

    this.visibleRevenueLabel = this.formatMoney(sum);
    this.visibleSalesCount = countSum;
    const ticket = countSum > 0 ? sum / countSum : 0;
    this.visibleTicketLabel = this.formatMoney(ticket);
    this.scheduleTopSetoresUpdate();
  }


  private captureZoomRange(evt: any): void {
    if (!this.salesProfitSeries.length) return;
    const labels = this.salesProfitSeries.map((s) => s.label);
    const total = labels.length - 1;
    const batch = Array.isArray(evt?.batch) ? evt.batch[0] : evt;
    if (!batch) return;

    let startIndex = 0;
    let endIndex = total;

    if (batch.startValue != null && batch.endValue != null) {
      const startLabel = String(batch.startValue);
      const endLabel = String(batch.endValue);
      const sIdx = labels.indexOf(startLabel);
      const eIdx = labels.indexOf(endLabel);
      if (sIdx >= 0) startIndex = sIdx;
      if (eIdx >= 0) endIndex = eIdx;
    } else if (batch.start != null && batch.end != null) {
      startIndex = Math.max(0, Math.floor((batch.start / 100) * total));
      endIndex = Math.max(startIndex, Math.floor((batch.end / 100) * total));
    }

    this.zoomRange = { startIndex, endIndex };
  }

  private getRangeBuckets(): number {
    const days = this.salesRangeDays;
    if (this.salesView === 'day') return days;
    if (this.salesView === 'week') {
      if (days <= 7) return 1;
      if (days <= 30) return 4;
      if (days <= 90) return 13;
      return 52;
    }
    if (this.salesView === 'month') {
      if (days <= 7) return 1;
      if (days <= 30) return 1;
      if (days <= 90) return 3;
      return 12;
    }
    if (days <= 7) return 1;
    if (days <= 30) return 2;
    if (days <= 90) return 3;
    return 5;
  }

  private rebuildViewSeries(): void {
    if (!this.dailyStart || !this.dailyTotals.length) {
      this.salesProfitSeries = [];
      this.salesCountSeries = [];
      this.salesBucketStarts = [];
      this.salesBucketEnds = [];
      return;
    }

    const buckets = new Map<string, { start: Date; profit: number; count: number }>();
    for (let i = 0; i < this.dailyTotals.length; i += 1) {
      const day = new Date(this.dailyStart);
      day.setDate(day.getDate() + i);
      const profit = Number(this.dailyTotals[i] ?? 0);
      const count = Number(this.dailyCounts[i] ?? 0);

      let key = '';
      let bucketStart = day;
      if (this.salesView === 'day') {
        key = this.formatShortDate(day);
      } else if (this.salesView === 'week') {
        bucketStart = this.startOfWeek(day);
        key = this.formatShortDate(bucketStart);
      } else if (this.salesView === 'month') {
        bucketStart = new Date(day.getFullYear(), day.getMonth(), 1);
        key = this.formatMonthLabel(bucketStart);
      } else {
        bucketStart = new Date(day.getFullYear(), 0, 1);
        key = this.formatYearLabel(bucketStart);
      }

      const current = buckets.get(key);
      if (current) {
        current.profit += profit;
        current.count += count;
      } else {
        buckets.set(key, { start: bucketStart, profit, count });
      }
    }

    const ordered = Array.from(buckets.entries())
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    this.salesProfitSeries = ordered.map((item) => ({ label: item.label, value: item.profit }));
    this.salesCountSeries = ordered.map((item) => ({ label: item.label, value: item.count }));
    this.salesBucketStarts = ordered.map((item) => this.startOfDay(item.start));
    this.salesBucketEnds = ordered.map((item) => this.getBucketEnd(item.start));
  }

  private getBucketEnd(start: Date): Date {
    if (this.salesView === 'day') return this.startOfDay(start);
    if (this.salesView === 'week') {
      const end = this.startOfDay(start);
      end.setDate(end.getDate() + 6);
      return end;
    }
    if (this.salesView === 'month') {
      return new Date(start.getFullYear(), start.getMonth() + 1, 0);
    }
    return new Date(start.getFullYear(), 11, 31);
  }

  private getVisibleRangeDates(): { start: Date; end: Date } | null {
    if (!this.salesBucketStarts.length) return null;
    const range = this.zoomRange ?? { startIndex: 0, endIndex: this.salesBucketStarts.length - 1 };
    const startIndex = Math.max(0, Math.min(range.startIndex, this.salesBucketStarts.length - 1));
    const endIndex = Math.max(startIndex, Math.min(range.endIndex, this.salesBucketStarts.length - 1));
    const start = this.salesBucketStarts[startIndex];
    const end = this.salesBucketEnds[endIndex] ?? this.salesBucketStarts[endIndex];
    return { start, end };
  }

  private scheduleTopSetoresUpdate(): void {
    if (this.topSetoresTimer) {
      window.clearTimeout(this.topSetoresTimer);
    }
    this.topSetoresTimer = window.setTimeout(() => {
      this.topSetoresTimer = null;
      this.loadTopSetoresBySales();
    }, 150);
  }

  private loadTopSetoresBySales(): void {
    if (!this.loja?.id) return;
    if (!this.produtosMap.size || !this.setoresMap.size) return;
    const range = this.getVisibleRangeDates();
    if (!range) return;

    const dataInicio = this.formatIsoDate(range.start);
    const dataFim = this.formatIsoDate(range.end);
    const key = `${this.salesView}:${this.salesRangeDays}:${dataInicio}:${dataFim}`;
    if (key === this.lastTopSetoresKey) return;
    this.lastTopSetoresKey = key;

    this.pdv.listItemSummary(dataInicio, dataFim, [2]).subscribe({
      next: (items) => this.applyTopSetores(items),
      error: () => {
        this.topSetores = [];
      },
    });
  }

  private applyTopSetores(items: SaleItemSummaryDto[]): void {
    const totals = new Map<number, number>();
    let totalSum = 0;

    items.forEach((item) => {
      if (!this.isProdutoItem(item)) return;
      const produto = this.produtosMap.get(item.produtoId);
      if (!produto) return;
      const setorId = produto.setorFilhoId;
      if (!Number.isFinite(setorId)) return;
      const valor = Number(item.total ?? 0);
      if (!valor) return;
      totals.set(setorId, (totals.get(setorId) ?? 0) + valor);
      totalSum += valor;
    });

    this.topSetores = Array.from(totals.entries())
      .map(([id, valor]) => ({
        nome: this.setoresMap.get(id)?.nome ?? `Setor ${id}`,
        valor,
        percentual: totalSum > 0 ? (valor / totalSum) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }

  private isProdutoItem(item: SaleItemSummaryDto): boolean {
    const tipo = String(item.tipo ?? '').trim().toLowerCase();
    return tipo === 'produto' || tipo === 'product';
  }

  private abrirUltimaVenda(): void {
    if (!this.loja?.id) return;
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

  private startOfWeek(d: Date): Date {
    const date = this.startOfDay(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }
}

