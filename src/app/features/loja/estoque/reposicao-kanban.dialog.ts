// src/app/features/loja/estoque/reposicao-kanban.dialog.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import {
  ProdutoService,
  ReposicaoColuna,
  ReposicaoDto,
  ReposicaoItemDto,
} from '../../../core/services/produto.service';
import { formatDecimal } from '../../../shared/format';
import { parseQuantidadeMinima } from './estoque-minimo';

interface ColunaQuadro {
  id: ReposicaoColuna;
  titulo: string;
  dica: string;
}

/**
 * Quadro de reposicao: cada produto cai numa coluna pela cobertura (estoque / minimo) e,
 * dentro da coluna, aparece por ordem de prioridade de compra (calculada no Catalogo).
 * Fecha com `true` quando algum minimo foi alterado, para quem abriu recarregar os alertas.
 */
@Component({
  standalone: true,
  selector: 'app-reposicao-kanban-dialog',
  imports: [CommonModule, MatDialogModule],
  template: `
    <section class="dialog">
      <header class="dialog__header">
        <div>
          <h3>Reposição de estoque</h3>
          <p>
            Cada coluna mostra os produtos pela cobertura (estoque ÷ mínimo). A prioridade, de 0 a 100,
            soma 60% pelo quanto falta para o mínimo e 40% pela rapidez com que o produto vai acabar, pelas
            vendas dos últimos {{ dados?.diasAnalisados ?? 30 }} dias.
            Sem mínimo definido, vale o padrão de {{ fmtQtd(dados?.minimoPadrao ?? 5) }}; mínimo 0 deixa de monitorar.
          </p>
        </div>
        <button type="button" class="ghost" (click)="fechar()">Fechar</button>
      </header>

      <div class="toolbar">
        <input
          type="search"
          class="busca"
          placeholder="Buscar produto ou código..."
          [value]="filtro"
          (input)="onFiltro($any($event.target).value)"
        />
        <span class="muted resumo" *ngIf="dados">
          {{ totalOk }} em dia · {{ totalNaoMonitorado }} sem monitoramento
        </span>
      </div>

      <div class="estado" *ngIf="loading">Carregando...</div>
      <div class="estado erro" *ngIf="!loading && erro">
        {{ erro }}
        <button type="button" class="ghost" (click)="carregar()">Tentar de novo</button>
      </div>

      <div class="quadro" *ngIf="!loading && !erro">
        <section class="coluna" *ngFor="let col of colunas; trackBy: trackColuna" [attr.data-coluna]="col.id">
          <header class="coluna__header">
            <div>
              <strong>{{ col.titulo }}</strong>
              <small>{{ col.dica }}</small>
            </div>
            <span class="contador">{{ itensDa(col.id).length }}</span>
          </header>

          <div class="coluna__vazia" *ngIf="!itensDa(col.id).length">Nenhum produto.</div>

          <article class="cartao" *ngFor="let item of itensDa(col.id); trackBy: trackItem">
            <header class="cartao__topo">
              <strong class="nome">{{ item.nome }}</strong>
              <span class="prioridade" [ngClass]="classePrioridade(item)" title="Prioridade de compra (0 a 100)">
                {{ item.prioridade }}
              </span>
            </header>

            <div class="barra" [title]="'Cobertura: ' + fmtPercent(item.cobertura)">
              <span class="barra__preenchida" [style.width.%]="larguraBarra(item)"></span>
              <i class="barra__minimo"></i>
            </div>

            <div class="linha">
              <span>Estoque <b>{{ fmtQtd(item.quantidade) }}</b></span>
              <label class="minimo">
                mín.
                <input
                  type="text"
                  inputmode="decimal"
                  class="minimo__input"
                  [value]="minimoTexto(item)"
                  [placeholder]="fmtQtd(dados?.minimoPadrao ?? 5)"
                  [disabled]="salvando.has(item.id)"
                  title="Estoque mínimo deste produto (vazio = padrão)"
                  (keydown.enter)="$any($event.target).blur()"
                  (keydown.escape)="cancelarMinimo(item, $event)"
                  (blur)="salvarMinimo(item, $event)"
                />
                <small *ngIf="item.estoqueMinimo == null" class="muted">padrão</small>
              </label>
            </div>
            <div class="linha muted" *ngIf="item.faltaParaMinimo > 0">
              Faltam {{ fmtQtd(item.faltaParaMinimo) }} para o mínimo
            </div>
            <div class="linha muted">{{ textoGiro(item) }}</div>
            <div class="erro-minimo" *ngIf="errosMinimo.get(item.id) as msg">{{ msg }}</div>
          </article>
        </section>
      </div>
    </section>
  `,
  styles: [`
    .dialog {
      width: min(96vw, 1240px);
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      padding: 22px;
      background: linear-gradient(180deg, rgba(21, 27, 50, 0.98), rgba(11, 16, 31, 0.98));
      color: #e5eefc;
      border: 1px solid rgba(240, 210, 122, 0.35);
      border-radius: 22px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.38);
      box-sizing: border-box;
    }
    .dialog__header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .dialog__header h3 { margin: 0 0 6px; font-size: 1.2rem; }
    .dialog__header p { margin: 0; color: rgba(226, 232, 240, 0.76); line-height: 1.45; font-size: .9rem; max-width: 820px; }
    .ghost {
      border: 1px solid rgba(240, 210, 122, 0.35);
      background: transparent;
      color: #f8e28a;
      border-radius: 999px;
      padding: 8px 16px;
      cursor: pointer;
      white-space: nowrap;
    }
    .muted { color: rgba(226, 232, 240, 0.62); }

    .toolbar { display: flex; align-items: center; gap: 12px; margin: 14px 0 12px; flex-wrap: wrap; }
    .busca {
      flex: 1 1 260px;
      height: 36px;
      padding: 0 12px;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      background: #060b18;
      color: #e5eefc;
      outline: none;
    }
    .busca:focus { border-color: rgba(240, 210, 122, 0.7); }
    .resumo { font-size: .85rem; }
    .estado { padding: 24px 4px; color: rgba(226, 232, 240, 0.72); display: flex; gap: 12px; align-items: center; }
    .estado.erro { color: #fca5a5; }

    .quadro {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      overflow: auto;
      min-height: 0;
    }
    .coluna {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px;
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-top: 3px solid var(--cor);
      min-width: 0;
    }
    .coluna[data-coluna="SEM_ESTOQUE"] { --cor: #ef4444; }
    .coluna[data-coluna="CRITICO"] { --cor: #f97316; }
    .coluna[data-coluna="REPOR"] { --cor: #eab308; }
    .coluna[data-coluna="ATENCAO"] { --cor: #38bdf8; }
    .coluna__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .coluna__header small { display: block; color: rgba(226, 232, 240, 0.6); font-size: .75rem; margin-top: 2px; }
    .contador {
      min-width: 26px;
      text-align: center;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.16);
      font-variant-numeric: tabular-nums;
      font-size: .85rem;
    }
    .coluna__vazia { font-size: .85rem; color: rgba(226, 232, 240, 0.5); padding: 6px 2px; }

    .cartao {
      display: grid;
      gap: 6px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #0b1224;
      border: 1px solid rgba(148, 163, 184, 0.18);
      font-size: .86rem;
    }
    .cartao__topo { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .nome { word-break: break-word; }
    .prioridade {
      flex: none;
      min-width: 30px;
      text-align: center;
      padding: 2px 7px;
      border-radius: 8px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      background: rgba(148, 163, 184, 0.18);
    }
    .prioridade.alta { background: rgba(239, 68, 68, 0.22); color: #fecaca; }
    .prioridade.media { background: rgba(234, 179, 8, 0.2); color: #fef08a; }

    /* Barra de cobertura em escala de 0 a 1,5x o minimo; o risco marca o minimo */
    .barra { position: relative; height: 6px; border-radius: 999px; background: rgba(148, 163, 184, 0.18); }
    .barra__preenchida { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--cor); }
    .barra__minimo { position: absolute; top: -3px; bottom: -3px; left: 66.67%; width: 2px; background: rgba(226, 232, 240, 0.7); }

    .linha { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .minimo { display: inline-flex; align-items: center; gap: 6px; }
    .minimo__input {
      width: 64px;
      height: 26px;
      padding: 0 6px;
      border-radius: 8px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      background: #050814;
      color: #e5eefc;
      text-align: right;
      font: inherit;
      font-variant-numeric: tabular-nums;
      outline: none;
    }
    .minimo__input:focus { border-color: rgba(56, 189, 248, 0.95); }
    .minimo__input:disabled { opacity: .6; }
    .erro-minimo { color: #fca5a5; font-size: .8rem; }

    @media (max-width: 1000px) {
      .quadro { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .dialog { padding: 16px; border-radius: 18px; }
      .dialog__header { display: grid; }
      .ghost { justify-self: start; }
      .quadro { grid-template-columns: minmax(0, 1fr); }
    }
  `],
})
export class ReposicaoKanbanDialogComponent implements OnInit {
  private produtos = inject(ProdutoService);
  private ref = inject(MatDialogRef<ReposicaoKanbanDialogComponent>);

