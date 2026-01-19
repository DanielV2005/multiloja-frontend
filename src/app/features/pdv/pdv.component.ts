import { AfterViewInit, Component, ElementRef, ViewChild, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { UsuarioService, Loja } from '../../core/services/usuario.service';
import { ItensVendaveisService, ItemVendavelDto } from '../../core/services/itens-vendaveis.service';
import { PdvService, SaleSummaryDto } from '../../core/services/pdv.service';
import { firstValueFrom, forkJoin } from 'rxjs';

interface CartItem {
  key: string;
  produtoId: number;
  tipo: 'PRODUTO' | 'SERVICO';
  nome: string;
  codigoBarra?: string | null;
  unitPrice: number;
  quantity: number;
  estoque?: number | null;
}

interface PaymentEntry {
  id: string;
  method: number;
  amount: number;
  refCode?: string | null;
  editing?: boolean;
}

interface DraftSale {
  id: string;
  createdAt: Date;
}

interface DraftPayload {
  id: string;
  createdAt: string;
  items: CartItem[];
  payments: PaymentEntry[];
  discountPercent: number;
}

@Component({
  standalone: true,
  selector: 'app-pdv',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <section class="page">
    <header class="topbar">
      <div class="title"></div>

      <div class="open-sales" *ngIf="queueEntries.length">
        <span
          class="chip"
          *ngFor="let entry of queueEntries"
          [class.active]="isEntryActive(entry)"
          (click)="selectEntry(entry)"
        >
          <span class="dot"></span>
          <span>#{{ queueIndex(entry) }}</span>
        </span>
      </div>

      <button class="btn btn-secondary" type="button" (click)="startNewSale()">Nova requisi&#231;&#227;o</button>
    </header>

    <main class="layout">
      <section class="panel search">
        <header class="panel-header">
          <a class="link" [routerLink]="['/loja', lojaId]">
            <span class="material-symbols-outlined">arrow_back</span>
            <span>Voltar ao painel</span>
          </a>
          <div class="type-toggle">
            <button type="button" [class.active]="tipoFiltro === 'ALL'" (click)="setTipoFiltro('ALL')">Todos</button>
            <button type="button" [class.active]="tipoFiltro === 'PRODUTO'" (click)="setTipoFiltro('PRODUTO')">Produtos</button>
            <button type="button" [class.active]="tipoFiltro === 'SERVICO'" (click)="setTipoFiltro('SERVICO')">Servi&#231;os</button>
          </div>
        </header>

        <div class="search-bar">
          <span class="material-symbols-outlined">search</span>
          <input
            #searchInput
            type="text"
            placeholder="Digite nome ou c&#243;digo de barras..."
            [(ngModel)]="filtro"
            (ngModelChange)="onBuscarChange()"
            (keydown.enter)="adicionarPrimeiroResultado()"
          />
          <div class="qty">
            <label for="qty">Qtd</label>
            <input id="qty" type="number" min="1" [(ngModel)]="quantidadePadrao" class="pdv-focus-search" />
          </div>
        </div>

        <div class="results" *ngIf="buscando">
          <div class="loading"><span class="spinner"></span>Buscando itens...</div>
        </div>

        <div class="results" *ngIf="!buscando">
          <div class="empty" *ngIf="filtro && resultados.length === 0">Nenhum item encontrado.</div>

          <div class="item" *ngFor="let item of resultados">
            <div class="item-main">
              <div class="item-name">{{ item.nome }}</div>
              <div class="item-meta">
                <span class="badge" [class.service]="item.tipo === 'SERVICO'">{{ item.tipo }}</span>
                <span class="muted" *ngIf="item.tipo === 'PRODUTO'">Estoque: {{ estoqueDisponivel(item) }}</span>
                <span class="muted" *ngIf="item.tipo === 'SERVICO'">Sem estoque</span>
              </div>
            </div>
            <div class="item-actions">
              <div class="price">{{ fmtMoney(item.precoVenda) }}</div>
              <button class="btn btn-outline" type="button" (click)="adicionarItem(item)">Adicionar</button>
            </div>
          </div>
        </div>
      </section>

      <section class="panel cart">
        <header class="panel-header">
          <div>
            <h3>Pedido atual</h3>
          </div>
          <div class="sale-meta" *ngIf="currentSale">
            <span class="chip ghost">#{{ queueIndex(currentSale.id) }}</span>
            <span class="chip ghost">{{ statusLabel(currentSale.status) }}</span>
          </div>
          <div class="sale-meta" *ngIf="!currentSale && currentDraftId">
            <span class="chip ghost">#{{ queueIndex(currentDraftId) }}</span>
            <span class="chip ghost">Rascunho</span>
          </div>
        </header>

        <div class="cart-list" *ngIf="currentItems.length">
          <div class="cart-row header">
            <span>Item</span>
            <span class="num">Qtd</span>
            <span class="num">Unit.</span>
            <span class="num">Total</span>
          </div>

          <div class="cart-row" *ngFor="let item of currentItems">
            <div class="item-cell">
              <div class="name">{{ item.nome }}</div>
              <div class="meta muted">{{ item.tipo }}</div>
            </div>
            <div class="num">
              <div class="qty-editor">
                <button type="button" class="qty-btn" (click)="alterarQuantidade(item, -1)">-</button>
                <input
                  type="number"
                  min="1"
                  class="pdv-focus-cart"
                  [ngModel]="item.quantity"
                  #qtyInput
                  (ngModelChange)="alterarQuantidadeDireta(item, $event, qtyInput)"
                  (blur)="onQuantidadeBlur(item)"
                />
                <button type="button" class="qty-btn" (click)="alterarQuantidade(item, 1)">+</button>
                <button type="button" class="qty-btn qty-remove" (click)="removerItem(item)">x</button>
              </div>
              <div class="qty-error" *ngIf="quantityError(item)">{{ quantityError(item) }}</div>
            </div>
            <div class="num">{{ fmtMoney(item.unitPrice) }}</div>
            <div class="num">{{ fmtMoney(item.unitPrice * item.quantity) }}</div>
          </div>
        </div>

        <div class="empty" *ngIf="!currentItems.length">
          Nenhum item adicionado ainda.
        </div>
      </section>

      <section class="panel summary">
        <header class="panel-header">
          <div>
            <h3>Resumo</h3>
          </div>
        </header>

        <div class="totals">
          <div>
            <span class="muted">Subtotal</span>
            <strong>{{ fmtMoney(subtotalValue) }}</strong>
          </div>
          <div>
            <span class="muted">{{ discountLabel() }}</span>
            <strong>{{ discountSign() }} {{ fmtMoney(discountValue) }}</strong>
          </div>
          <div class="total">
            <span>Total</span>
            <strong>{{ fmtMoney(totalValue) }}</strong>
          </div>
        </div>

        <div class="discount">
          <label>Desconto/Acr&#233;scimo (%)</label>
          <div class="discount-row">
            <input type="number" min="-100" max="100" step="0.01" [(ngModel)]="discountPercent" class="pdv-focus-summary" />
            <button
              class="btn btn-outline"
              type="button"
              (click)="currentSale ? aplicarDesconto() : aplicarDescontoRascunho()"
            >
              Aplicar
            </button>
          </div>
        </div>

        <div class="payments">
          <div class="payments-header">
            <h4>Pagamentos</h4>
            <span class="muted">Pago (vias digitais): {{ fmtMoney(valorPagoVirtual) }}</span>
          </div>
          <div class="payment-hint muted">
            Dispon&#237;vel para outras formas: {{ fmtMoney(valorRestanteVirtual) }}
          </div>

          <div class="payments-scroll">
            <div class="payment-list" *ngIf="currentPayments.length">
              <div class="payment-row" *ngFor="let p of currentPayments">
                <div class="payment-main">
                  <select [(ngModel)]="p.method" [disabled]="!p.editing" class="pdv-focus-summary">
                    <option [ngValue]="2">Pix</option>
                    <option [ngValue]="3">D&#233;bito</option>
                    <option [ngValue]="4">Cr&#233;dito</option>
                    <option [ngValue]="5">Voucher</option>
                  </select>
                  <input type="number" min="0" step="0.01" [(ngModel)]="p.amount" [disabled]="!p.editing" class="pdv-focus-summary" />
                  <input type="text" placeholder="Refer&#234;ncia" [(ngModel)]="p.refCode" [disabled]="!p.editing" class="pdv-focus-summary" />
                </div>
                <div class="payment-actions">
                  <button class="btn btn-outline" type="button" *ngIf="!p.editing" (click)="editarPagamento(p)">Editar</button>
                  <button class="btn btn-outline" type="button" *ngIf="p.editing" (click)="salvarPagamento(p)">Salvar</button>
                  <button class="btn btn-outline" type="button" *ngIf="p.editing" (click)="cancelarEdicaoPagamento(p)">Cancelar</button>
                  <button class="btn btn-outline" type="button" (click)="removerPagamento(p)">Remover</button>
                </div>
              </div>
            </div>

            <div class="payment-form">
              <select [(ngModel)]="novoPagamento.metodo" class="pdv-focus-summary">
                <option [ngValue]="2">Pix</option>
                <option [ngValue]="3">D&#233;bito</option>
                <option [ngValue]="4">Cr&#233;dito</option>
                <option [ngValue]="5">Voucher</option>
              </select>
              <input type="number" min="0" step="0.01" placeholder="Valor" [(ngModel)]="novoPagamento.valor" class="pdv-focus-summary" />
              <input type="text" placeholder="Refer&#234;ncia (opcional)" [(ngModel)]="novoPagamento.ref" class="pdv-focus-summary" />
              <button class="btn btn-outline" type="button" (click)="adicionarPagamento()">Adicionar</button>
            </div>
          </div>

            <div class="cash-helper">
              <div class="cash-row">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Dinheiro recebido (c&#233;dulas)"
                  class="pdv-focus-summary"
                  [(ngModel)]="cashReceived"
                />
                <div class="cash-change">
                  <span class="muted">Troco</span>
                  <strong>{{ fmtMoney(trocoValue) }}</strong>
                </div>
              </div>
            </div>

          <div class="remaining">
            <span>Dinheiro</span>
            <strong>{{ fmtMoney(valorRestanteVirtual) }}</strong>
          </div>
        </div>

        <div class="actions">
          <button class="btn btn-outline" type="button" [disabled]="hasQuantityErrors" (click)="cancelarVenda()">Cancelar venda</button>
          <button class="btn btn-gold" type="button" [disabled]="!currentSale || hasQuantityErrors" (click)="finalizarVenda()">Finalizar</button>
        </div>
      </section>
    </main>
  </section>
  `,
  styles: [`
    :host{ display:block; }
    .material-symbols-outlined{ font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; }

    .page{
      min-height:100dvh;
      padding:22px 20px 28px;
      background: radial-gradient(1200px 700px at 10% -20%, rgba(240,210,122,.18), transparent 70%),
                  radial-gradient(900px 600px at 110% 10%, rgba(148,163,184,.16), transparent 60%),
                  var(--bg);
      color:var(--text);
    }

    .topbar{
      display:flex;
      align-items:center;
      gap:10px;
      flex-wrap:wrap;
      margin-bottom:14px;
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

    .title h2{ margin:0; font-size:1.5rem; }
    .title .muted{ font-size:.85rem; }

    .open-sales{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }

    .chip{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:6px 12px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.3);
      background:rgba(15,23,42,.6);
      color:var(--text);
      font-size:.82rem;
      cursor:pointer;
    }
    .chip .dot{
      width:6px;
      height:6px;
      border-radius:50%;
      background:#facc15;
      box-shadow:0 0 6px rgba(250,204,21,.7);
    }
    .chip.active{
      border-color:rgba(240,210,122,.8);
      box-shadow:0 0 14px rgba(240,210,122,.35);
    }
    .chip.ghost{
      cursor:default;
      background:rgba(15,23,42,.5);
    }

    .btn{
      height:36px;
      padding:0 14px;
      border-radius:999px;
      border:1px solid transparent;
      cursor:pointer;
      font-size:.9rem;
      font-weight:600;
      display:inline-flex;
      align-items:center;
      gap:6px;
    }
    .btn-secondary{
      border-color:var(--border);
      background:rgba(15,23,42,.85);
      color:var(--muted);
    }
    .btn-secondary:hover{ color:var(--text); border-color:#cbd5f5; }

    .btn-outline{
      border-color:var(--border);
      background:transparent;
      color:var(--muted);
    }
    .btn-outline:hover{ background:rgba(127,127,127,.12); color:var(--text); border-color:#cfcfd4; }

    .btn-gold{
      border-color:#9e7b14;
      color:#151515;
      background:
        radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.20), transparent 60%),
        linear-gradient(180deg,#F5DF7B 0%, var(--primary) 55%, var(--primary-600) 100%);
      box-shadow:0 8px 20px rgba(218,171,31,.45), inset 0 -2px 0 rgba(0,0,0,.18);
    }

    .layout{
      display:grid;
      grid-template-columns: minmax(280px, 1.1fr) minmax(320px, 1.4fr) minmax(280px, 1fr);
      gap:16px;
    }

    .panel{
      background:var(--surface);
      border:1px solid var(--border);
      border-radius:18px;
      box-shadow:var(--shadow);
      padding:16px;
      display:flex;
      flex-direction:column;
      gap:14px;
      min-height:320px;
    }

    .panel-header{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
    }

    .panel-header h3{ margin:0; font-size:1.2rem; }

    .type-toggle{
      display:inline-flex;
      gap:6px;
      padding:4px;
      background:rgba(15,23,42,.9);
      border-radius:999px;
      border:1px solid rgba(148,163,184,.3);
    }
    .type-toggle button{
      border:none;
      background:transparent;
      color:var(--muted);
      font-size:.78rem;
      padding:4px 10px;
      border-radius:999px;
      cursor:pointer;
    }
    .type-toggle button.active{
      background:rgba(240,210,122,.15);
      color:var(--text);
      border:1px solid rgba(240,210,122,.6);
    }

    .search-bar{
      display:grid;
      grid-template-columns: 24px 1fr auto;
      gap:10px;
      align-items:center;
      padding:10px 12px;
      border-radius:14px;
      border:1px solid rgba(148,163,184,.35);
      background:#050814;
    }
    .search-bar input{
      border:none;
      background:transparent;
      color:var(--text);
      font-size:.95rem;
      outline:none;
    }
    .pdv-focus-search:focus-visible{
      outline:3px solid rgba(56,189,248,.95);
      outline-offset:2px;
      box-shadow:0 0 0 5px rgba(56,189,248,.35);
      border-radius:10px;
    }
    .search-bar .qty{
      display:flex;
      align-items:center;
      gap:6px;
      color:var(--muted);
    }
    .search-bar .qty input{
      width:64px;
      height:30px;
      border-radius:10px;
      border:1px solid var(--border);
      background:#0b1020;
      color:var(--text);
      padding:0 8px;
      outline:none;
    }

    .results{
      display:flex;
      flex-direction:column;
      gap:10px;
      max-height:500px;
      overflow-y:auto;
      padding-right:10px;
      scrollbar-width: thin;
      scrollbar-color: rgba(80,110,160,.8) rgba(8,12,26,.8);
    }
    .results::-webkit-scrollbar{
      width:10px;
    }
    .results::-webkit-scrollbar-track{
      background: rgba(8,12,26,.8);
      border-radius: 10px;
    }
    .results::-webkit-scrollbar-thumb{
      background: linear-gradient(180deg, rgba(90,130,190,.95), rgba(60,90,140,.85));
      border-radius: 10px;
      border: 2px solid rgba(8,12,26,.8);
    }

    .item{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      border-radius:12px;
      padding:10px 12px;
      border:1px solid rgba(148,163,184,.25);
      background:rgba(5,8,20,.85);
    }

    .item-main{ display:flex; flex-direction:column; gap:4px; }
    .item-name{ font-weight:600; }
    .item-meta{ display:flex; gap:8px; align-items:center; font-size:.78rem; }

    .badge{
      padding:2px 8px;
      border-radius:999px;
      border:1px solid rgba(240,210,122,.6);
      font-size:.7rem;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:#facc15;
    }
    .badge.service{
      border-color:rgba(56,189,248,.6);
      color:#38bdf8;
    }

    .item-actions{
      display:flex;
      align-items:center;
      gap:10px;
    }
    .price{ font-weight:700; font-size:1.05rem; }

    .cart-list{
      display:flex;
      flex-direction:column;
      gap:10px;
      max-height:500px;
      overflow-y:auto;
      padding-right:10px;
      scrollbar-width: thin;
      scrollbar-color: rgba(80,110,160,.8) rgba(8,12,26,.8);
    }
    .cart-list::-webkit-scrollbar{
      width:10px;
    }
    .cart-list::-webkit-scrollbar-track{
      background: rgba(8,12,26,.8);
      border-radius: 10px;
    }
    .cart-list::-webkit-scrollbar-thumb{
      background: linear-gradient(180deg, rgba(90,130,190,.95), rgba(60,90,140,.85));
      border-radius: 10px;
      border: 2px solid rgba(8,12,26,.8);
    }
    .cart-row{
      display:grid;
      grid-template-columns: 1.2fr 0.55fr 0.4fr 0.4fr;
      gap:10px;
      align-items:center;
      padding:8px 10px;
      border-bottom:1px solid rgba(148,163,184,.2);
    }
    .cart-row.header{
      font-size:.72rem;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:var(--muted);
      border-bottom:1px solid rgba(240,210,122,.35);
      position: sticky;
      top: 0;
      z-index: 2;
      background: linear-gradient(180deg, rgba(15,21,40,.98), rgba(15,21,40,.92));
    }
    .cart-row .num{ text-align:right; font-variant-numeric:tabular-nums; font-size:1rem; }
    .item-cell .name{ font-weight:600; }
    .qty-editor{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:6px;
    }
    .qty-error{
      margin-top:6px;
      color:#fca5a5;
      font-size:.75rem;
      text-align:right;
    }
    .qty-editor input{
      width:54px;
      height:30px;
      border-radius:8px;
      border:1px solid var(--border);
      background:#050814;
      color:var(--text);
      text-align:center;
      font-variant-numeric:tabular-nums;
      outline:none;
    }
    .pdv-focus-cart:focus-visible{
      border-color:rgba(56,189,248,.95);
      box-shadow:0 0 0 5px rgba(56,189,248,.32);
    }
    .qty-btn{
      width:26px;
      height:26px;
      border-radius:8px;
      border:1px solid rgba(148,163,184,.35);
      background:rgba(15,23,42,.8);
      color:var(--text);
      cursor:pointer;
      font-weight:700;
      line-height:1;
    }
    .qty-remove{
      width:30px;
      border-color:rgba(239,68,68,.5);
      color:#fca5a5;
    }

    .totals{ display:flex; flex-direction:column; gap:8px; }
    .totals > div{ display:flex; justify-content:space-between; align-items:center; font-size:1.02rem; }
    .totals .total{
      font-size:1.4rem;
      border-top:1px solid rgba(240,210,122,.4);
      padding-top:10px;
    }
    .totals strong{ font-size:1.12rem; }
    .totals .total strong{ font-size:1.55rem; }

    .discount{ display:flex; flex-direction:column; gap:6px; }
    .discount-row{ display:flex; gap:8px; }
    .discount-row input{
      flex:1;
      height:34px;
      border-radius:10px;
      border:1px solid var(--border);
      background:#050814;
      color:var(--text);
      padding:0 10px;
      outline:none;
    }
    .pdv-focus-summary:focus-visible{
      border-color:rgba(56,189,248,.95);
      box-shadow:0 0 0 5px rgba(56,189,248,.32);
    }

    .btn:focus-visible,
    .qty-btn:focus-visible{
      outline:3px solid rgba(56,189,248,.95);
      outline-offset:2px;
      box-shadow:0 0 0 5px rgba(56,189,248,.35);
    }

    .payments{ display:flex; flex-direction:column; gap:5px; }
    .payments-header{ display:flex; align-items:center; justify-content:space-between; }
    .payments-scroll{
      max-height:160px;
      overflow-y: auto;
      overflow-x:hidden;
      padding-right:34px;
      border:3px solid rgba(240,210,122,.6);
      border-radius:20px;
      padding:10px;
      scrollbar-gutter: stable;
      scrollbar-width: thin;
      scrollbar-color: rgba(80,110,160,.8) rgba(8,12,26,.8);
    }
    .payments-scroll::-webkit-scrollbar{
      width:10px;
    }
    .payments-scroll::-webkit-scrollbar-track{
      background: rgba(8,12,26,.8);
      border-radius: 10px;
    }
    .payments-scroll::-webkit-scrollbar-thumb{
      background: linear-gradient(180deg, rgba(90,130,190,.95), rgba(60,90,140,.85));
      border-radius: 10px;
      border: 2px solid rgba(8,12,26,.8);
    }
    .payment-list{ display:flex; flex-direction:column; gap:6px; }
    .payment-row{
      display:flex;
      flex-direction:column;
      gap:8px;
      padding:8px 0;
      border-bottom:1px solid rgba(148,163,184,.2);
    }
    .payment-hint{
      font-size:.82rem;
      margin-top:-6px;
    }
    .payment-main{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:8px;
    }
    .payment-main select,
    .payment-main input{
      height:34px;
      border-radius:10px;
      border:1px solid var(--border);
      background:#050814;
      color:var(--text);
      padding:0 10px;
      outline:none;
      width:100%;
    }
    .payment-actions{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }
    .payment-actions .btn{
      flex:1 1 120px;
    }

    .payment-form{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:8px;
    }
    .payment-form select,
    .payment-form input{
      height:34px;
      border-radius:10px;
      border:1px solid var(--border);
      background:#050814;
      color:var(--text);
      padding:0 10px;
      outline:none;
      width:100%;
    }
    .payment-form button{
      grid-column:1 / -1;
      justify-content:center;
    }
    @media (max-width: 820px){
      .payment-main{ grid-template-columns: 1fr; }
      .payment-form{ grid-template-columns: 1fr; }
      .payment-actions{ justify-content:flex-start; }
      .payment-form button{ width:100%; }
    }

    .cash-helper{
      display:flex;
      flex-direction:column;
      gap:6px;
      margin-top:4px;
    }
    .cash-row{
      display:flex;
      align-items:center;
      gap:10px;
    }
    .cash-row input{
      flex:1;
      height:34px;
      border-radius:10px;
      border:1px solid var(--border);
      background:#050814;
      color:var(--text);
      padding:0 10px;
      outline:none;
    }
    .cash-change{
      min-width:120px;
      display:flex;
      flex-direction:column;
      align-items:flex-end;
      gap:2px;
      font-variant-numeric: tabular-nums;
    }

    .remaining{
      display:flex;
      justify-content:space-between;
      font-size:1.3rem;
      padding-top:8px;
      border-top:1px solid rgba(148,163,184,.25);
    }

    .actions{ display:flex; gap:10px; flex-wrap:wrap; }

    .loading{ display:flex; align-items:center; gap:8px; }
    .spinner{
      width:14px;
      height:14px;
      border-radius:50%;
      border:2px solid rgba(255,255,255,.35);
      border-top-color:#fff;
      animation:spin .8s linear infinite;
    }
    @keyframes spin{ to{ transform:rotate(360deg); } }

    .empty{ color:var(--muted); padding:10px 0; }
    .muted{ color:var(--muted); }

    @media (max-width: 1100px){
      .layout{ grid-template-columns: 1fr; }
      .panel{ min-height:unset; }
    }
  `]
})
export class PdvComponent implements AfterViewInit, OnDestroy, OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private usuarioService = inject(UsuarioService);
  private itensService = inject(ItensVendaveisService);
  private pdvService = inject(PdvService);
  private host = inject(ElementRef<HTMLElement>);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  lojaId = 0;
  loja: Loja | null = null;

  openSales: SaleSummaryDto[] = [];
  draftSales: DraftSale[] = [];
  currentSale: SaleSummaryDto | null = null;
  currentDraftId: string | null = null;

  filtro = '';
  tipoFiltro: 'ALL' | 'PRODUTO' | 'SERVICO' = 'ALL';
  resultados: ItemVendavelDto[] = [];
    buscando = false;
    quantidadePadrao = 1;
    discountPercent = 0;
    cashReceived: number | null = null;

  private buscaTimer: any;
  private lastBarcode = '';
  private cartBySale = new Map<number, CartItem[]>();
  private paymentsBySale = new Map<number, PaymentEntry[]>();
  private paymentDrafts = new Map<string, PaymentEntry>();
  private storageListener?: (event: StorageEvent) => void;
  private tabId = '';
  private draftKeyMap = new Map<string, number>();
  private beforeUnloadListener?: () => void;
  private suppressDraftSync = false;
  private tabHeartbeatId?: number;
  private readonly tabHeartbeatMs = 5000;
  private readonly tabStaleMs = 60000;
  private readonly checkoutLockMs = 15000;
  private quantityTimers = new Map<string, number>();
  private quantityErrors = new Map<string, string>();
  private quantityPending = new Map<string, number>();
  private stockByProductId = new Map<number, number>();

  novoPagamento = {
    metodo: 2,
    valor: 0,
    ref: ''
  };

  ngAfterViewInit(): void {
    setTimeout(() => this.focusSearch(), 0);
  }

  ngOnInit(): void {
    this.lojaId = Number(this.route.snapshot.paramMap.get('id')) || 0;
    if (!this.lojaId) {
      this.router.navigate(['/minhas-lojas']);
      return;
    }

    this.registerTab();
    this.loadDraftState();
    this.loadSaleState();
    this.startTabHeartbeat();
    this.storageListener = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key === this.draftStorageKey()) {
        this.loadDraftState();
        return;
      }
      if (event.key === this.saleStateKey()) {
        this.loadSaleState();
        return;
      }
      if (event.key.startsWith(this.saleClosedPrefix())) {
        this.handleSaleClosedKey(event.key);
        return;
      }
      if (event.key === this.salesSyncKey()) {
        this.carregarAbertas();
      }
    };
    window.addEventListener('storage', this.storageListener);
    this.beforeUnloadListener = () => {
      this.handleTabClose(false);
    };
    window.addEventListener('beforeunload', this.beforeUnloadListener);

    this.usuarioService.loja(this.lojaId).subscribe({
      next: loja => this.loja = loja,
      error: () => this.loja = null,
    });

    this.cancelarSeMarcado();
    this.carregarAbertas();
  }

  ngOnDestroy(): void {
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
    }
    if (this.beforeUnloadListener) {
      window.removeEventListener('beforeunload', this.beforeUnloadListener);
    }
    this.stopTabHeartbeat();
    this.handleTabClose(true);
  }

  get queueEntries(): { kind: 'sale' | 'draft'; id: number | string; createdAt: Date }[] {
    const sales = this.openSales.map(s => ({ kind: 'sale' as const, id: s.id, createdAt: new Date(s.createdAt) }));
    const drafts = this.draftSales.map((d: DraftSale) => ({ kind: 'draft' as const, id: d.id, createdAt: d.createdAt }));
    return [...sales, ...drafts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  isEntryActive(entry: { kind: 'sale' | 'draft'; id: number | string }): boolean {
    if (entry.kind === 'sale') return this.currentSale?.id === entry.id;
    return this.currentDraftId === entry.id;
  }

  selectEntry(entry: { kind: 'sale' | 'draft'; id: number | string }): void {
    if (entry.kind === 'sale') {
      const sale = this.openSales.find(s => s.id === entry.id);
      if (sale) this.selectSale(sale);
      return;
    }
    this.selectDraft(String(entry.id));
  }

  get currentItems(): CartItem[] {
    if (this.currentSale) {
      return this.cartBySale.get(this.currentSale.id) ?? [];
    }
    if (this.currentDraftId) {
      return this.cartBySale.get(this.toDraftKey(this.currentDraftId)) ?? [];
    }
    return [];
  }

  get currentPayments(): PaymentEntry[] {
    if (this.currentSale) {
      return this.paymentsBySale.get(this.currentSale.id) ?? [];
    }
    if (this.currentDraftId) {
      return this.paymentsBySale.get(this.toDraftKey(this.currentDraftId)) ?? [];
    }
    return [];
  }

  get subtotalValue(): number {
    if (this.currentSale) return this.currentSale.subtotal ?? 0;
    return this.currentItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }

  get discountValue(): number {
    if (this.currentSale) return Math.abs(this.currentSale.discountValue ?? 0);
    const percent = Number(this.discountPercent ?? 0);
    return Math.abs(this.subtotalValue * (percent / 100));
  }

  get totalValue(): number {
    if (this.currentSale) return this.currentSale.total ?? 0;
    const percent = Number(this.discountPercent ?? 0);
    return this.subtotalValue - (this.subtotalValue * (percent / 100));
  }

  get valorPagoVirtual(): number {
    return this.currentPayments
      .filter(p => p.method !== 1)
      .reduce((sum, p) => sum + p.amount, 0);
  }

  get valorRestanteVirtual(): number {
    const total = this.totalValue;
    return Math.max(total - this.valorPagoVirtual, 0);
  }

  get trocoValue(): number {
    const recebido = Number(this.cashReceived ?? 0);
    if (!Number.isFinite(recebido) || recebido <= 0) return 0;
    return Math.max(recebido - this.valorRestanteVirtual, 0);
  }

  get hasQuantityErrors(): boolean {
    return this.quantityErrors.size > 0;
  }

  setTipoFiltro(tipo: 'ALL' | 'PRODUTO' | 'SERVICO'): void {
    this.tipoFiltro = tipo;
    this.onBuscarChange();
  }

  onBuscarChange(): void {
    clearTimeout(this.buscaTimer);
    if (!this.filtro?.trim()) {
      this.resultados = [];
      return;
    }

    this.buscaTimer = setTimeout(() => this.buscarItens(), 250);
  }

  buscarItens(): void {
    this.buscando = true;
    const tipo = this.tipoFiltro === 'ALL' ? null : this.tipoFiltro;

    this.itensService.listar(this.filtro, tipo, true, 1, 20).subscribe({
      next: res => {
        this.resultados = res?.items ?? [];
        this.cacheStocks(this.resultados);
        this.buscando = false;
        this.tryAutoAddBarcode();
      },
      error: err => {
        console.error('[PDV] erro ao buscar itens', err);
        this.resultados = [];
        this.buscando = false;
      }
    });
  }

  adicionarPrimeiroResultado(): void {
    if (this.resultados.length === 1) {
      this.adicionarItem(this.resultados[0]);
    }
  }

  startNewSale(): void {
    this.startNewDraft();
  }

  private iniciarVenda(startNew: boolean, pendingItem?: ItemVendavelDto, fromBarcode: boolean = false): void {
    this.pdvService.start(!!startNew).subscribe({
      next: sale => {
        this.replaceDraftWithSale(sale);
        this.setCurrentSale(sale);
        this.upsertOpenSale(sale);
        this.notifySalesChanged();
        if (pendingItem) {
          this.adicionarItem(pendingItem, fromBarcode);
          return;
        }
        this.focusSearch();
      },
      error: err => console.error('[PDV] erro ao iniciar venda', err)
    });
  }

  private replaceDraftWithSale(sale: SaleSummaryDto): void {
    if (this.currentDraftId) {
      this.draftSales = this.draftSales.filter((d: DraftSale) => d.id !== this.currentDraftId);
      this.currentDraftId = null;
      this.persistDraftState();
    }
  }

  private carregarAbertas(): void {
    this.pdvService.listOpen().subscribe({
      next: list => {
        this.openSales = this.sortSalesByCreated(list ?? []);
        if (this.currentSale) {
          const stillOpen = this.openSales.find(s => s.id === this.currentSale?.id);
          if (stillOpen) {
            this.setCurrentSale(stillOpen);
            return;
          }
          this.currentSale = null;
        }
        if (this.currentDraftId) {
          this.applyDraftToView();
          return;
        }
        if (this.openSales.length) {
          this.selectSale(this.openSales[0]);
          return;
        }
        this.ensureDraft();
      },
      error: err => console.error('[PDV] erro ao listar vendas abertas', err)
    });
  }

  selectSale(sale: SaleSummaryDto): void {
    this.currentDraftId = null;
    this.setCurrentSale(sale);
    this.persistDraftState();
  }

  selectDraft(id: string): void {
    this.currentSale = null;
    this.currentDraftId = id;
    this.persistDraftState();
    this.applyDraftToView();
  }

  private ensureDraft(): void {
    if (this.draftSales.length) {
      this.currentDraftId = this.draftSales[0].id;
      this.persistDraftState();
      this.applyDraftToView();
      return;
    }
    this.startNewDraft();
  }

  private startNewDraft(): void {
    const draft: DraftSale = { id: this.newDraftId(), createdAt: new Date() };
    this.draftSales.push(draft);
    this.currentDraftId = draft.id;
    this.persistDraftState();
    this.applyDraftToView();
  }

  private setCurrentSale(sale: SaleSummaryDto): void {
    this.currentSale = sale;
    this.discountPercent = sale.discountPercent ?? 0;
    this.cashReceived = null;
    if (!this.cartBySale.has(sale.id)) {
      this.cartBySale.set(sale.id, []);
    }
    if (!this.paymentsBySale.has(sale.id)) {
      this.paymentsBySale.set(sale.id, []);
    }
  }

  private isDraftActive(): boolean {
    return !this.currentSale && !!this.currentDraftId;
  }

  estoqueDisponivel(item: ItemVendavelDto): number {
    if (item.tipo !== 'PRODUTO') return 0;
    return this.getAvailableStock(item.id, item.estoque);
  }

  quantityError(item: CartItem): string | null {
    return this.quantityErrors.get(item.key) ?? null;
  }

  adicionarItem(item: ItemVendavelDto, fromBarcode: boolean = false): void {
    if (!this.currentSale) {
      this.iniciarVenda(true, item, fromBarcode);
      return;
    }

    const qty = Math.max(1, Number(this.quantidadePadrao || 1));

    if (item.tipo === 'PRODUTO' && item.estoque != null) {
      const disponivel = this.getAvailableStock(item.id, item.estoque);
      if (qty > disponivel) {
        return;
      }
    }

    const payload = {
      saleId: this.currentSale.id,
      produtoId: item.id,
      tipo: String(item.tipo).toUpperCase(),
      nome: item.nome,
      codigoBarra: null,
      unitPrice: Number(item.precoVenda ?? 0),
      quantity: qty,
    };

    this.pdvService.addItem(this.currentSale.id, payload).subscribe({
      next: sale => {
        this.upsertOpenSale(sale);
        this.setCurrentSale(sale);
        this.mergeItem(item, qty);
        this.applyStockDelta(item.id, qty);
        this.quantidadePadrao = 1;
        if (fromBarcode) {
          this.resetSearch();
        }
        this.focusSearch();
      },
        error: err => {
          console.error('[PDV] erro ao adicionar item', err);
          if (fromBarcode) {
            this.lastBarcode = '';
          }
          const msg = String(err?.error?.message ?? '');
          if (msg.toLowerCase().includes('estoque')) {
            return;
          }
          alert(err?.error?.message ?? 'Nao foi possivel adicionar o item.');
        }
      });
    }

  private mergeItem(item: ItemVendavelDto, qty: number): void {
    if (!this.currentSale) return;

    const cart = this.cartBySale.get(this.currentSale.id) ?? [];
    const tipoKey = String(item.tipo).toUpperCase();
    const key = `${tipoKey}:${item.id}`;
    const existing = cart.find(x => x.key === key);

    if (existing) {
      existing.quantity += qty;
    } else {
      cart.push({
        key,
        produtoId: item.id,
        tipo: (String(item.tipo).toUpperCase() === 'SERVICO' ? 'SERVICO' : 'PRODUTO'),
        nome: item.nome,
        codigoBarra: null,
        unitPrice: Number(item.precoVenda ?? 0),
        quantity: qty,
        estoque: item.estoque ?? null,
      });
    }

    this.cartBySale.set(this.currentSale.id, [...cart]);
    this.persistSaleState();
  }

  aplicarDesconto(): void {
    if (!this.currentSale) return;

    const percent = Number(this.discountPercent ?? 0);
    this.pdvService.setDiscount(this.currentSale.id, percent).subscribe({
      next: sale => {
        this.upsertOpenSale(sale);
        this.setCurrentSale(sale);
      },
      error: err => {
        console.error('[PDV] erro ao aplicar desconto', err);
        alert(err?.error?.message ?? 'Nao foi possivel aplicar o desconto.');
      }
    });
  }

  aplicarDescontoRascunho(): void {
    if (!this.currentDraftId) return;
    this.setDraftDiscount(this.currentDraftId, Number(this.discountPercent ?? 0));
    this.persistDraftState();
    this.applyDraftToView();
  }

  adicionarPagamento(): void {
    if (this.currentDraftId) {
      const amountDraft = Number(this.novoPagamento.valor ?? 0);
      if (amountDraft <= 0) return;
      const entryDraft: PaymentEntry = {
        id: this.newPaymentId(),
        method: Number(this.novoPagamento.metodo),
        amount: amountDraft,
        refCode: this.novoPagamento.ref || null,
        editing: false,
      };
      const keyDraft = this.toDraftKey(this.currentDraftId);
      const listDraft = (this.paymentsBySale.get(keyDraft) ?? []).slice();
      listDraft.push(entryDraft);
      this.paymentsBySale.set(keyDraft, listDraft);
      this.novoPagamento = { metodo: 2, valor: 0, ref: '' };
      this.persistDraftState();
      this.applyDraftToView();
      return;
    }

    if (!this.currentSale) return;

    const amount = Number(this.novoPagamento.valor ?? 0);
    if (amount <= 0) return;

    const entry: PaymentEntry = {
      id: this.newPaymentId(),
      method: Number(this.novoPagamento.metodo),
      amount,
      refCode: this.novoPagamento.ref || null,
      editing: false,
    };

    const list = this.currentPayments.slice();
    list.push(entry);
    this.paymentsBySale.set(this.currentSale.id, list);
    this.novoPagamento = { metodo: 2, valor: 0, ref: '' };
    this.persistSaleState();
  }

  async finalizarVenda(): Promise<void> {
    if (!this.currentSale) return;
    if (!this.tryAcquireCheckoutLock(this.currentSale.id)) {
      alert('Outra aba esta finalizando esta venda. Aguarde a sincronizacao.');
      return;
    }
    if (this.currentPayments.some(p => p.editing)) {
      alert('Finalize ou cancele a edi\u00e7\u00e3o dos pagamentos antes de concluir.');
      this.releaseCheckoutLock(this.currentSale.id);
      return;
    }
    try {
      await this.enviarPagamentosAntesDoCheckout();
    } catch (err: any) {
      console.error('[PDV] erro ao registrar pagamentos', err);
      alert(err?.error?.message ?? 'Nao foi possivel registrar pagamentos.');
      this.releaseCheckoutLock(this.currentSale.id);
      return;
    }

    this.pdvService.checkout(this.currentSale.id).subscribe({
      next: sale => {
        this.removeSale(sale.id);
        this.markSaleClosed(sale.id);
        this.releaseCheckoutLock(sale.id);
        this.ensureSaleOpen();
        this.notifySalesChanged();
      },
      error: err => {
        console.error('[PDV] erro ao finalizar venda', err);
        alert(err?.error?.message ?? 'Nao foi possivel finalizar a venda.');
        this.releaseCheckoutLock(this.currentSale?.id ?? 0);
      }
    });
  }

  private async enviarPagamentosAntesDoCheckout(): Promise<void> {
    if (!this.currentSale) return;
    const payments = this.currentPayments;
    const sentMethods = new Set<number>();
    for (const p of payments) {
      if (!p.amount || p.amount <= 0) continue;
      if (p.method === 1) {
        sentMethods.add(1);
        continue;
      }
      await firstValueFrom(this.pdvService.addPayment(this.currentSale.id, {
        saleId: this.currentSale.id,
        method: p.method,
        amount: p.amount,
        refCode: p.refCode ?? null,
      }));
    }

    const restante = this.valorRestanteVirtual;
    if (restante > 0 && !sentMethods.has(1)) {
      await firstValueFrom(this.pdvService.addPayment(this.currentSale.id, {
        saleId: this.currentSale.id,
        method: 1,
        amount: restante,
        refCode: null,
      }));
    }
  }

  cancelarVenda(): void {
    if (!this.currentSale) return;
    if (!confirm('Cancelar esta venda?')) return;

    const saleId = this.currentSale.id;
    this.pdvService.cancel(saleId).subscribe({
      next: () => {
        this.removeSale(saleId);
        this.ensureSaleOpen();
        this.notifySalesChanged();
      },
      error: err => {
        console.error('[PDV] erro ao cancelar venda', err);
        alert(err?.error?.message ?? 'Nao foi possivel cancelar a venda.');
      }
    });
  }

  private removeSale(saleId: number): void {
    this.openSales = this.openSales.filter(x => x.id !== saleId);
    this.cartBySale.delete(saleId);
    this.paymentsBySale.delete(saleId);
    if (this.currentSale?.id === saleId) {
      this.currentSale = null;
    }
    this.removeSaleState(saleId);
  }

  private upsertOpenSale(sale: SaleSummaryDto): void {
    const idx = this.openSales.findIndex(x => x.id === sale.id);
    if (idx >= 0) {
      this.openSales = this.sortSalesByCreated(
        this.openSales.map(x => (x.id === sale.id ? sale : x))
      );
      return;
    }
    this.openSales = this.sortSalesByCreated([...this.openSales, sale]);
  }

  editarPagamento(p: PaymentEntry): void {
    this.paymentDrafts.set(p.id, { ...p });
    p.editing = true;
    if (this.currentDraftId) {
      this.persistDraftState();
    } else {
      this.persistSaleState();
    }
  }

  salvarPagamento(p: PaymentEntry): void {
    if (!p.amount || p.amount <= 0) {
      alert('Informe um valor maior que zero.');
      return;
    }
    p.editing = false;
    this.paymentDrafts.delete(p.id);
    if (this.currentDraftId) {
      this.persistDraftState();
      this.applyDraftToView();
    } else {
      this.persistSaleState();
    }
  }

  cancelarEdicaoPagamento(p: PaymentEntry): void {
    const draft = this.paymentDrafts.get(p.id);
    if (draft) {
      p.method = draft.method;
      p.amount = draft.amount;
      p.refCode = draft.refCode;
    }
    p.editing = false;
    this.paymentDrafts.delete(p.id);
    if (this.currentDraftId) {
      this.persistDraftState();
      this.applyDraftToView();
    } else {
      this.persistSaleState();
    }
  }

  removerPagamento(p: PaymentEntry): void {
    if (this.currentDraftId) {
      const keyDraft = this.toDraftKey(this.currentDraftId);
      const listDraft = (this.paymentsBySale.get(keyDraft) ?? []).filter(x => x.id !== p.id);
      this.paymentsBySale.set(keyDraft, listDraft);
      this.paymentDrafts.delete(p.id);
      this.persistDraftState();
      this.applyDraftToView();
      return;
    }

    const list = this.currentPayments.filter(x => x.id !== p.id);
    if (!this.currentSale) return;
    this.paymentsBySale.set(this.currentSale.id, list);
    this.paymentDrafts.delete(p.id);
    this.persistSaleState();
  }

  private ensureSaleOpen(): void {
    if (this.openSales.length) {
      this.setCurrentSale(this.openSales[0]);
      return;
    }
    this.ensureDraft();
  }

  private newPaymentId(): string {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private newDraftId(): string {
    return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private draftStorageKey(): string {
    return `pdv_drafts_${this.lojaId}`;
  }

  private saleStateKey(): string {
    return `pdv_sales_state_${this.lojaId}`;
  }

  private salesSyncKey(): string {
    return `pdv_sales_${this.lojaId}`;
  }

  private saleClosedPrefix(): string {
    return `pdv_sale_closed_${this.lojaId}_`;
  }

  private saleClosedKey(saleId: number): string {
    return `${this.saleClosedPrefix()}${saleId}`;
  }

  private checkoutLockKey(saleId: number): string {
    return `pdv_checkout_lock_${this.lojaId}_${saleId}`;
  }

  private notifySalesChanged(): void {
    localStorage.setItem(this.salesSyncKey(), String(Date.now()));
  }

  private tabStorageKey(): string {
    return `pdv_tabs_${this.lojaId}`;
  }

  private registerTab(): void {
    const existing = sessionStorage.getItem('pdv_tab_id');
    this.tabId = existing || `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem('pdv_tab_id', this.tabId);
    const now = Date.now();
    const rawTabs = this.getTabsMap();
    const cleaned = this.pruneTabsMap(rawTabs, now);
    const hadActiveTabs = Object.keys(cleaned).length > 0;
    const hadStaleTabs = Object.keys(rawTabs).length > 0 && !hadActiveTabs;

    if (!hadActiveTabs) {
      this.draftSales = [];
      this.currentDraftId = null;
      localStorage.removeItem(this.draftStorageKey());
    }
    if (hadStaleTabs) {
      localStorage.setItem(this.cancelFlagKey(), String(now));
    }

    cleaned[this.tabId] = now;
    this.setTabsMap(cleaned);
  }

  private unregisterTab(): void {
    const now = Date.now();
    const tabs = this.pruneTabsMap(this.getTabsMap(), now);
    delete tabs[this.tabId];
    this.setTabsMap(tabs);
  }

  private getTabsMap(): Record<string, number> {
    const raw = localStorage.getItem(this.tabStorageKey());
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return {};
      const result: Record<string, number> = {};
      for (const [id, ts] of Object.entries(parsed)) {
        const value = Number(ts);
        if (Number.isFinite(value)) {
          result[String(id)] = value;
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  private setTabsMap(tabs: Record<string, number>): void {
    const keys = Object.keys(tabs);
    if (!keys.length) {
      localStorage.removeItem(this.tabStorageKey());
      return;
    }
    localStorage.setItem(this.tabStorageKey(), JSON.stringify(tabs));
  }

  private pruneTabsMap(tabs: Record<string, number>, now: number): Record<string, number> {
    const cleaned: Record<string, number> = {};
    for (const [id, ts] of Object.entries(tabs)) {
      const value = Number(ts);
      if (!Number.isFinite(value)) continue;
      if (now - value <= this.tabStaleMs) {
        cleaned[id] = value;
      }
    }
    return cleaned;
  }

  private startTabHeartbeat(): void {
    this.touchTab();
    this.tabHeartbeatId = window.setInterval(() => this.touchTab(), this.tabHeartbeatMs);
  }

  private stopTabHeartbeat(): void {
    if (this.tabHeartbeatId) {
      clearInterval(this.tabHeartbeatId);
      this.tabHeartbeatId = undefined;
    }
  }

  private touchTab(): void {
    if (!this.tabId) return;
    const now = Date.now();
    const tabs = this.pruneTabsMap(this.getTabsMap(), now);
    tabs[this.tabId] = now;
    this.setTabsMap(tabs);
  }

  private isLastTab(): boolean {
    const now = Date.now();
    const tabs = this.pruneTabsMap(this.getTabsMap(), now);
    const ids = Object.keys(tabs);
    if (ids.length === 0) return true;
    return ids.length === 1 && ids[0] === this.tabId;
  }

  private handleTabClose(canCancel: boolean): void {
    const now = Date.now();
    const tabs = this.pruneTabsMap(this.getTabsMap(), now);
    delete tabs[this.tabId];
    if (Object.keys(tabs).length === 0) {
      localStorage.removeItem(this.tabStorageKey());
      localStorage.removeItem(this.draftStorageKey());
      this.draftSales = [];
      this.currentDraftId = null;
      localStorage.setItem(this.cancelFlagKey(), String(Date.now()));
      if (canCancel) {
        this.cancelarVendasAbertas();
      }
      return;
    }
    this.setTabsMap(tabs);
  }

  private cancelFlagKey(): string {
    return `pdv_cancel_on_next_${this.lojaId}`;
  }

  private cancelarSeMarcado(): void {
    const flag = localStorage.getItem(this.cancelFlagKey());
    if (!flag) return;
    localStorage.removeItem(this.cancelFlagKey());
    this.clearLocalSalesState();
    this.pdvService.listOpen().subscribe({
      next: list => {
        const calls = (list ?? []).map(s => this.pdvService.cancel(s.id));
        if (calls.length === 0) return;
        forkJoin(calls).subscribe({
          next: () => {
            this.clearLocalSalesState();
            this.notifySalesChanged();
          },
          error: err => console.error('[PDV] erro ao cancelar vendas pendentes', err),
        });
      },
      error: err => console.error('[PDV] erro ao checar vendas pendentes', err),
    });
  }

  private persistDraftState(): void {
    if (this.suppressDraftSync) return;
    const payload = {
      drafts: this.draftSales.map(d => ({ id: d.id, createdAt: d.createdAt.toISOString() })),
      currentDraftId: this.currentDraftId,
      itemsByDraft: this.buildDraftItemsMap(),
      paymentsByDraft: this.buildDraftPaymentsMap(),
      discountsByDraft: this.buildDraftDiscountsMap(),
    };
    localStorage.setItem(this.draftStorageKey(), JSON.stringify(payload));
  }

  private persistSaleState(): void {
    const payload = {
      itemsBySale: this.buildSaleItemsMap(),
      paymentsBySale: this.buildSalePaymentsMap(),
    };
    localStorage.setItem(this.saleStateKey(), JSON.stringify(payload));
  }

  private loadDraftState(): void {
    const raw = localStorage.getItem(this.draftStorageKey());
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const drafts = Array.isArray(parsed?.drafts) ? parsed.drafts : [];
      this.draftSales = drafts.map((d: any) => ({
        id: String(d.id),
        createdAt: new Date(d.createdAt),
      }));
      this.currentDraftId = parsed?.currentDraftId ? String(parsed.currentDraftId) : null;
      this.restoreDraftMaps(parsed);
      this.applyDraftToView();
    } catch {
      this.draftSales = [];
      this.currentDraftId = null;
    }
  }

  private loadSaleState(): void {
    const raw = localStorage.getItem(this.saleStateKey());
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      this.restoreSaleMaps(parsed);
    } catch {
      return;
    }
  }

  private buildDraftItemsMap(): Record<string, CartItem[]> {
    const map: Record<string, CartItem[]> = {};
    for (const draft of this.draftSales) {
      const items = this.cartBySale.get(this.toDraftKey(draft.id)) ?? [];
      map[draft.id] = items;
    }
    return map;
  }

  private buildSaleItemsMap(): Record<string, CartItem[]> {
    const map: Record<string, CartItem[]> = {};
    for (const sale of this.openSales) {
      const items = this.cartBySale.get(sale.id) ?? [];
      map[String(sale.id)] = items;
    }
    return map;
  }

  private buildDraftPaymentsMap(): Record<string, PaymentEntry[]> {
    const map: Record<string, PaymentEntry[]> = {};
    for (const draft of this.draftSales) {
      const items = this.paymentsBySale.get(this.toDraftKey(draft.id)) ?? [];
      map[draft.id] = items;
    }
    return map;
  }

  private buildSalePaymentsMap(): Record<string, PaymentEntry[]> {
    const map: Record<string, PaymentEntry[]> = {};
    for (const sale of this.openSales) {
      const items = this.paymentsBySale.get(sale.id) ?? [];
      map[String(sale.id)] = items;
    }
    return map;
  }

  private buildDraftDiscountsMap(): Record<string, number> {
    const map: Record<string, number> = {};
    for (const draft of this.draftSales) {
      map[draft.id] = this.getDraftDiscount(draft.id);
    }
    return map;
  }

  private restoreDraftMaps(parsed: any): void {
    const itemsByDraft = parsed?.itemsByDraft ?? {};
    const paymentsByDraft = parsed?.paymentsByDraft ?? {};
    const discountsByDraft = parsed?.discountsByDraft ?? {};

    for (const draft of this.draftSales) {
      const items = Array.isArray(itemsByDraft[draft.id]) ? itemsByDraft[draft.id] : [];
      const payments = Array.isArray(paymentsByDraft[draft.id]) ? paymentsByDraft[draft.id] : [];
      const discount = Number(discountsByDraft[draft.id] ?? 0);

      this.cartBySale.set(this.toDraftKey(draft.id), items);
      this.paymentsBySale.set(this.toDraftKey(draft.id), payments);
      this.setDraftDiscount(draft.id, discount);
    }
  }

  private restoreSaleMaps(parsed: any): void {
    const itemsBySale = parsed?.itemsBySale ?? {};
    const paymentsBySale = parsed?.paymentsBySale ?? {};
    const saleIds = Object.keys(itemsBySale);
    for (const id of saleIds) {
      const saleId = Number(id);
      if (!Number.isFinite(saleId) || saleId <= 0) continue;
      const items = Array.isArray(itemsBySale[id]) ? itemsBySale[id] : [];
      this.cartBySale.set(saleId, items);
    }
    const paymentIds = Object.keys(paymentsBySale);
    for (const id of paymentIds) {
      const saleId = Number(id);
      if (!Number.isFinite(saleId) || saleId <= 0) continue;
      const payments = Array.isArray(paymentsBySale[id]) ? paymentsBySale[id] : [];
      this.paymentsBySale.set(saleId, payments);
    }
  }

  private removeSaleState(saleId: number): void {
    const raw = localStorage.getItem(this.saleStateKey());
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.itemsBySale) delete parsed.itemsBySale[String(saleId)];
      if (parsed?.paymentsBySale) delete parsed.paymentsBySale[String(saleId)];
      localStorage.setItem(this.saleStateKey(), JSON.stringify(parsed));
    } catch {
      return;
    }
  }

  private tryAcquireCheckoutLock(saleId: number): boolean {
    if (!saleId) return false;
    const key = this.checkoutLockKey(saleId);
    const now = Date.now();
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const ts = Number(parsed?.ts ?? 0);
        if (Number.isFinite(ts) && now - ts < this.checkoutLockMs) {
          return false;
        }
      } catch {
        // ignore malformed lock
      }
    }
    localStorage.setItem(key, JSON.stringify({ tabId: this.tabId, ts: now }));
    return true;
  }

  private releaseCheckoutLock(saleId: number): void {
    if (!saleId) return;
    localStorage.removeItem(this.checkoutLockKey(saleId));
  }

  private markSaleClosed(saleId: number): void {
    localStorage.setItem(this.saleClosedKey(saleId), String(Date.now()));
  }

  private handleSaleClosedKey(key: string): void {
    const prefix = this.saleClosedPrefix();
    if (!key.startsWith(prefix)) return;
    const saleId = Number(key.slice(prefix.length));
    if (!Number.isFinite(saleId)) return;
    this.removeSale(saleId);
    this.releaseCheckoutLock(saleId);
    this.carregarAbertas();
  }

  private getDraftDiscount(draftId: string): number {
    const key = this.toDraftDiscountKey(draftId);
    const value = (this as any)[key];
    return Number.isFinite(value) ? Number(value) : 0;
  }

  private setDraftDiscount(draftId: string, value: number): void {
    const key = this.toDraftDiscountKey(draftId);
    (this as any)[key] = value;
  }

  private toDraftKey(draftId: string): number {
    return this.draftKeyMap.get(draftId) ?? this.createDraftKey(draftId);
  }

  private toDraftDiscountKey(draftId: string): string {
    return `draft_discount_${draftId}`;
  }

  private createDraftKey(draftId: string): number {
    const key = -Math.abs(this.hashDraftId(draftId));
    this.draftKeyMap.set(draftId, key);
    return key;
  }

  private hashDraftId(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) || 1;
  }

  private applyDraftToView(): void {
    if (!this.currentDraftId) return;
    const draftKey = this.toDraftKey(this.currentDraftId);
    const items = this.cartBySale.get(draftKey) ?? [];
    const payments = this.paymentsBySale.get(draftKey) ?? [];
    this.discountPercent = this.getDraftDiscount(this.currentDraftId);
    this.cashReceived = null;
    this.cartBySale.set(draftKey, items);
    this.paymentsBySale.set(draftKey, payments);
  }

  private addItemToDraft(item: ItemVendavelDto, fromBarcode: boolean): void {
    if (!this.currentDraftId) return;

    const qty = Math.max(1, Number(this.quantidadePadrao || 1));
    const key = this.toDraftKey(this.currentDraftId);
    const cart = this.cartBySale.get(key) ?? [];
    const tipoKey = String(item.tipo).toUpperCase();
    const cartKey = `${tipoKey}:${item.id}`;
    const existing = cart.find(x => x.key === cartKey);

      if (item.tipo === 'PRODUTO' && item.estoque != null) {
        const jaNoCarrinho = existing?.quantity ?? 0;
        if (jaNoCarrinho + qty > item.estoque) {
          return;
        }
      }

    if (existing) {
      existing.quantity += qty;
    } else {
      cart.push({
        key: cartKey,
        produtoId: item.id,
        tipo: (String(item.tipo).toUpperCase() === 'SERVICO' ? 'SERVICO' : 'PRODUTO'),
        nome: item.nome,
        codigoBarra: null,
        unitPrice: Number(item.precoVenda ?? 0),
        quantity: qty,
        estoque: item.estoque ?? null,
      });
    }

    this.cartBySale.set(key, [...cart]);
    this.quantidadePadrao = 1;
    if (fromBarcode) {
      this.resetSearch();
    }
    this.persistDraftState();
    this.applyDraftToView();
  }

  private focusSearch(): void {
    const el = this.searchInput?.nativeElement;
    if (el) {
      el.focus();
      el.select();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onPdvShortcut(event: KeyboardEvent): void {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const key = event.key.toLowerCase();
    if (key === 'b') {
      event.preventDefault();
      this.focusNextPdvField(1);
    }
    if (key === 'n') {
      event.preventDefault();
      this.focusNextPdvField(-1);
    }
    if (key === 'r') {
      event.preventDefault();
      this.focusSummaryField(1);
    }
  }

  private focusNextPdvField(direction: 1 | -1): void {
    const root = this.host?.nativeElement;
    if (!root) return;

    const fields: HTMLElement[] = [];
    const search = root.querySelector('.pdv-focus-search') as HTMLElement | null;
    if (search) fields.push(search);
    fields.push(...Array.from(root.querySelectorAll('.pdv-focus-cart')) as HTMLElement[]);
    fields.push(...Array.from(root.querySelectorAll('.pdv-focus-summary')) as HTMLElement[]);

    const focusables = fields.filter(el => {
      const input = el as HTMLInputElement;
      if ((input as any).disabled) return false;
      if ((input as any).readOnly) return false;
      return true;
    });

    if (focusables.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const idx = active ? focusables.indexOf(active) : -1;
    const size = focusables.length;
    const offset = direction === 1 ? 1 : size - 1;
    const next = focusables[(idx + offset) % size];
    next.focus();
    if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) {
      next.select();
    }
  }

  private focusSummaryField(direction: 1 | -1): void {
    const root = this.host?.nativeElement;
    if (!root) return;

    const fields = Array.from(root.querySelectorAll('.pdv-focus-summary')) as HTMLElement[];
    const focusables = fields.filter(el => {
      const input = el as HTMLInputElement;
      if ((input as any).disabled) return false;
      if ((input as any).readOnly) return false;
      return true;
    });

    if (focusables.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const idx = active ? focusables.indexOf(active) : -1;
    const size = focusables.length;
    const offset = direction === 1 ? 1 : size - 1;
    const next = focusables[(idx + offset) % size];
    next.focus();
    if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) {
      next.select();
    }
  }

  private resetSearch(): void {
    this.filtro = '';
    this.resultados = [];
    this.buscando = false;
    this.lastBarcode = '';
  }

  private isBarcodeLike(value: string): boolean {
    const trimmed = (value || '').trim();
    if (trimmed.length < 6) return false;
    return /^[0-9]+$/.test(trimmed);
  }

  private tryAutoAddBarcode(): void {
    if (!this.isBarcodeLike(this.filtro)) return;
    const trimmed = this.filtro.trim();
    if (trimmed === this.lastBarcode) return;
    if (this.resultados.length !== 1) return;
    this.lastBarcode = trimmed;
    this.adicionarItem(this.resultados[0], true);
  }

  queueIndex(entry: { id: number | string } | number | string): number {
    const id = typeof entry === 'object' ? entry.id : entry;
    return this.queueEntries.findIndex(e => e.id === id) + 1;
  }

  private sortSalesByCreated(list: SaleSummaryDto[]): SaleSummaryDto[] {
    return [...list].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime() || 0;
      const tb = new Date(b.createdAt).getTime() || 0;
      return ta - tb;
    });
  }

  private cancelarVendasAbertas(): void {
    if (!this.openSales.length) return;
    const calls = this.openSales.map(s => this.pdvService.cancel(s.id));
    forkJoin(calls).subscribe({
      next: () => undefined,
      error: err => console.error('[PDV] erro ao cancelar vendas abertas', err),
    });
  }

  alterarQuantidade(item: CartItem, delta: number): void {
    this.clearQuantityError(item);
    const alvo = (item.quantity ?? 0) + delta;
    this.aplicarQuantidade(item, alvo);
  }

  alterarQuantidadeDireta(item: CartItem, value: number | string, inputEl?: HTMLInputElement): void {
    if (value === '' || value === null || value === undefined) {
      this.setQuantityError(item, 'Quantidade obrigatoria.');
      return;
    }
    const alvo = Number(value);
    if (!Number.isFinite(alvo)) {
      this.setQuantityError(item, 'Quantidade invalida.');
      return;
    }
    if (alvo < 0) {
      this.setQuantityError(item, 'Quantidade invalida.');
      return;
    }
    this.clearQuantityError(item);
    const clamped = this.clampQuantityByStock(item, alvo);
    if (inputEl && Number.isFinite(clamped) && clamped !== alvo) {
      inputEl.value = String(clamped);
    }
    this.scheduleQuantityApply(item, clamped);
  }

  onQuantidadeBlur(item: CartItem): void {
    if (this.quantityErrors.has(item.key)) {
      return;
    }
    const timer = this.quantityTimers.get(item.key);
    if (timer) {
      clearTimeout(timer);
      this.quantityTimers.delete(item.key);
      const pending = this.quantityPending.get(item.key);
      if (pending != null) {
        this.aplicarQuantidade(item, pending);
      }
    }
  }

  removerItem(item: CartItem): void {
    this.clearQuantityError(item);
    this.aplicarQuantidade(item, 0);
  }

  private aplicarQuantidade(item: CartItem, novaQuantidade: number): void {
    if (!Number.isFinite(novaQuantidade)) return;

    if (item.tipo === 'PRODUTO' && item.estoque != null) {
      novaQuantidade = this.clampQuantityByStock(item, novaQuantidade);
    }

    if (!this.currentSale && this.currentDraftId) {
      this.aplicarQuantidadeDraft(item, novaQuantidade);
      return;
    }

    if (!this.currentSale) return;

    if (novaQuantidade < 0) return;

    const delta = novaQuantidade - item.quantity;
    if (delta === 0) return;

    const saleId = this.currentSale.id;
    this.pdvService.addItem(saleId, {
      saleId,
      produtoId: item.produtoId,
      tipo: item.tipo,
      nome: item.nome,
      codigoBarra: item.codigoBarra ?? null,
      unitPrice: item.unitPrice,
      quantity: delta,
    }).subscribe({
      next: sale => {
        this.upsertOpenSale(sale);
        this.setCurrentSale(sale);
        if (novaQuantidade <= 0) {
          const cart = (this.cartBySale.get(saleId) ?? []).filter(x => x.key !== item.key);
          this.cartBySale.set(saleId, cart);
        } else {
          item.quantity = novaQuantidade;
        }
        if (item.tipo === 'PRODUTO') {
          this.applyStockDelta(item.produtoId, delta);
        }
        this.persistSaleState();
      },
      error: err => {
        console.error('[PDV] erro ao atualizar quantidade', err);
        alert(err?.error?.message ?? 'Nao foi possivel atualizar a quantidade.');
      }
    });
  }

  private scheduleQuantityApply(item: CartItem, value: number): void {
    const key = item.key;
    this.quantityPending.set(key, value);
    if (this.quantityTimers.has(key)) {
      clearTimeout(this.quantityTimers.get(key));
    }
    const timer = window.setTimeout(() => {
      this.quantityTimers.delete(key);
      this.quantityPending.delete(key);
      this.aplicarQuantidade(item, value);
    }, 250);
    this.quantityTimers.set(key, timer);
  }

  private setQuantityError(item: CartItem, message: string): void {
    this.quantityErrors.set(item.key, message);
    const timer = this.quantityTimers.get(item.key);
    if (timer) {
      clearTimeout(timer);
      this.quantityTimers.delete(item.key);
    }
    this.quantityPending.delete(item.key);
  }

  private clearQuantityError(item: CartItem): void {
    this.quantityErrors.delete(item.key);
  }

  private clearLocalSalesState(): void {
    for (const sale of this.openSales) {
      this.cartBySale.delete(sale.id);
      this.paymentsBySale.delete(sale.id);
    }
    this.openSales = [];
    this.currentSale = null;
    localStorage.removeItem(this.saleStateKey());
  }

  private cacheStocks(items: ItemVendavelDto[]): void {
    for (const item of items) {
      if (item.tipo !== 'PRODUTO') continue;
      if (item.estoque == null) continue;
      this.stockByProductId.set(item.id, item.estoque);
    }
  }

  private getAvailableStock(produtoId: number, fallback?: number | null): number {
    const cached = this.stockByProductId.get(produtoId);
    if (cached != null) return cached;
    return Number(fallback ?? 0);
  }

  private applyStockDelta(produtoId: number, delta: number): void {
    const current = this.stockByProductId.get(produtoId);
    if (current == null) return;
    const next = Math.max(current - delta, 0);
    this.stockByProductId.set(produtoId, next);
    for (const item of this.resultados) {
      if (item.tipo === 'PRODUTO' && item.id === produtoId) {
        item.estoque = next;
      }
    }
  }

  private clampQuantityByStock(item: CartItem, desired: number): number {
    if (item.tipo !== 'PRODUTO' || item.estoque == null) return desired;
    const disponivel = this.getAvailableStock(item.produtoId, item.estoque);
    const maxAllowed = item.quantity + Math.max(disponivel, 0);
    return Math.min(desired, maxAllowed);
  }

  private aplicarQuantidadeDraft(item: CartItem, novaQuantidade: number): void {
    if (!this.currentDraftId) return;
    const key = this.toDraftKey(this.currentDraftId);
    const items = this.cartBySale.get(key) ?? [];
    const target = items.find(x => x.key === item.key);
    if (!target) return;

    if (item.tipo === 'PRODUTO' && item.estoque != null) {
      novaQuantidade = this.clampQuantityByStock(item, novaQuantidade);
    }

    if (novaQuantidade <= 0) {
      const nextItems = items.filter(x => x.key !== item.key);
      this.cartBySale.set(key, nextItems);
    } else {
      target.quantity = novaQuantidade;
      this.cartBySale.set(key, [...items]);
    }
    this.persistDraftState();
    this.applyDraftToView();
  }

  fmtMoney(value: number | string | null | undefined): string {
    const n = Number(value ?? 0);
    return n.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  statusLabel(status: string | undefined): string {
    if (!status) return 'ABERTA';
    const s = String(status).toUpperCase();
    if (s.includes('OPEN')) return 'ABERTA';
    if (s.includes('COMPLETED')) return 'FINALIZADA';
    if (s.includes('CANCEL')) return 'CANCELADA';
    return s;
  }

  discountLabel(): string {
    return (this.discountPercent ?? 0) < 0 ? 'Acrescimo' : 'Desconto';
  }

  discountSign(): string {
    return (this.discountPercent ?? 0) < 0 ? '+' : '-';
  }

  private paymentLabel(method: number): string {
    switch (method) {
      case 1: return 'Dinheiro';
      case 2: return 'Pix';
      case 3: return 'Debito';
      case 4: return 'Credito';
      case 5: return 'Voucher';
      default: return 'Outro';
    }
  }
}
