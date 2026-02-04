// src/app/features/loja/estoque/estoque-movimentos-page.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

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
            <h3>Histórico</h3>
            <small class="muted">
              {{ loading ? 'Carregando...' : 'Itens: ' + movimentos.length }}
            </small>
          </div>

          <form class="filters" [formGroup]="form" (ngSubmit)="buscar()">
            <select formControlName="produtoId">
              <option value="">Todos os produtos</option>
              <option *ngFor="let p of produtos" [value]="p.id">
                {{ p.nome }}
              </option>
            </select>

            <select formControlName="take">
              <option [value]="50">50</option>
              <option [value]="100">100</option>
              <option [value]="200">200</option>
            </select>

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

        <div *ngIf="!loading && movimentos.length > 0" class="table">
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
            <span class="cell col-numero">{{ m.saldoAnterior }} → {{ m.saldoPosterior }}</span>
            <span class="cell col-ref">
              <span *ngIf="m.referenciaTipo">{{ referenciaLabel(m.referenciaTipo) }}</span>
              <span class="muted" *ngIf="!m.referenciaTipo">—</span>
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
    }
    select{
      height:36px;
      border-radius:10px;
      border:1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      padding: 0 8px;
      outline: none;
    }
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
  `],
})
export class EstoqueMovimentosPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private usuarioService = inject(UsuarioService);
  private produtoService = inject(ProdutoService);
  private fb = inject(FormBuilder);

  lojaId = 0;
  loja: Loja | null = null;
  produtos: Produto[] = [];
  movimentos: EstoqueMovimentoDto[] = [];
  loading = false;

  EstoqueMovimentoTipo = EstoqueMovimentoTipo;

  form = this.fb.group({
    produtoId: [''],
    take: [100],
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

    this.buscar();
  }

  buscar(): void {
    const produtoIdRaw = this.form.value.produtoId;
    const produtoId = produtoIdRaw ? Number(produtoIdRaw) : undefined;
    const take = Number(this.form.value.take ?? 100);

    this.loading = true;
    this.produtoService.listarMovimentos(produtoId, take).subscribe({
      next: itens => {
        this.movimentos = itens ?? [];
        this.loading = false;
      },
      error: err => {
        console.error('[Movimentos] erro ao carregar', err);
        this.movimentos = [];
        this.loading = false;
      },
    });
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
