// src/app/features/loja/painel-loja.component.ts
import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom, forkJoin, from, of, Subject } from 'rxjs';
import { catchError, mergeMap, takeUntil, toArray, timeout } from 'rxjs/operators';
import * as echarts from 'echarts';

import { UsuarioService, Loja } from '../../core/services/usuario.service';
import { PdvService, SaleDetailsDto, SaleItemSummaryDto, SaleListItemDto } from '../../core/services/pdv.service';
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
            [class.disabled]="!lojaId"
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
          <button class="tab" type="button" (click)="toggleMenuFuncionarios($event)" [class.disabled]="!lojaId">
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
          <button class="tab" type="button" (click)="toggleMenuRelatorios($event)" [class.disabled]="!lojaId">
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
        <button class="tab" type="button" (click)="irParaPdv()" [class.disabled]="!lojaId">
          <span class="material-symbols-outlined">point_of_sale</span>
          <span>PDV</span>
        </button>
      </nav>

      <!-- CONTEÚDO -->
      <main class="content">
        <div class="card chart">
          <header class="card__header">
            <h3>Painel geral</h3>
            <small class="muted quickview">
              {{ loja?.nome || 'Loja selecionada' }} — visão rápida
            </small>
          </header>

          <div class="overview censor-block">
            <div class="kpis">
              <div class="kpi">
                <span class="kpi__label">Total das Vendas</span>
                <strong class="kpi__value">{{ visibleTotalLabel }}</strong>
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
              <div class="kpi kpi--toggle" (click)="toggleProfitMode()">
                <span class="kpi__label">
                  {{ profitKpiMode === 'inventory' ? 'Lucro patrimonial' : 'Lucro no período' }}
                </span>
                <strong class="kpi__value">
                  {{ profitKpiMode === 'inventory' ? inventoryProfitLabel : visibleProfitLabel }}
                </strong>
                <small class="muted">
                  {{
                    profitKpiMode === 'inventory'
                      ? 'Potencial - investimento (clique para ver período)'
                      : 'Período visível (clique para ver inventário)'
                  }}
                </small>
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
              <div class="censor-block">
                <h3>Vendas gerais</h3>
                <small class="muted metrics-inline">
                  <strong>Faturamento</strong> no período visível: {{ visibleRevenueLabel }}
                  <span class="sep">|</span>
                  <strong>Serviços</strong> no período visível: {{ visibleServiceRevenueLabel }}
                  <span class="sep">|</span>
                  <strong>Total</strong> no período visível: {{ visibleTotalLabel }}
                  <span class="sep">|</span>
                  <strong>Lucro</strong> no período visível: {{ visibleProfitLabel }}
                </small>
              </div>
              <div class="card__actions">
                <button
                  class="btn-secondary icon-btn"
                  type="button"
                  (click)="toggleSectorChart()"
                  [attr.aria-pressed]="showSectorChart"
                  title="Alternar grÃ¡fico"
                >
                  <span class="material-symbols-outlined">bar_chart</span>
                </button>
                <button
                  class="btn-secondary icon-btn"
                  type="button"
                  (click)="toggleSectorChartMode()"
                  [disabled]="!showSectorChart"
                  [attr.aria-pressed]="sectorChartMode === 'line'"
                  title="Alternar modelo"
                >
                  <span class="material-symbols-outlined">
                    {{ sectorChartMode === 'line' ? 'show_chart' : 'pie_chart' }}
                  </span>
                </button>
                <button class="btn-secondary" type="button" (click)="refreshSalesChart()" [disabled]="salesLoading">
                  Atualizar
                </button>
                <button class="btn-secondary" type="button" (click)="irParaRelatorioVendas()">
                  Ver lista
                </button>
              </div>
            </header>

          <div class="sales-chart censor-block" role="img" aria-label="Grafico de vendas">
            <div class="sales-chart__header">
              <div class="sales-chart__title">
                <span class="muted">Vendas finalizadas</span>
                <span class="muted">Periodo: {{ salesRangeLabel }}</span>
                <div class="period-controls" *ngIf="!showSectorChart">
                  <label class="period-qty">
                    <span class="muted">Qtd.</span>
                    <input
                      type="number"
                      min="1"
                      [value]="rangeQty"
                      (input)="onRangeQtyInput($event)"
                    />
                  </label>
                  <button class="range-btn" type="button" (click)="toggleRangePicker()">
                    Intervalo
                  </button>
                </div>
              </div>
              <div class="range" *ngIf="!showSectorChart">
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
              <div class="range" *ngIf="!showSectorChart">
                <button class="range-btn" type="button" [class.active]="salesMetric === 'profit'" (click)="setSalesMetric('profit')">
                  Total
                </button>
                <button class="range-btn" type="button" [class.active]="salesMetric === 'count'" (click)="setSalesMetric('count')">
                  Quantidade
                </button>
              </div>
              <span class="muted" *ngIf="salesLoading">Carregando...</span>
              <span class="muted error" *ngIf="salesError">{{ salesError }}</span>
            </div>

            <div class="range-picker" *ngIf="rangePickerOpen && !showSectorChart">
              <label>
                <span class="muted">De</span>
                <input
                  type="date"
                  [value]="rangeStart"
                  (input)="rangeStart = $any($event.target).value"
                />
              </label>
              <label>
                <span class="muted">AtÃ©</span>
                <input
                  type="date"
                  [value]="rangeEnd"
                  (input)="rangeEnd = $any($event.target).value"
                />
              </label>
              <button class="range-btn" type="button" (click)="applyRangePicker()">Aplicar</button>
              <button class="range-btn" type="button" (click)="toggleRangePicker()">Fechar</button>
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
      .kpi--toggle {
        cursor: pointer;
        transition: transform 0.12s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .kpi--toggle:hover {
        transform: translateY(-2px);
        border-color: rgba(240, 210, 122, 0.55);
        box-shadow: 0 0 0 1px rgba(240, 210, 122, 0.22);
      }
      .quickview {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .icon-btn {
        width: 36px;
        height: 36px;
        padding: 0;
        display: inline-grid;
        place-items: center;
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

      .period-controls {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin-left: 14px;
      }

      .period-qty {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .period-qty input {
        width: 72px;
        height: 30px;
        border-radius: 10px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(8, 12, 24, 0.7);
        color: var(--text);
        padding: 0 8px;
      }

      .range-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 10px;
        align-items: center;
        margin: 8px 0 4px;
      }

      .range-picker label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .range-picker input {
        height: 30px;
        border-radius: 10px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(8, 12, 24, 0.7);
        color: var(--text);
        padding: 0 8px;
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

      .metrics-inline strong {
        color: var(--text);
        font-weight: 600;
      }

      .metrics-inline .sep {
        margin: 0 6px;
        opacity: 0.6;
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
  lojaId = 0;
  salesProfitSeries: Array<{ label: string; value: number }> = [];
  salesRevenueSeries: Array<{ label: string; value: number }> = [];
  salesTotalSeries: Array<{ label: string; value: number }> = [];
  salesServiceSeries: Array<{ label: string; value: number }> = [];
  salesCountSeries: Array<{ label: string; value: number }> = [];
  sectorChartData: Array<{ id: number; name: string; value: number }> = [];
  sectorLineSeries: Array<{ id: number; name: string; data: number[] }> = [];
  private sectorLineLoading = false;
  private lastSectorLineKey = '';
  salesView: 'day' | 'week' | 'month' | 'year' = 'day';
  salesRangeDays = 90;
  salesRangeLabel = '3 meses';
  rangeQty = 90;
  rangePickerOpen = false;
  rangeStart = '';
  rangeEnd = '';
  salesMetric: 'profit' | 'count' = 'profit';
  maxRangeDays = 1095;
  visibleRevenueLabel = 'R$ 0,00';
  visibleProfitLabel = 'R$ 0,00';
  visibleServiceRevenueLabel = 'R$ 0,00';
  visibleTotalLabel = 'R$ 0,00';
  visibleTicketLabel = 'R$ 0,00';
  visibleSalesCount = 0;
  visibleInventoryCostLabel = 'R$ 0,00';
  visibleInventorySaleLabel = 'R$ 0,00';
  inventoryProfitLabel = 'R$ 0,00';
  profitKpiMode: 'inventory' | 'period' = 'inventory';
  topSetores: Array<{ nome: string; valor: number; percentual: number }> = [];
  private ngZone = inject(NgZone);
  private destroy$ = new Subject<void>();
  private salesCancel$ = new Subject<void>();
  private salesDetailsCache = new Map<number, SaleDetailsDto>();
  private renderScheduled = false;
  private chart: echarts.ECharts | null = null;
  private wheelHandler: ((ev: WheelEvent) => void) | null = null;
  showSectorChart = false;
  sectorChartMode: 'pie' | 'line' = 'pie';
  private zoomRange: { startIndex: number; endIndex: number } | null = null;
  private manualRange: { start: Date; end: Date } | null = null;
  private isRenderingChart = false;
  private produtosMap = new Map<number, Produto>();
  private setoresMap = new Map<number, Setor>();
  private dailyStart: Date | null = null;
  private dailyRevenueTotals: number[] = [];
  private dailyProfitTotals: number[] = [];
  private dailyServiceTotals: number[] = [];
  private dailyTotalTotals: number[] = [];
  private dailyCounts: number[] = [];
  private salesBucketStarts: Date[] = [];
  private salesBucketEnds: Date[] = [];
  private topSetoresTimer: number | null = null;
  private lastTopSetoresKey = '';
  private topSetoresLoading = false;
  private topSetoresPending = false;
  private salesLoadToken = 0;
  private salesLoadTimer: number | null = null;
  private inventoryLoaded = false;
  salesLoading = false;
  salesError = '';

  menuFuncionariosAberto = false;
  menuInventarioAberto = false;
  menuRelatoriosAberto = false;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id)) return;
    this.lojaId = id;
    this.salesDetailsCache.clear();
    this.syncRangeQtyFromDays();

    this.api.loja(id).pipe(timeout(8000), takeUntil(this.destroy$)).subscribe({
      next: (l) => {
        this.loja = l;
        void this.loadInventorySnapshot().finally(() => {
          this.loadSalesChart();
        });
      },
      error: () => (this.loja = null),
    });
  }

  ngAfterViewInit(): void {
    this.initChart();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.salesCancel$.next();
    this.salesCancel$.complete();
    this.chart?.dispose();
    this.chart = null;
    if (this.wheelHandler && this.salesChartEl?.nativeElement) {
      this.salesChartEl.nativeElement.removeEventListener('wheel', this.wheelHandler);
    }
    this.wheelHandler = null;
    window.removeEventListener('resize', this.handleResize);
    if (this.topSetoresTimer) {
      window.clearTimeout(this.topSetoresTimer);
      this.topSetoresTimer = null;
    }
    if (this.salesLoadTimer) {
      window.clearTimeout(this.salesLoadTimer);
      this.salesLoadTimer = null;
    }
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

  toggleProfitMode(): void {
    this.profitKpiMode = this.profitKpiMode === 'inventory' ? 'period' : 'inventory';
  }

  toggleSectorChart(): void {
    this.showSectorChart = !this.showSectorChart;
    if (this.showSectorChart && !this.sectorChartData.length) {
      this.loadTopSetoresBySales();
    }
    if (this.showSectorChart && this.sectorChartMode === 'line') {
      this.loadSectorLineChart();
    }
    this.renderChart();
  }

  toggleSectorChartMode(): void {
    this.sectorChartMode = this.sectorChartMode === 'pie' ? 'line' : 'pie';
    if (this.showSectorChart && this.sectorChartMode === 'line') {
      this.loadSectorLineChart();
    }
    this.renderChart();
  }

  toggleMenuFuncionarios(ev?: MouseEvent): void {
    ev?.stopPropagation();
    if (!this.lojaId) return;
    this.menuInventarioAberto = false;
    this.menuRelatoriosAberto = false;
    this.menuFuncionariosAberto = !this.menuFuncionariosAberto;
  }

  toggleMenuInventario(ev?: MouseEvent): void {
    ev?.stopPropagation();
    if (!this.lojaId) return;
    this.menuFuncionariosAberto = false;
    this.menuRelatoriosAberto = false;
    this.menuInventarioAberto = !this.menuInventarioAberto;
  }

  toggleMenuRelatorios(ev?: MouseEvent): void {
    ev?.stopPropagation();
    if (!this.lojaId) return;
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;
    this.menuRelatoriosAberto = !this.menuRelatoriosAberto;
  }

  irParaFuncionarios(): void {
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;
    if (!this.lojaId) return;
    this.router.navigate(['/loja', this.lojaId, 'funcionarios']);
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
    if (!this.lojaId) return;
    this.router.navigate(['/loja', this.lojaId, 'estoque']);
  }

  irParaServicos(): void {
    this.menuInventarioAberto = false;
    if (!this.lojaId) return;
    this.router.navigate(['/loja', this.lojaId, 'servicos']);
  }

  irParaPdv(): void {
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;
    this.menuRelatoriosAberto = false;

    if (!this.lojaId) return;
    this.router.navigate(['/loja', this.lojaId, 'pdv']);
  }

  irParaRelatorioVendas(): void {
    this.menuRelatoriosAberto = false;
    if (!this.lojaId) return;
    this.router.navigate(['/loja', this.lojaId, 'relatorios', 'vendas']);
  }

  private loadSalesChart(): void {
    if (this.salesLoading) return;
    this.salesLoading = true;
    this.salesError = '';
    this.salesLoadToken += 1;
    const token = this.salesLoadToken;
    this.salesCancel$.next();
    if (this.salesLoadTimer) {
      window.clearTimeout(this.salesLoadTimer);
    }
    this.salesLoadTimer = window.setTimeout(() => {
      if (this.salesLoading && token === this.salesLoadToken) {
        this.salesError = 'Falha ao carregar vendas.';
        this.salesLoading = false;
        this.scheduleRender();
      }
    }, 12000);

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (this.maxRangeDays - 1));

    const dataInicio = this.formatIsoDate(start);
    const dataFim = this.formatIsoDate(today);

    this.pdv.list(dataInicio, dataFim, [2], 0, 2000)
      .pipe(timeout(8000), takeUntil(this.salesCancel$), takeUntil(this.destroy$))
      .subscribe({
      next: (items) => this.loadSaleProfitsAndBuild(items, start, this.maxRangeDays),
      error: () => {
        this.salesError = 'Falha ao carregar vendas.';
        this.salesProfitSeries = [];
        this.salesRevenueSeries = [];
        this.salesTotalSeries = [];
        this.salesServiceSeries = [];
        this.salesCountSeries = [];
        this.salesLoading = false;
        this.scheduleRender();
      },
    });
  }

  private loadSaleProfitsAndBuild(items: SaleListItemDto[], start: Date, days: number): void {
    const token = this.salesLoadToken;
    if (!items.length) {
      this.buildSalesSeries(items, start, days, new Map(), new Map(), new Map());
      return;
    }

    if (!this.produtosMap.size && !this.inventoryLoaded) {
      this.loadInventorySnapshot().finally(() => {
        this.loadSaleProfitsAndBuild(items, start, days);
      });
      return;
    }

    const maxDetails = 200;
    const itemsToFetch = items.slice(0, maxDetails);
    if (items.length > maxDetails) {
      this.salesError = 'Muitos registros: lucro/serviços calculados parcialmente.';
    }

    const cachedDetails: SaleDetailsDto[] = [];
    const missingItems: SaleListItemDto[] = [];
    itemsToFetch.forEach((sale) => {
      const cached = this.salesDetailsCache.get(sale.id);
      if (cached) {
        cachedDetails.push(cached);
      } else {
        missingItems.push(sale);
      }
    });

    if (!missingItems.length) {
      this.buildSalesSeries(
        items,
        start,
        days,
        this.buildProfitMap(cachedDetails),
        this.buildProductMap(cachedDetails),
        this.buildServiceMap(cachedDetails)
      );
      return;
    }

    from(missingItems)
      .pipe(
        mergeMap(
          (sale) => this.pdv.getDetails(sale.id).pipe(timeout(8000), catchError(() => of(null))),
          2
        ),
        toArray(),
        takeUntil(this.salesCancel$),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (details) => {
          if (token !== this.salesLoadToken) return;
          details.forEach((detail) => {
            if (detail) {
              this.salesDetailsCache.set(detail.id, detail);
              cachedDetails.push(detail);
            }
          });
          this.buildSalesSeries(
            items,
            start,
            days,
            this.buildProfitMap(cachedDetails),
            this.buildProductMap(cachedDetails),
            this.buildServiceMap(cachedDetails)
          );
        },
        error: () => this.buildSalesSeries(items, start, days, new Map(), new Map(), new Map()),
      });
  }

  private buildSalesSeries(
    items: SaleListItemDto[],
    start: Date,
    days: number,
    profitById: Map<number, number>,
    productById: Map<number, number>,
    serviceById: Map<number, number>
  ): void {
    const revenueTotals: number[] = Array.from({ length: days }, () => 0);
    const profitTotals: number[] = Array.from({ length: days }, () => 0);
    const serviceTotals: number[] = Array.from({ length: days }, () => 0);
    const totalTotals: number[] = Array.from({ length: days }, () => 0);
    const counts: number[] = Array.from({ length: days }, () => 0);

    items.forEach((s) => {
      const d = new Date(s.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const idx = Math.floor((this.startOfDay(d).getTime() - this.startOfDay(start).getTime()) / 86400000);
      if (idx < 0 || idx >= days) return;
      const fallbackRevenue = Number(s.total || 0);
      const productRevenue = productById.get(s.id) ?? fallbackRevenue;
      const serviceRevenue = serviceById.get(s.id) ?? 0;
      const totalRevenue = productRevenue + serviceRevenue;
      const profit = profitById.get(s.id) ?? productRevenue;
      revenueTotals[idx] += productRevenue;
      profitTotals[idx] += profit;
      serviceTotals[idx] += serviceRevenue;
      totalTotals[idx] += totalRevenue;
      counts[idx] += 1;
    });

    this.dailyStart = this.startOfDay(start);
    this.dailyRevenueTotals = revenueTotals;
    this.dailyProfitTotals = profitTotals;
    this.dailyServiceTotals = serviceTotals;
    this.dailyTotalTotals = totalTotals;
    this.dailyCounts = counts;
    this.rebuildViewSeries();

    this.salesLoading = false;
    this.scheduleRender();
  }

  private initChart(): void {
    const el = this.salesChartEl?.nativeElement;
    if (!el || this.chart) return;
    this.ngZone.runOutsideAngular(() => {
      this.chart = echarts.init(el, undefined, { renderer: 'canvas' });
      this.renderChart();
      this.chart.on('datazoom', (evt: any) => {
        if (this.isRenderingChart) return;
        this.captureZoomRange(evt);
        this.ngZone.run(() => this.updateVisibleProfit());
      });
      if (!this.wheelHandler) {
        this.wheelHandler = (ev: WheelEvent) => {
          if (!this.chart) return;
          ev.preventDefault();
          const { start, end } = this.getZoomPercent();
          const step = 2;
          const delta = Math.sign(ev.deltaY);
          let nextStart = start;
          let nextEnd = end;
          if (delta > 0) {
            nextStart = start - step;
            nextEnd = end + step;
          } else if (delta < 0) {
            nextStart = start + step;
            nextEnd = end - step;
          }
          this.setZoomPercent(nextStart, nextEnd);
        };
      }
      el.addEventListener('wheel', this.wheelHandler, { passive: false });
    });
    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    this.chart?.resize();
  };

  private getZoomPercent(): { start: number; end: number } {
    const option = (this.chart?.getOption() as any) ?? {};
    const zooms = Array.isArray(option.dataZoom) ? option.dataZoom : [];
    const match = zooms.find((z: any) => z.xAxisIndex === 0);
    const start = Number(match?.start ?? 0);
    const end = Number(match?.end ?? 100);
    return { start, end };
  }

  private setZoomPercent(start: number, end: number): void {
    if (!this.chart) return;
    let s = Math.max(0, Math.min(100, start));
    let e = Math.max(0, Math.min(100, end));
    if (e - s < 2) {
      const mid = (s + e) / 2;
      s = Math.max(0, mid - 1);
      e = Math.min(100, mid + 1);
    }
    this.chart.dispatchAction({
      type: 'dataZoom',
      xAxisIndex: 0,
      start: s,
      end: e,
    } as any);
  }

  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    window.requestAnimationFrame(() => {
      this.renderScheduled = false;
      this.renderChart();
    });
  }

  private renderChart(): void {
    if (!this.chart) return;
    if (this.isRenderingChart) return;
    this.isRenderingChart = true;
    try {
    if (this.showSectorChart) {
      if (this.sectorChartMode === 'line') {
        this.renderSectorLineChart();
      } else {
        this.renderSectorChart();
      }
      return;
    }
    const activeSeries = this.salesMetric === 'count' ? this.salesCountSeries : this.salesTotalSeries;
    if (!activeSeries.length) {
      this.chart.clear();
      return;
    }

      const labels = activeSeries.map((s) => s.label);
      const values = activeSeries.map((s) => s.value);
      const { startIndex, endIndex } = this.getZoomIndexes(labels);
      const showSymbols = true;

      const option: echarts.EChartsOption = {
        backgroundColor: 'transparent',
        animation: false,
        grid: { left: 64, right: 28, top: 16, bottom: 48 },
        tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        backgroundColor: 'rgba(8, 12, 24, 0.95)',
        borderColor: 'rgba(240, 210, 122, 0.6)',
        textStyle: { color: '#e5e7eb' },
        confine: true,
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
          const profitValue = this.salesProfitSeries[idx]?.value ?? 0;
          const revenueValue = this.salesRevenueSeries[idx]?.value ?? 0;
          const serviceValue = this.salesServiceSeries[idx]?.value ?? 0;
          const totalValue = this.salesTotalSeries[idx]?.value ?? 0;
          const revenueLabel = `Faturamento: ${this.formatMoney(revenueValue)}`;
          const serviceLabel = `Serviços: ${this.formatMoney(serviceValue)}`;
          const totalLabel = `Total: ${this.formatMoney(totalValue)}`;
          const profitLabel = `Lucro: ${this.formatMoney(profitValue)}`;
          const countLabel = `Qtd: ${countValue}`;
          const dateLabel = String((p as any)?.axisValue ?? '');
          return `${dateLabel}<br/>${revenueLabel}<br/>${serviceLabel}<br/>${totalLabel}<br/>${profitLabel}<br/>${countLabel}`;
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
          xAxisIndex: 0,
          startValue: labels[startIndex],
          endValue: labels[endIndex],
          zoomOnMouseWheel: 'ctrl',
          moveOnMouseWheel: true,
          moveOnMouseMove: true,
        },
      ],
        series: [
          {
            type: 'line',
            data: values,
            showSymbol: showSymbols,
            symbolSize: showSymbols ? 6 : 0,
            symbol: 'circle',
            sampling: 'lttb',
            smooth: false,
            progressive: 3000,
            progressiveThreshold: 2000,
            lineStyle: { color: '#f5df7b', width: 2 },
            itemStyle: { color: '#f5df7b' },
            emphasis: {
              focus: 'series',
              lineStyle: { width: 3 },
            },
            areaStyle: showSymbols ? { color: 'rgba(240, 210, 122, 0.25)' } : undefined,
          },
        ],
      };

      this.ngZone.runOutsideAngular(() => {
        this.chart?.setOption(option, true);
      });
      this.zoomRange = { startIndex, endIndex };
      this.updateVisibleProfit();
      } finally {
        this.isRenderingChart = false;
      }
    }

  private renderSectorChart(): void {
    if (!this.chart) return;
    if (!this.sectorChartData.length) {
      this.chart.clear();
      return;
    }

    const data = this.sectorChartData.map((s) => ({
      name: s.name,
      value: s.value,
      itemStyle: { color: this.getSetorColor(s.id, s.name) },
    }));

      const option: echarts.EChartsOption = {
        backgroundColor: 'transparent',
        animation: false,
        tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(8, 12, 24, 0.95)',
        borderColor: 'rgba(240, 210, 122, 0.6)',
        textStyle: { color: '#e5e7eb' },
        formatter: (p: any) => {
          const name = p?.name ?? '';
          const value = this.formatMoney(Number(p?.value ?? 0));
          const percent = Number(p?.percent ?? 0).toFixed(1);
          return `${name}<br/>${value}<br/>${percent}%`;
        },
      },
        series: [
          {
            type: 'pie',
          radius: ['35%', '70%'],
          center: ['50%', '52%'],
          avoidLabelOverlap: true,
          label: { color: '#e5e7eb' },
          labelLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.45)' } },
          data,
        },
        ],
      };

      this.ngZone.runOutsideAngular(() => {
        this.chart?.setOption(option, true);
      });
    }

  private renderSectorLineChart(): void {
    if (!this.chart) return;
    if (!this.sectorLineSeries.length || !this.salesBucketStarts.length) {
      this.chart.clear();
      return;
    }

    const labels = this.salesBucketStarts.map((d, idx) => this.salesProfitSeries[idx]?.label ?? this.formatShortDate(d));
    const showSymbols = labels.length <= 60;
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animation: false,
      grid: { left: 64, right: 24, top: 16, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(8, 12, 24, 0.95)',
        borderColor: 'rgba(240, 210, 122, 0.6)',
        textStyle: { color: '#e5e7eb' },
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params];
          const lines = list.map((p: any) => `${p.seriesName}: ${this.formatMoney(Number(p.value ?? 0))}`);
          const dateLabel = String((list[0] as any)?.axisValue ?? '');
          return `${dateLabel}<br/>${lines.join('<br/>')}`;
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
        axisLabel: { color: '#94a3b8', formatter: (value: number) => this.formatMoney(Number(value)) },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.2)' } },
      },
        series: this.sectorLineSeries.map((series) => ({
          type: 'line',
          name: series.name,
          data: series.data,
          showSymbol: showSymbols,
          symbolSize: showSymbols ? 6 : 0,
          sampling: 'lttb',
          smooth: false,
          progressive: 2000,
          progressiveThreshold: 1500,
          lineStyle: { width: 2, color: this.getSetorColor(series.id, series.name) },
          itemStyle: { color: this.getSetorColor(series.id, series.name) },
          areaStyle: undefined,
        })),
      };

    this.ngZone.runOutsideAngular(() => {
      this.chart?.setOption(option, true);
    });
  }

  private buildProfitMap(details: SaleDetailsDto[]): Map<number, number> {
    const map = new Map<number, number>();
    details.forEach((detail) => {
      const profit = this.calculateSaleProfit(detail);
      map.set(detail.id, profit);
    });
    return map;
  }

  private buildProductMap(details: SaleDetailsDto[]): Map<number, number> {
    const map = new Map<number, number>();
    details.forEach((detail) => {
      const productRevenue = this.calculateSaleProductRevenue(detail);
      map.set(detail.id, productRevenue);
    });
    return map;
  }

  private buildServiceMap(details: SaleDetailsDto[]): Map<number, number> {
    const map = new Map<number, number>();
    details.forEach((detail) => {
      const serviceRevenue = this.calculateSaleServiceRevenue(detail);
      map.set(detail.id, serviceRevenue);
    });
    return map;
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
        firstValueFrom(this.produtos.listarPorLoja(this.loja.id).pipe(timeout(8000))),
        firstValueFrom(this.setores.listar().pipe(timeout(8000))),
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
      this.inventoryProfitLabel = this.formatMoney(totalSale - totalCost);
      this.scheduleTopSetoresUpdate();
    } catch {
      this.visibleInventoryCostLabel = this.formatMoney(0);
      this.visibleInventorySaleLabel = this.formatMoney(0);
      this.inventoryProfitLabel = this.formatMoney(0);
      this.topSetores = [];
    } finally {
      this.inventoryLoaded = true;
    }
  }

  setSalesView(view: 'day' | 'week' | 'month' | 'year'): void {
    this.salesView = view;
    const defaultRange =
      view === 'day' ? 30 :
      view === 'year' ? 365 :
      90;
    this.salesRangeDays = defaultRange;
    this.manualRange = null;
    this.syncRangeQtyFromDays();
    this.salesRangeLabel = this.rangeLabel(this.salesRangeDays);
    this.rebuildViewSeries();
    this.renderChart();
  }

  onRangeQtyInput(event: Event): void {
    const raw = Number((event.target as HTMLInputElement | null)?.value ?? 0);
    if (!Number.isFinite(raw)) return;
    const qty = Math.max(1, Math.floor(raw));
    this.rangeQty = qty;
    this.manualRange = null;
    this.salesRangeDays = qty * this.daysPerUnit(this.salesView);
    this.salesRangeLabel = this.rangeLabel(this.salesRangeDays);
    this.rebuildViewSeries();
    this.renderChart();
  }

  toggleRangePicker(): void {
    this.rangePickerOpen = !this.rangePickerOpen;
    if (this.rangePickerOpen && !this.rangeStart && !this.rangeEnd) {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - (this.salesRangeDays - 1));
      this.rangeStart = this.formatIsoDate(start);
      this.rangeEnd = this.formatIsoDate(end);
    }
  }

  applyRangePicker(): void {
    const start = this.parseDateInput(this.rangeStart);
    const end = this.parseDateInput(this.rangeEnd);
    if (!start || !end) return;
    const rangeStart = start <= end ? start : end;
    const rangeEnd = start <= end ? end : start;
    this.manualRange = { start: rangeStart, end: rangeEnd };
    const diffDays = Math.max(
      1,
      Math.floor((this.startOfDay(rangeEnd).getTime() - this.startOfDay(rangeStart).getTime()) / 86400000) + 1
    );
    this.salesRangeDays = diffDays;
    this.rangeQty = this.countBucketsForRange(rangeStart, rangeEnd);
    this.salesRangeLabel = this.rangeLabel(this.salesRangeDays);
    this.rebuildViewSeries();
    this.renderChart();
    this.rangePickerOpen = false;
  }

  private syncRangeQtyFromDays(): void {
    this.rangeQty = Math.max(1, Math.round(this.salesRangeDays / this.daysPerUnit(this.salesView)));
  }

  private daysPerUnit(view: 'day' | 'week' | 'month' | 'year'): number {
    if (view === 'week') return 7;
    if (view === 'month') return 30;
    if (view === 'year') return 365;
    return 1;
  }

  private parseDateInput(value: string): Date | null {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private countBucketsForRange(start: Date, end: Date): number {
    if (this.salesView === 'day') {
      return Math.max(
        1,
        Math.floor((this.startOfDay(end).getTime() - this.startOfDay(start).getTime()) / 86400000) + 1
      );
    }
    if (this.salesView === 'week') {
      const s = this.startOfWeek(start);
      const e = this.startOfWeek(end);
      return Math.max(1, Math.floor((e.getTime() - s.getTime()) / (86400000 * 7)) + 1);
    }
    if (this.salesView === 'month') {
      return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
    }
    return Math.max(1, end.getFullYear() - start.getFullYear() + 1);
  }

  private updateVisibleProfit(): void {
    if (!this.salesProfitSeries.length || !this.salesCountSeries.length || !this.chart) {
      this.visibleRevenueLabel = this.formatMoney(0);
      this.visibleProfitLabel = this.formatMoney(0);
      this.visibleServiceRevenueLabel = this.formatMoney(0);
      this.visibleTotalLabel = this.formatMoney(0);
      this.visibleTicketLabel = this.formatMoney(0);
      this.visibleSalesCount = 0;
      this.salesRangeLabel = this.rangeLabel(this.salesRangeDays);
      return;
    }

    const profitValues = this.salesProfitSeries.map((s) => s.value);
    const revenueValues = this.salesRevenueSeries.map((s) => s.value);
    const serviceValues = this.salesServiceSeries.map((s) => s.value);
    const totalValues = this.salesTotalSeries.map((s) => s.value);
    const counts = this.salesCountSeries.map((s) => s.value);
    const range = this.zoomRange ?? { startIndex: 0, endIndex: profitValues.length - 1 };
    const startIndex = Math.max(0, Math.min(range.startIndex - 1, profitValues.length - 1));
    const endIndex = Math.max(startIndex, Math.min(range.endIndex + 1, profitValues.length - 1));

    let profitSum = 0;
    let revenueSum = 0;
    let serviceSum = 0;
    let totalSum = 0;
    let countSum = 0;
    for (let i = startIndex; i <= endIndex; i += 1) {
      profitSum += Number(profitValues[i] ?? 0);
      revenueSum += Number(revenueValues[i] ?? 0);
      serviceSum += Number(serviceValues[i] ?? 0);
      totalSum += Number(totalValues[i] ?? 0);
      countSum += Number(counts[i] ?? 0);
    }

    this.visibleRevenueLabel = this.formatMoney(revenueSum);
    this.visibleProfitLabel = this.formatMoney(profitSum);
    this.visibleServiceRevenueLabel = this.formatMoney(serviceSum);
    this.visibleTotalLabel = this.formatMoney(totalSum);
    this.visibleSalesCount = countSum;
    const ticket = countSum > 0 ? revenueSum / countSum : 0;
    this.visibleTicketLabel = this.formatMoney(ticket);
    this.updateSalesRangeLabelFromZoom();
  }


  private captureZoomRange(evt: any): void {
    if (!this.salesProfitSeries.length) return;
    if (this.manualRange) {
      this.manualRange = null;
    }
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

    const nextRange = { startIndex, endIndex };
    if (this.zoomRange && this.zoomRange.startIndex === nextRange.startIndex && this.zoomRange.endIndex === nextRange.endIndex) {
      return;
    }
    this.zoomRange = nextRange;
    this.scheduleTopSetoresUpdate();
    this.updateSalesRangeLabelFromZoom();
  }

  private updateSalesRangeLabelFromZoom(): void {
    const total = this.salesBucketStarts.length;
    if (!total) {
      this.salesRangeLabel = this.rangeLabel(this.salesRangeDays);
      return;
    }

    const range = this.zoomRange ?? { startIndex: 0, endIndex: total - 1 };
    const startIndex = Math.max(0, Math.min(range.startIndex, total - 1));
    const endIndex = Math.max(startIndex, Math.min(range.endIndex, total - 1));
    const count = Math.max(1, endIndex - startIndex + 1);
    this.rangeQty = count;

    if (this.salesView === 'day') {
      this.salesRangeLabel = count === 1 ? '1 dia' : `${count} dias`;
      return;
    }
    if (this.salesView === 'week') {
      this.salesRangeLabel = count === 1 ? '1 semana' : `${count} semanas`;
      return;
    }
    if (this.salesView === 'month') {
      this.salesRangeLabel = count === 1 ? '1 mês' : `${count} meses`;
      return;
    }
    this.salesRangeLabel = count === 1 ? '1 ano' : `${count} anos`;
  }

  private getRangeBuckets(): number {
    return Math.max(1, Math.floor(this.rangeQty || 1));
  }

  private updateSalesRangeLabel(): void {
    return;
  }

  private getZoomIndexes(labels: string[]): { startIndex: number; endIndex: number } {
    const endIndex = Math.max(0, labels.length - 1);
    if (this.manualRange && this.salesBucketStarts.length) {
      const startBound = this.startOfDay(this.manualRange.start);
      const endBound = this.startOfDay(this.manualRange.end);
      let startIndex = 0;
      let endIndexRange = endIndex;

      for (let i = 0; i < this.salesBucketEnds.length; i += 1) {
        if (this.salesBucketEnds[i] >= startBound) {
          startIndex = i;
          break;
        }
      }

      for (let i = this.salesBucketStarts.length - 1; i >= 0; i -= 1) {
        if (this.salesBucketStarts[i] <= endBound) {
          endIndexRange = i;
          break;
        }
      }

      if (endIndexRange < startIndex) {
        endIndexRange = startIndex;
      }
      return { startIndex, endIndex: endIndexRange };
    }

    const rangeBuckets = this.getRangeBuckets();
    const startIndex = Math.max(0, endIndex - (rangeBuckets - 1));
    return { startIndex, endIndex };
  }

  private rebuildViewSeries(): void {
    if (!this.dailyStart || !this.dailyProfitTotals.length) {
      this.salesProfitSeries = [];
      this.salesCountSeries = [];
      this.salesRevenueSeries = [];
      this.salesServiceSeries = [];
      this.salesTotalSeries = [];
      this.salesBucketStarts = [];
      this.salesBucketEnds = [];
      return;
    }

    const buckets = new Map<string, { start: Date; profit: number; revenue: number; service: number; total: number; count: number }>();
    for (let i = 0; i < this.dailyProfitTotals.length; i += 1) {
      const day = new Date(this.dailyStart);
      day.setDate(day.getDate() + i);
      const profit = Number(this.dailyProfitTotals[i] ?? 0);
      const revenue = Number(this.dailyRevenueTotals[i] ?? 0);
      const service = Number(this.dailyServiceTotals[i] ?? 0);
      const total = Number(this.dailyTotalTotals[i] ?? 0);
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
        current.revenue += revenue;
        current.service += service;
        current.total += total;
        current.count += count;
      } else {
        buckets.set(key, { start: bucketStart, profit, revenue, service, total, count });
      }
    }

    const ordered = Array.from(buckets.entries())
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    this.salesProfitSeries = ordered.map((item) => ({ label: item.label, value: item.profit }));
    this.salesRevenueSeries = ordered.map((item) => ({ label: item.label, value: item.revenue }));
    this.salesServiceSeries = ordered.map((item) => ({ label: item.label, value: item.service }));
    this.salesTotalSeries = ordered.map((item) => ({ label: item.label, value: item.total }));
    this.salesCountSeries = ordered.map((item) => ({ label: item.label, value: item.count }));
    this.salesBucketStarts = ordered.map((item) => this.startOfDay(item.start));
    this.salesBucketEnds = ordered.map((item) => this.getBucketEnd(item.start));
    this.scheduleTopSetoresUpdate();
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
    if (this.salesLoading) return;
    if (this.topSetoresLoading) {
      this.topSetoresPending = true;
      return;
    }
    const range = this.getVisibleRangeDates();
    if (!range) return;

    const dataInicio = this.formatIsoDate(range.start);
    const dataFim = this.formatIsoDate(range.end);
    const key = `${this.salesView}:${this.salesRangeDays}:${dataInicio}:${dataFim}`;
    if (key === this.lastTopSetoresKey) return;
    this.lastTopSetoresKey = key;

    this.topSetoresLoading = true;
    this.topSetoresPending = false;
    this.pdv.listItemSummary(dataInicio, dataFim, [2]).pipe(timeout(8000)).subscribe({
      next: (items) => {
        this.applyTopSetores(items);
        if (this.showSectorChart && this.sectorChartMode === 'line') {
          this.loadSectorLineChart();
        }
      },
      error: () => {
        this.topSetores = [];
      },
      complete: () => {
        this.topSetoresLoading = false;
        if (this.topSetoresPending) {
          this.loadTopSetoresBySales();
        }
      },
    });
  }

  private loadSectorLineChart(): void {
    if (!this.salesBucketStarts.length || !this.salesBucketEnds.length) return;
    const range = this.getVisibleRangeDates();
    if (!range) return;

    const labels = this.salesBucketStarts;
    const startIndex = Math.max(0, this.salesBucketStarts.findIndex(d => d >= range.start));
    const endIndex = Math.max(startIndex, this.salesBucketEnds.findIndex(d => d >= range.end));
    let bucketStarts = labels.slice(startIndex, endIndex + 1);
    let bucketEnds = this.salesBucketEnds.slice(startIndex, endIndex + 1);

    const maxBuckets = 12;
    if (bucketStarts.length > maxBuckets) {
      bucketStarts = bucketStarts.slice(-maxBuckets);
      bucketEnds = bucketEnds.slice(-maxBuckets);
    }

    const key = `${this.salesView}:${bucketStarts[0]?.toISOString()}:${bucketEnds[bucketEnds.length - 1]?.toISOString()}`;
    if (key === this.lastSectorLineKey || this.sectorLineLoading) return;
    this.lastSectorLineKey = key;
    this.sectorLineLoading = true;

    const requests = bucketStarts.map((start, idx) => {
      const end = bucketEnds[idx] ?? start;
      return this.pdv
        .listItemSummary(this.formatIsoDate(start), this.formatIsoDate(end), [2])
        .pipe(timeout(8000), catchError(() => of([])));
    });

    forkJoin(requests).subscribe({
      next: (responses) => {
      const sectorIds = new Set<number>();
      const buckets: Array<Map<number, number>> = responses.map((items) => {
        const map = new Map<number, number>();
        items.forEach((item) => {
          const valor = Number(item.total ?? 0);
          if (!valor) return;
          if (this.isProdutoItem(item)) {
            const produto = this.produtosMap.get(item.produtoId);
            if (!produto) return;
            const setorId = produto.setorFilhoId;
            if (!Number.isFinite(setorId)) return;
            map.set(setorId, (map.get(setorId) ?? 0) + valor);
            sectorIds.add(setorId);
            return;
          }
          if (this.isServiceItem(item)) {
            const serviceKey = -1;
            map.set(serviceKey, (map.get(serviceKey) ?? 0) + valor);
            sectorIds.add(serviceKey);
          }
        });
        return map;
      });

      const totals = new Map<number, number>();
      sectorIds.forEach((id) => totals.set(id, 0));
      buckets.forEach((bucket) => {
        bucket.forEach((valor, id) => {
          totals.set(id, (totals.get(id) ?? 0) + valor);
        });
      });

      const orderedIds = Array.from(totals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id]) => id);

      this.sectorLineSeries = orderedIds.map((id) => {
        const name = id === -1 ? 'Serviços' : this.setoresMap.get(id)?.nome ?? `Setor ${id}`;
        const data = buckets.map((bucket) => Number(bucket.get(id) ?? 0));
        return { id, name, data };
      });

      if (this.showSectorChart && this.sectorChartMode === 'line') {
        this.renderChart();
      }
      },
      complete: () => {
        this.sectorLineLoading = false;
      },
      error: () => {
        this.sectorLineLoading = false;
      },
    });
  }

  private applyTopSetores(items: SaleItemSummaryDto[]): void {
    const totals = new Map<number, number>();
    const serviceKey = -1;
    let totalSum = 0;

    items.forEach((item) => {
      const valor = Number(item.total ?? 0);
      if (!valor) return;

      if (this.isProdutoItem(item)) {
        const produto = this.produtosMap.get(item.produtoId);
        if (!produto) return;
        const setorId = produto.setorFilhoId;
        if (!Number.isFinite(setorId)) return;
        totals.set(setorId, (totals.get(setorId) ?? 0) + valor);
        totalSum += valor;
        return;
      }

      if (this.isServiceItem(item)) {
        totals.set(serviceKey, (totals.get(serviceKey) ?? 0) + valor);
        totalSum += valor;
      }
    });

    const entries = Array.from(totals.entries())
      .map(([id, valor]) => ({
        nome: id === serviceKey ? 'Serviços' : this.setoresMap.get(id)?.nome ?? `Setor ${id}`,
        valor,
        percentual: totalSum > 0 ? (valor / totalSum) * 100 : 0,
        id,
      }))
      .sort((a, b) => b.valor - a.valor);

    this.topSetores = entries.slice(0, 5).map(({ id, nome, valor, percentual }) => ({
      nome,
      valor,
      percentual,
    }));

    this.sectorChartData = entries.map(({ id, nome, valor }) => ({
      id,
      name: nome,
      value: valor,
    }));
  }

  private isProdutoItem(item: SaleItemSummaryDto): boolean {
    const tipo = String(item.tipo ?? '').trim().toLowerCase();
    return tipo === 'produto' || tipo === 'product';
  }

  private isServiceItem(item: SaleItemSummaryDto): boolean {
    const tipo = String(item.tipo ?? '').trim().toLowerCase();
    return tipo === 'servico' || tipo === 'serviço' || tipo === 'service';
  }

  private getSetorColor(id: number, name: string): string {
    const palette = [
      '#f5df7b',
      '#5bd1d7',
      '#8b9bff',
      '#f58f7b',
      '#7bf5a6',
      '#c67bff',
      '#f5b97b',
      '#7bd3f5',
      '#f57bc1',
      '#9bf57b',
    ];
    const seed = id === -1 ? 99991 : id;
    let hash = seed;
    for (let i = 0; i < name.length; i += 1) {
      hash = (hash * 31 + name.charCodeAt(i)) % 100000;
    }
    return palette[Math.abs(hash) % palette.length];
  }

  private calculateSaleProfit(detail: SaleDetailsDto): number {
    if (!detail?.items?.length) return 0;
    let costTotal = 0;
    let productTotal = 0;
    for (const item of detail.items) {
      const qtd = Number(item?.quantity ?? 0);
      if (qtd <= 0) continue;
      const tipo = String(item?.tipo ?? '').trim().toLowerCase();
      const isProduct = tipo === 'produto' || tipo === 'product';
      if (!isProduct) continue;
      const produto = this.produtosMap.get(Number(item?.produtoId));
      const cost = produto ? Number(produto.precoCusto ?? 0) : 0;
      costTotal += cost * qtd;
      const unit = Number(item?.unitPrice ?? 0);
      productTotal += unit * qtd;
    }
    return productTotal - costTotal;
  }

  private calculateSaleProductRevenue(detail: SaleDetailsDto): number {
    if (!detail?.items?.length) return 0;
    let total = 0;
    for (const item of detail.items) {
      const tipo = String(item?.tipo ?? '').trim().toLowerCase();
      const isProduct = tipo === 'produto' || tipo === 'product';
      if (!isProduct) continue;
      const qtd = Number(item?.quantity ?? 0);
      if (qtd <= 0) continue;
      const unit = Number(item?.unitPrice ?? 0);
      total += unit * qtd;
    }
    return total;
  }

  private calculateSaleServiceRevenue(detail: SaleDetailsDto): number {
    if (!detail?.items?.length) return 0;
    let total = 0;
    for (const item of detail.items) {
      const tipo = String(item?.tipo ?? '').trim().toLowerCase();
      const isService = tipo === 'servico' || tipo === 'serviço' || tipo === 'service';
      if (!isService) continue;
      const qtd = Number(item?.quantity ?? 0);
      if (qtd <= 0) continue;
      const unit = Number(item?.unitPrice ?? 0);
      total += unit * qtd;
    }
    return total;
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