  readonly colunas: ColunaQuadro[] = [
    { id: 'SEM_ESTOQUE', titulo: 'Sem estoque', dica: 'Zerados' },
    { id: 'CRITICO', titulo: 'Crítico', dica: 'Metade do mínimo ou menos' },
    { id: 'REPOR', titulo: 'Repor', dica: 'Chegou no mínimo' },
    { id: 'ATENCAO', titulo: 'Atenção', dica: 'Até 1,5× o mínimo ou acaba em 7 dias' },
  ];

  loading = true;
  erro = '';
  dados: ReposicaoDto | null = null;
  filtro = '';
  totalOk = 0;
  totalNaoMonitorado = 0;
  salvando = new Set<number>();
  errosMinimo = new Map<number, string>();

  private porColuna = new Map<ReposicaoColuna, ReposicaoItemDto[]>();
  private alterou = false;
  private cancelado = false;

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading = true;
    this.erro = '';
    this.produtos.listarReposicao(30).subscribe({
      next: dados => {
        this.dados = dados;
        this.agrupar();
        this.loading = false;
      },
      error: err => {
        console.error('[Reposicao] erro ao carregar', err);
        this.erro = 'Não foi possível carregar a reposição.';
        this.loading = false;
      },
    });
  }

  onFiltro(valor: string): void {
    this.filtro = valor ?? '';
    this.agrupar();
  }

  itensDa(coluna: ReposicaoColuna): ReposicaoItemDto[] {
    return this.porColuna.get(coluna) ?? [];
  }

  minimoTexto(item: ReposicaoItemDto): string {
    return item.estoqueMinimo == null ? '' : this.fmtQtd(item.estoqueMinimo);
  }

  cancelarMinimo(item: ReposicaoItemDto, event: Event): void {
    this.cancelado = true;
    const input = event.target as HTMLInputElement;
    input.value = this.minimoTexto(item);
    input.blur();
  }

  salvarMinimo(item: ReposicaoItemDto, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (this.cancelado) {
      this.cancelado = false;
      return;
    }
    const lido = parseQuantidadeMinima(input.value);
    if (!lido.ok) {
      this.errosMinimo.set(item.id, lido.erro);
      return;
    }
    this.errosMinimo.delete(item.id);
    if (lido.valor === (item.estoqueMinimo ?? null)) return;

    this.salvando.add(item.id);
    this.produtos.definirEstoqueMinimo(item.id, lido.valor).subscribe({
      next: () => {
        this.salvando.delete(item.id);
        this.alterou = true;
        // A coluna e a prioridade dependem do minimo: recalcula no servidor
        this.produtos.listarReposicao(this.dados?.diasAnalisados ?? 30).subscribe({
          next: dados => {
            this.dados = dados;
            this.agrupar();
          },
          error: () => {
            item.estoqueMinimo = lido.valor;
          },
        });
      },
      error: err => {
        this.salvando.delete(item.id);
        input.value = this.minimoTexto(item);
        this.errosMinimo.set(
          item.id,
          err?.status === 403 ? 'Sem permissão para alterar o mínimo.' : 'Não foi possível salvar o mínimo.'
        );
      },
    });
  }

  fechar(): void {
    this.ref.close(this.alterou);
  }

  larguraBarra(item: ReposicaoItemDto): number {
    return Math.max(0, Math.min(item.cobertura / 1.5, 1)) * 100;
  }

  classePrioridade(item: ReposicaoItemDto): string {
    return item.prioridade >= 70 ? 'alta' : item.prioridade >= 40 ? 'media' : '';
  }

  textoGiro(item: ReposicaoItemDto): string {
    const dias = this.dados?.diasAnalisados ?? 30;
    if (!item.giroDiario) return `Sem vendas nos últimos ${dias} dias`;
    const semana = `Vende ~${formatDecimal(item.giroDiario * 7, 0, 1)}/semana`;
    if (item.quantidade <= 0) return semana;
    const restam = item.diasDeEstoque ?? 0;
    return `${semana} · acaba em ~${formatDecimal(restam, 0, 0)} ${restam < 1.5 ? 'dia' : 'dias'}`;
  }

  fmtQtd(v: number): string {
    return formatDecimal(v, 0, 3);
  }

  fmtPercent(v: number): string {
    return `${formatDecimal(v * 100, 0, 0)}%`;
  }

  trackColuna(_: number, col: ColunaQuadro): string {
    return col.id;
  }

  trackItem(_: number, item: ReposicaoItemDto): number {
    return item.id;
  }

  private agrupar(): void {
    const f = this.filtro.trim().toLowerCase();
    const mapa = new Map<ReposicaoColuna, ReposicaoItemDto[]>();
    let ok = 0;
    let naoMonitorado = 0;
    for (const item of this.dados?.itens ?? []) {
      if (f && !item.nome.toLowerCase().includes(f) && !(item.codigoBarra ?? '').toLowerCase().includes(f)) continue;
      if (item.coluna === 'OK') ok++;
      else if (item.coluna === 'NAO_MONITORADO') naoMonitorado++;
      else {
        const lista = mapa.get(item.coluna) ?? [];
        lista.push(item); // o servidor ja manda por prioridade
        mapa.set(item.coluna, lista);
      }
    }
    this.porColuna = mapa;
    this.totalOk = ok;
    this.totalNaoMonitorado = naoMonitorado;
  }
}
