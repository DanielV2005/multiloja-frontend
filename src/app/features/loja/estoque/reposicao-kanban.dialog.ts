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
import { formatBRL } from '../../../shared/format';
import {
  dicaMinimo,
  fmtQuantidade,
  parseQuantidadeMinima,
  placeholderMinimo,
  textoBaseGiro,
  textoDuracao,
  textoHaQuanto,
  textoRitmo,
} from './estoque-minimo';

interface ColunaQuadro {
  id: ReposicaoColuna;
  titulo: string;
  dica: string;
}

/**
 * Quadro de reposicao: o minimo de cada produto e automatico pelas vendas (1 semana; meio = 2, maximo = 4),
 * ou o que o usuario digitou. Cada produto cai numa coluna e, dentro dela, aparece pela prioridade de compra
 * calculada no Catalogo (no excesso, pelo dinheiro parado).
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
            O mínimo é calculado sozinho pelas vendas: <b>mínimo</b> = {{ semanas(dados?.diasMinimo ?? 7) }} de venda,
            <b>meio</b> = {{ semanas(dados?.diasMeio ?? 14) }}, <b>máximo</b> = {{ semanas(dados?.diasMaximo ?? 28) }}.
            Os dias em que o produto ficou sem estoque não entram na média.
            Para fixar outro mínimo, digite no cartão; apague para voltar ao automático; 0 deixa de acompanhar.
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
          {{ totalOk }} em dia
          <ng-container *ngIf="totalSemHistorico"> · {{ totalSemHistorico }} sem vendas para calcular</ng-container>
          <ng-container *ngIf="totalNaoMonitorado"> · {{ totalNaoMonitorado }} não acompanhados</ng-container>
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
              <small class="coluna__valor" *ngIf="col.id === 'EXCESSO' && valorExcessoTotal > 0">
                {{ fmtMoney(valorExcessoTotal) }} parados acima do máximo
              </small>
            </div>
            <span class="contador">{{ itensDa(col.id).length }}</span>
          </header>

          <div class="coluna__vazia" *ngIf="!itensDa(col.id).length">Nenhum produto.</div>

          <article class="cartao" *ngFor="let item of itensDa(col.id); trackBy: trackItem">
            <header class="cartao__topo">
              <strong class="nome">{{ item.nome }}</strong>
              <span
                *ngIf="item.coluna !== 'EXCESSO'"
                class="prioridade"
                [ngClass]="classePrioridade(item)"
                title="Prioridade de compra (0 a 100): falta para o mínimo e rapidez com que acaba"
              >{{ item.prioridade }}</span>
              <span
                *ngIf="item.coluna === 'EXCESSO' && valorExcesso(item) > 0"
                class="valor-parado"
                title="Custo do que passa do máximo"
              >{{ fmtMoney(valorExcesso(item)) }}</span>
            </header>

            <div class="barra" [title]="tituloBarra(item)">
              <span class="barra__preenchida" [style.width.%]="larguraBarra(item)"></span>
              <i class="barra__marca" [style.left.%]="posicao(item, item.minimo)"></i>
              <i class="barra__marca barra__marca--meio" [style.left.%]="posicao(item, item.meio)"></i>
            </div>

            <div class="linha">
              <span>Estoque <b>{{ fmtQtd(item.quantidade) }}</b></span>
              <label class="minimo" [title]="dica(item)">
                mín.
                <input
                  type="text"
                  inputmode="decimal"
                  class="minimo__input"
                  [class.minimo__input--auto]="item.estoqueMinimo == null"
                  [value]="minimoTexto(item)"
                  [placeholder]="placeholder(item)"
                  [disabled]="salvando.has(item.id)"
                  (keydown.enter)="$any($event.target).blur()"
                  (keydown.escape)="cancelarMinimo(item, $event)"
                  (blur)="salvarMinimo(item, $event)"
                />
                <small class="tag" [class.tag--fixo]="item.estoqueMinimo != null">
                  {{ item.estoqueMinimo == null ? 'auto' : 'fixo' }}
                </small>
              </label>
            </div>

            <div class="linha acao" *ngIf="item.sugestaoCompra > 0">
              <span>Comprar <b>{{ fmtQtd(item.sugestaoCompra) }}</b></span>
              <span class="muted">fica com {{ fmtQtd(item.maximo ?? 0) }} (máximo)</span>
            </div>
            <div class="linha acao" *ngIf="item.coluna === 'EXCESSO'">
              <span><b>{{ fmtQtd(item.excedente) }}</b> acima do máximo ({{ fmtQtd(item.maximo ?? 0) }})</span>
            </div>

            <div class="linha muted">{{ textoGiro(item) }}</div>
            <div class="rodape muted" *ngIf="textoRodape(item) as rodape">{{ rodape }}</div>
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
    .dialog__header b { color: #e5eefc; font-weight: 600; }
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
    .coluna[data-coluna="REPOR"] { --cor: #f97316; }
    .coluna[data-coluna="ATENCAO"] { --cor: #eab308; }
    .coluna[data-coluna="EXCESSO"] { --cor: #a78bfa; }
    .coluna__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .coluna__header small { display: block; color: rgba(226, 232, 240, 0.6); font-size: .75rem; margin-top: 2px; }
    .coluna__header .coluna__valor { color: #c4b5fd; }
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
    .prioridade, .valor-parado {
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
    .valor-parado { background: rgba(167, 139, 250, 0.18); color: #ddd6fe; font-weight: 600; }

    /* Barra de 0 ao maximo; os riscos marcam o minimo e o meio */
    .barra { position: relative; height: 6px; border-radius: 999px; background: rgba(148, 163, 184, 0.18); margin: 2px 0; }
    .barra__preenchida { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--cor); }
    .barra__marca { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: rgba(226, 232, 240, 0.75); }
    .barra__marca--meio { background: rgba(226, 232, 240, 0.4); }

    .linha { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .linha.acao b { color: #f8e28a; }
    .rodape { font-size: .76rem; line-height: 1.35; }
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
    /* Vazio mostra o automatico: cinza e italico, para nao parecer digitado */
    .minimo__input::placeholder { color: rgba(226, 232, 240, 0.5); font-style: italic; }
    .minimo__input:focus { border-color: rgba(56, 189, 248, 0.95); }
    .minimo__input:disabled { opacity: .6; }
    .tag {
      font-size: .7rem;
      padding: 1px 6px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.3);
      color: rgba(226, 232, 240, 0.62);
    }
    .tag--fixo { border-color: rgba(240, 210, 122, 0.5); color: #f8e28a; }
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
    { id: 'SEM_ESTOQUE', titulo: 'Sem estoque', dica: 'Acabou' },
    { id: 'REPOR', titulo: 'Repor', dica: 'Abaixo do mínimo' },
    { id: 'ATENCAO', titulo: 'Atenção', dica: 'Abaixo do meio ou dura menos de 2 semanas' },
    { id: 'EXCESSO', titulo: 'Excesso', dica: 'Acima do máximo e dura mais de 4 semanas' },
  ];

  loading = true;
  erro = '';
  dados: ReposicaoDto | null = null;
  filtro = '';
  totalOk = 0;
  totalSemHistorico = 0;
  totalNaoMonitorado = 0;
  valorExcessoTotal = 0;
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
    this.produtos.listarReposicao().subscribe({
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

  placeholder(item: ReposicaoItemDto): string {
    return placeholderMinimo(item);
  }

  dica(item: ReposicaoItemDto): string {
    return dicaMinimo(item);
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
        // Coluna, niveis e prioridade dependem do minimo: recalcula no servidor
        this.produtos.listarReposicao().subscribe({
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

  /** Posicao (0 a 100%) de uma quantidade na barra, que vai de 0 ao maximo. */
  posicao(item: ReposicaoItemDto, valor: number | null | undefined): number {
    const maximo = item.maximo ?? 0;
    if (maximo <= 0 || valor == null) return 0;
    return Math.max(0, Math.min(valor / maximo, 1)) * 100;
  }

  larguraBarra(item: ReposicaoItemDto): number {
    return this.posicao(item, item.quantidade);
  }

  tituloBarra(item: ReposicaoItemDto): string {
    const n = (v: number | null | undefined) => this.fmtQtd(v ?? 0);
    return `Estoque ${n(item.quantidade)} · mínimo ${n(item.minimo)} · meio ${n(item.meio)} · máximo ${n(item.maximo)}`;
  }

  classePrioridade(item: ReposicaoItemDto): string {
    return item.prioridade >= 70 ? 'alta' : item.prioridade >= 40 ? 'media' : '';
  }

  /** Quanto custa o que passa do maximo (dinheiro parado na prateleira). */
  valorExcesso(item: ReposicaoItemDto): number {
    return item.excedente > 0 && item.precoCusto > 0 ? item.excedente * item.precoCusto : 0;
  }

  textoGiro(item: ReposicaoItemDto): string {
    if (!item.giroDiario) return 'Sem vendas nos últimos 6 meses';
    const vende = `Vende ${textoRitmo(item.giroDiario)}`;
    if (item.quantidade <= 0) return `${vende} · acabou`;
    const dura = item.diasDeEstoque != null ? ` · dura ${textoDuracao(item.diasDeEstoque)}` : '';
    // Em atencao, o que importa e quando pedir: quando o estoque chega no minimo
    const pedir = item.coluna === 'ATENCAO' && item.diasAteMinimo
      ? ` · pedir em ${textoDuracao(item.diasAteMinimo)}`
      : '';
    return vende + dura + pedir;
  }

  /** Linha miuda: de onde saiu a media, o automatico (se o minimo foi fixado) e a ultima compra. */
  textoRodape(item: ReposicaoItemDto): string {
    const partes = [textoBaseGiro(item)];
    if (item.estoqueMinimo != null && item.minimoAutomatico != null && item.minimoAutomatico !== item.estoqueMinimo) {
      partes.push(`mínimo automático seria ${this.fmtQtd(item.minimoAutomatico)}`);
    }
    if (item.ultimaCompra) partes.push(`última compra ${textoHaQuanto(item.ultimaCompra)}`);
    return partes.filter(Boolean).join(' · ');
  }

  semanas(dias: number): string {
    const n = Math.round(dias / 7);
    return n === 1 ? '1 semana' : `${n} semanas`;
  }

  fmtQtd(v: number): string {
    return fmtQuantidade(v);
  }

  fmtMoney(v: number): string {
    return formatBRL(v);
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
    let semHistorico = 0;
    let naoMonitorado = 0;
    let valorExcesso = 0;
    for (const item of this.dados?.itens ?? []) {
      if (f && !item.nome.toLowerCase().includes(f) && !(item.codigoBarra ?? '').toLowerCase().includes(f)) continue;
      if (item.coluna === 'OK') ok++;
      else if (item.coluna === 'SEM_HISTORICO') semHistorico++;
      else if (item.coluna === 'NAO_MONITORADO') naoMonitorado++;
      else {
        const lista = mapa.get(item.coluna) ?? [];
        lista.push(item); // o servidor ja manda por prioridade
        mapa.set(item.coluna, lista);
        if (item.coluna === 'EXCESSO') valorExcesso += this.valorExcesso(item);
      }
    }
    // No excesso nao ha o que comprar: primeiro onde ha mais dinheiro parado
    mapa.get('EXCESSO')?.sort((a, b) => this.valorExcesso(b) - this.valorExcesso(a));
    this.porColuna = mapa;
    this.totalOk = ok;
    this.totalSemHistorico = semHistorico;
    this.totalNaoMonitorado = naoMonitorado;
    this.valorExcessoTotal = valorExcesso;
  }
}
