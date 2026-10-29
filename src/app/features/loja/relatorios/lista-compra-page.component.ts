// src/app/features/loja/relatorios/lista-compra-page.component.ts
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';

import { Loja, UsuarioService } from '../../../core/services/usuario.service';
import { ProdutoService, ReposicaoItemDto, TendenciaVendas } from '../../../core/services/produto.service';
import { SetorService } from '../../../core/services/setor.service';
import { CurvaAbcService } from '../../../core/services/curva-abc.service';
import { ClasseAbc, textoClasseAbc } from '../../../shared/curva-abc';
import { formatBRL, formatDecimal } from '../../../shared/format';
import { fmtQuantidade, parseQuantidadeMaxima, textoRitmo } from '../estoque/estoque-maximo';
import { detalheTendencia, valorTendencia } from '../estoque/tendencia';
import {
  FiltroCurva,
  FiltrosCompra,
  GrupoLista,
  ItemLista,
  OrdemCompra,
  SITUACOES_COMPRA,
  SituacaoCompra,
  TENDENCIAS_COMPRA,
  agruparPorSetor,
  contarTendencias,
  curvaDoItem,
  filtrarCompra,
  filtrosCompraPadrao,
  quantidadeDe,
  textoListaCompra,
  valorDe,
} from './lista-compra';

interface Impressao {
  data: string;
  grupos: GrupoLista[];
  produtos: number;
  unidades: number;
  valor: number;
}

/**
 * Lista de compra montada pelo quadro de reposicao: filtra o que comprar agora, deixa ajustar a quantidade
 * e marcar o que vai na lista, que pode ser impressa (com custo, para conferir a compra) ou copiada
 * (so quantidade e produto, para mandar ao fornecedor). A selecao fica guardada enquanto a aba estiver aberta.
 */
@Component({
  standalone: true,
  selector: 'app-lista-compra-page',
  imports: [CommonModule, RouterLink],
  styleUrls: ['./relatorio-pagina.css'],
  template: `
  <section class="page">
    <div class="tela">
      <header class="topbar">
        <a class="link" [routerLink]="['/loja', lojaId]">
          <span class="material-symbols-outlined">arrow_back</span>
          <span>Voltar para o painel</span>
        </a>
        <div class="title">
          <h2>Lista de compra</h2>
          <small class="muted" *ngIf="loja">{{ loja.nome }}</small>
        </div>
        <span class="spacer"></span>
      </header>

      <main class="card">
        <header class="card__header">
          <div>
            <h3>O que comprar agora</h3>
            <p class="muted">
              Vem do quadro de reposição: a quantidade sugerida completa o estoque até o máximo. Ajuste se quiser,
              marque o que vai na lista e imprima ou copie para mandar ao fornecedor.
            </p>
          </div>
        </header>

        <div class="linha-filtros" role="group" aria-label="Situação">
          <span class="rotulo">Situação</span>
          <button
            *ngFor="let s of situacoes"
            type="button"
            class="chip"
            [class.ativo]="filtros.situacoes.has(s.id)"
            [attr.aria-pressed]="filtros.situacoes.has(s.id)"
            [title]="s.dica"
            (click)="alternarSituacao(s.id)"
          ><span class="situacao" [attr.data-coluna]="s.id">{{ s.rotulo }} ({{ contagem.get(s.id) ?? 0 }})</span></button>
        </div>

        <div class="linha-filtros" role="group" aria-label="Curva ABC">
          <span class="rotulo" [title]="'Pelo faturamento dos últimos ' + diasCurva + ' dias'">Curva</span>
          <ng-container *ngIf="curva; else semCurva">
            <button
              *ngFor="let c of curvas"
              type="button"
              class="chip"
              [class.ativo]="filtros.curvas.has(c)"
              [attr.aria-pressed]="filtros.curvas.has(c)"
              [title]="dicaCurva(c)"
              (click)="alternarCurva(c)"
            >
              <span class="abc" *ngIf="c !== 'SEM_VENDA'" [attr.data-classe]="c">{{ c }}</span>
              <ng-container *ngIf="c === 'SEM_VENDA'">Não vendeu</ng-container>
            </button>
            <span class="muted dica-curva">{{ filtros.curvas.size ? '' : 'todas' }}</span>
          </ng-container>
          <ng-template #semCurva>
            <span class="muted dica-curva">{{ carregandoCurva ? 'calculando...' : 'indisponível (as vendas não carregaram)' }}</span>
          </ng-template>
        </div>

        <div class="linha-filtros" role="group" aria-label="Vendas nas últimas semanas">
          <span class="rotulo" [title]="'Últimos ' + diasTendencia + ' dias contra os 3 meses antes deles'">Vendas</span>
          <button
            *ngFor="let t of tendencias"
            type="button"
            class="chip"
            [class.ativo]="filtros.tendencias.has(t.id)"
            [attr.aria-pressed]="filtros.tendencias.has(t.id)"
            [title]="t.dica"
            (click)="alternarTendencia(t.id)"
          ><span class="tendencia" [attr.data-tendencia]="t.id">{{ t.rotulo }}</span> ({{ contagemTendencia.get(t.id) ?? 0 }})</button>
        </div>

        <div class="linha-filtros">
          <input
            type="search"
            class="busca"
            placeholder="Buscar produto ou código..."
            aria-label="Buscar produto ou código"
            [value]="filtros.busca"
            (input)="mudar({ busca: $any($event.target).value })"
          />
          <select class="campo" aria-label="Setor" [value]="filtros.setorId ?? ''" (change)="mudarSetor($any($event.target).value)">
            <option value="">Todos os setores</option>
            <option *ngFor="let s of opcoesSetor" [value]="s.id">{{ s.nome }}</option>
          </select>
          <select class="campo" aria-label="Ordenar" [value]="filtros.ordem" (change)="mudar({ ordem: $any($event.target).value })">
            <option value="prioridade">Mais urgente primeiro</option>
            <option value="valor">Maior valor de compra</option>
            <option value="setor">Por setor</option>
            <option value="nome">Por nome</option>
          </select>
        </div>

        <p class="estado" *ngIf="carregando">Carregando...</p>
        <div class="estado erro" *ngIf="!carregando && erro">
          {{ erro }}
          <button type="button" class="btn" (click)="carregar()">Tentar de novo</button>
        </div>
        <p class="estado" *ngIf="!carregando && !erro && !visiveis.length">Nenhum produto com esses filtros.</p>

        <div class="tabela-wrap" *ngIf="!carregando && !erro && visiveis.length">
          <table class="tabela">
            <thead>
              <tr>
                <th class="centro">
                  <input
                    type="checkbox"
                    aria-label="Marcar todos os da lista"
                    title="Marcar ou desmarcar todos os que aparecem (com quantidade para comprar)"
                    [checked]="todosMarcados"
                    [indeterminate]="algunsMarcados"
                    (change)="alternarTodos()"
                  />
                </th>
                <th>Produto</th>
                <th>Setor</th>
                <th>Situação</th>
                <th class="centro">Curva</th>
                <th class="num">Estoque</th>
                <th class="num">Máx.</th>
                <th>Vende</th>
                <th class="num">Comprar</th>
                <th class="num">Custo un.</th>
                <th class="num">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of visiveis; trackBy: trackItem" [class.marcado]="selecionados.has(item.id)">
                <td class="centro">
                  <input
                    type="checkbox"
                    [attr.aria-label]="'Comprar ' + item.nome"
                    [checked]="selecionados.has(item.id)"
                    [disabled]="quantidade(item) <= 0"
                    [title]="quantidade(item) <= 0 ? 'Digite quanto comprar' : ''"
                    (change)="alternar(item)"
                  />
                </td>
                <td>
                  <div class="nome">{{ item.nome }}</div>
                  <small class="muted" *ngIf="item.codigoBarra">{{ item.codigoBarra }}</small>
                  <small class="perdida" *ngIf="item.valorVendaPerdida > 0" [title]="dicaPerdida(item)">
                    deixou de vender ~{{ fmtMoney(item.valorVendaPerdida) }} em 30 dias
                  </small>
                </td>
                <td>{{ nomeSetor(item.setorFilhoId) }}</td>
                <td><span class="situacao" [attr.data-coluna]="item.coluna">{{ rotuloSituacao(item) }}</span></td>
                <td class="centro">
                  <span class="abc" *ngIf="classe(item) as c" [attr.data-classe]="c" [title]="dicaClasse(c)">{{ c }}</span>
                </td>
                <td class="num">{{ fmtQtd(item.quantidade) }}</td>
                <td class="num">{{ item.maximo != null ? fmtQtd(item.maximo) : '—' }}</td>
                <td class="muted">
                  {{ item.giroDiario ? ritmo(item.giroDiario) : '—' }}
                  <small class="tendencia" *ngIf="item.tendencia" [attr.data-tendencia]="item.tendencia" [title]="dicaTendencia(item)">
                    {{ rotuloTendencia(item) }}
                  </small>
                </td>
                <td class="num">
                  <input
                    type="text"
                    inputmode="decimal"
                    class="qtd"
                    [attr.aria-label]="'Quantidade de ' + item.nome"
                    [class.qtd--digitada]="digitadas.has(item.id)"
                    [value]="digitadas.has(item.id) ? fmtQtd(digitadas.get(item.id)!) : ''"
                    [placeholder]="fmtQtd(item.sugestaoCompra)"
                    (keydown.enter)="$any($event.target).blur()"
                    (blur)="digitarQuantidade(item, $any($event.target))"
                  />
                  <small class="erro-qtd" *ngIf="errosQtd.get(item.id) as msg">{{ msg }}</small>
                </td>
                <td class="num muted">{{ item.precoCusto > 0 ? fmtMoney(item.precoCusto) : '—' }}</td>
                <td class="num">{{ item.precoCusto > 0 ? fmtMoney(valor(item)) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted rodape" *ngIf="!carregando && !erro && visiveis.length">
          {{ visiveis.length }} {{ visiveis.length === 1 ? 'produto' : 'produtos' }} na tela.
          Campo "Comprar" vazio usa a sugestão (em cinza); digite outro número para mudar.
        </p>
      </main>

      <div class="barra-selecao" *ngIf="selecionados.size">
        <span>
          <b>{{ resumo.produtos }}</b> {{ resumo.produtos === 1 ? 'produto marcado' : 'produtos marcados' }} ·
          {{ fmtQtd(resumo.unidades) }} {{ resumo.unidades === 1 ? 'unidade' : 'unidades' }}
          <ng-container *ngIf="resumo.valor > 0"> · {{ fmtMoney(resumo.valor) }} pelo custo</ng-container>
        </span>
        <span class="spacer"></span>
        <span class="aviso" *ngIf="aviso">{{ aviso }}</span>
        <button type="button" class="btn" (click)="limparSelecao()">Limpar</button>
        <button type="button" class="btn" (click)="copiar()" title="Só quantidade e produto, para mandar ao fornecedor">
          <span class="material-symbols-outlined">content_copy</span> Copiar lista
        </button>
        <button type="button" class="btn btn--principal" (click)="imprimir()">
          <span class="material-symbols-outlined">print</span> Imprimir lista
        </button>
      </div>
    </div>

    <section class="impressao" *ngIf="impressao">
      <h1>Lista de compra</h1>
      <p>{{ loja?.nome }} · {{ impressao.data }}</p>
      <table>
        <thead>
          <tr>
            <th class="ok"></th>
            <th>Produto</th>
            <th>Código</th>
            <th class="num">Qtd.</th>
            <th class="num">Custo un.</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          <ng-container *ngFor="let g of impressao.grupos">
            <tr class="grupo" *ngIf="impressao.grupos.length > 1"><td colspan="6">{{ g.setor }}</td></tr>
            <tr *ngFor="let i of g.itens">
              <td class="ok"><span class="caixa"></span></td>
              <td>{{ i.nome }}</td>
              <td>{{ i.codigoBarra }}</td>
              <td class="num">{{ fmtQtd(i.quantidade) }}</td>
              <td class="num">{{ i.custo > 0 ? fmtMoney(i.custo) : '' }}</td>
              <td class="num">{{ i.custo > 0 ? fmtMoney(i.custo * i.quantidade) : '' }}</td>
            </tr>
          </ng-container>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">{{ impressao.produtos }} {{ impressao.produtos === 1 ? 'produto' : 'produtos' }}</td>
            <td class="num">{{ fmtQtd(impressao.unidades) }}</td>
            <td></td>
            <td class="num">{{ impressao.valor > 0 ? fmtMoney(impressao.valor) : '' }}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  </section>
  `,
  styles: [`
    .dica-curva { font-size: .82rem; }
    .rodape { font-size: .82rem; margin: 0; }
    .perdida { color: #f87171; }
    tr.marcado td { background: rgba(218, 171, 31, .08); }
    .qtd {
      width: 72px;
      height: 30px;
      padding: 0 8px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      text-align: right;
      font: inherit;
      font-variant-numeric: tabular-nums;
      outline: none;
    }
    .qtd::placeholder { color: var(--muted); font-style: italic; }
    .qtd:focus { border-color: rgba(56, 189, 248, .95); }
    .qtd--digitada { border-color: #d4af37; }
    .erro-qtd { color: #f87171; white-space: normal; }
    input[type="checkbox"] { width: 16px; height: 16px; accent-color: #d4af37; cursor: pointer; }
    input[type="checkbox"]:disabled { cursor: default; opacity: .4; }

    .barra-selecao {
      position: fixed;
      left: 50%;
      bottom: 16px;
      transform: translateX(-50%);
      width: min(1240px, calc(100vw - 24px));
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 10px 14px;
      border-radius: 16px;
      background: var(--surface);
      border: 1px solid #d4af37;
      box-shadow: 0 12px 32px rgba(0, 0, 0, .35);
      z-index: 5;
      font-size: .9rem;
    }
    .aviso { color: #22c55e; font-size: .85rem; }

    .impressao { display: none; }
    @media print {
      .page { padding: 0; background: #fff; color: #000; min-height: 0; }
      .tela { display: none !important; }
      .impressao { display: block; color: #000; font-size: 11pt; }
      .impressao h1 { font-size: 16pt; margin: 0 0 2mm; }
      .impressao p { margin: 0 0 4mm; }
      .impressao table { width: 100%; border-collapse: collapse; }
      .impressao th, .impressao td { border-bottom: 1px solid #999; padding: 1.5mm 2mm; text-align: left; }
      .impressao th { font-size: 9pt; text-transform: uppercase; }
      .impressao .num { text-align: right; white-space: nowrap; }
      .impressao .ok { width: 7mm; }
      .impressao .caixa { display: inline-block; width: 3.5mm; height: 3.5mm; border: 1px solid #000; }
      .impressao tr.grupo td { font-weight: 700; padding-top: 4mm; border-bottom: 2px solid #000; }
      .impressao tfoot td { font-weight: 700; border-bottom: none; border-top: 2px solid #000; }
      .impressao tr { break-inside: avoid; }
    }
  `],
})
export class ListaCompraPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private usuarios = inject(UsuarioService);
  private produtos = inject(ProdutoService);
  private setores = inject(SetorService);
  private curvaAbc = inject(CurvaAbcService);
  private cdr = inject(ChangeDetectorRef);

  readonly situacoes = SITUACOES_COMPRA;
  readonly tendencias = TENDENCIAS_COMPRA;
  readonly curvas: FiltroCurva[] = ['A', 'B', 'C', 'SEM_VENDA'];
  readonly diasCurva = this.curvaAbc.dias;
  diasTendencia = 14;

  lojaId = 0;
  loja: Loja | null = null;
  carregando = true;
  erro = '';
  carregandoCurva = true;
  curva: Map<number, ClasseAbc> | null = null;
  filtros: FiltrosCompra = filtrosCompraPadrao();

  itens: ReposicaoItemDto[] = [];
  visiveis: ReposicaoItemDto[] = [];
  contagem = new Map<SituacaoCompra, number>();
  contagemTendencia = new Map<TendenciaVendas, number>();
  opcoesSetor: Array<{ id: number; nome: string }> = [];
  selecionados = new Set<number>();
  digitadas = new Map<number, number>();
  errosQtd = new Map<number, string>();
  resumo = { produtos: 0, unidades: 0, valor: 0 };
  impressao: Impressao | null = null;
  aviso = '';

  private nomesSetor = new Map<number, string>();
  private avisoTimer: ReturnType<typeof setTimeout> | null = null;
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.lojaId = Number(this.route.snapshot.paramMap.get('id')) || 0;
    this.usuarios.loja(this.lojaId).subscribe({
      next: loja => (this.loja = loja ?? null),
      error: () => (this.loja = null),
    });
    // A curva ABC vem do PDV e pode demorar ou falhar: a lista funciona sem ela
    this.curvaAbc.ultimos90Dias().pipe(takeUntil(this.destroy$)).subscribe({
      next: curva => {
        this.curva = curva;
        this.carregandoCurva = false;
        this.aplicar();
      },
      error: () => {
        this.curva = null;
        this.carregandoCurva = false;
        this.aplicar();
      },
    });
    this.carregar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.avisoTimer) clearTimeout(this.avisoTimer);
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    forkJoin({
      reposicao: this.produtos.listarReposicao(),
      setores: this.setores.listar().pipe(catchError(() => of([]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ reposicao, setores }) => {
          this.itens = reposicao.itens ?? [];
          this.diasTendencia = reposicao.diasTendencia ?? this.diasTendencia;
          this.nomesSetor = new Map(setores.map(s => [s.id, s.nome]));
          const usados = new Set(this.itens.map(i => i.setorFilhoId));
          this.opcoesSetor = [...usados]
            .map(id => ({ id, nome: this.nomeSetor(id) }))
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
          this.contagem = new Map();
          for (const i of this.itens) {
            const s = i.coluna as SituacaoCompra;
            this.contagem.set(s, (this.contagem.get(s) ?? 0) + 1);
          }
          this.restaurarSelecao();
          this.carregando = false;
          this.aplicar();
        },
        error: () => {
          this.erro = 'Não foi possível carregar a reposição.';
          this.carregando = false;
        },
      });
  }

  // ---------- filtros ----------

  mudar(parte: Partial<FiltrosCompra>): void {
    this.filtros = { ...this.filtros, ...parte };
    this.aplicar();
  }

  mudarSetor(valor: string): void {
    this.mudar({ setorId: valor ? Number(valor) : null });
  }

  alternarSituacao(s: SituacaoCompra): void {
    const situacoes = new Set(this.filtros.situacoes);
    if (situacoes.has(s)) situacoes.delete(s);
    else situacoes.add(s);
    this.mudar({ situacoes });
  }

  alternarCurva(c: FiltroCurva): void {
    const curvas = new Set(this.filtros.curvas);
    if (curvas.has(c)) curvas.delete(c);
    else curvas.add(c);
    this.mudar({ curvas });
  }

  alternarTendencia(t: TendenciaVendas): void {
    const tendencias = new Set(this.filtros.tendencias);
    if (tendencias.has(t)) tendencias.delete(t);
    else tendencias.add(t);
    this.mudar({ tendencias });
  }

  // ---------- selecao e quantidade ----------

  get todosMarcados(): boolean {
    const marcaveis = this.visiveis.filter(i => this.quantidade(i) > 0);
    return marcaveis.length > 0 && marcaveis.every(i => this.selecionados.has(i.id));
  }

  get algunsMarcados(): boolean {
    return !this.todosMarcados && this.visiveis.some(i => this.selecionados.has(i.id));
  }

  /** Marca todos os da tela que tem quantidade para comprar; se ja estavam todos marcados, desmarca. */
  alternarTodos(): void {
    const marcaveis = this.visiveis.filter(i => this.quantidade(i) > 0);
    const desmarcar = this.todosMarcados;
    for (const i of marcaveis) {
      if (desmarcar) this.selecionados.delete(i.id);
      else this.selecionados.add(i.id);
    }
    this.selecaoMudou();
  }

  alternar(item: ReposicaoItemDto): void {
    if (this.selecionados.has(item.id)) this.selecionados.delete(item.id);
    else if (this.quantidade(item) > 0) this.selecionados.add(item.id);
    this.selecaoMudou();
  }

  /** Digitar quantidade marca o produto; 0 desmarca; vazio volta para a sugestao. */
  digitarQuantidade(item: ReposicaoItemDto, input: HTMLInputElement): void {
    const lido = parseQuantidadeMaxima(input.value);
    if (!lido.ok) {
      this.errosQtd.set(item.id, 'Número inválido');
      return;
    }
    this.errosQtd.delete(item.id);
    if (lido.valor == null) this.digitadas.delete(item.id);
    else this.digitadas.set(item.id, lido.valor);

    if (this.quantidade(item) <= 0) this.selecionados.delete(item.id);
    else if (lido.valor != null) this.selecionados.add(item.id);
    this.selecaoMudou();
    if (this.filtros.ordem === 'valor') this.aplicar();
  }

  limparSelecao(): void {
    this.selecionados.clear();
    this.digitadas.clear();
    this.errosQtd.clear();
    this.selecaoMudou();
  }

  quantidade(item: ReposicaoItemDto): number {
    return quantidadeDe(item, this.digitadas);
  }

  valor(item: ReposicaoItemDto): number {
    return valorDe(item, this.digitadas);
  }

  // ---------- imprimir e copiar ----------

  imprimir(): void {
    const itens = this.itensDaLista();
    if (!itens.length) return;
    this.impressao = {
      data: new Date().toLocaleDateString('pt-BR'),
      grupos: agruparPorSetor(itens),
      produtos: itens.length,
      unidades: itens.reduce((s, i) => s + i.quantidade, 0),
      valor: itens.reduce((s, i) => s + i.quantidade * i.custo, 0),
    };
    // A parte impressa precisa estar na pagina antes de abrir a janela de impressao
    this.cdr.detectChanges();
    window.print();
  }

  async copiar(): Promise<void> {
    const texto = textoListaCompra(this.itensDaLista(), this.loja?.nome ?? '', new Date().toLocaleDateString('pt-BR'));
    let copiou = false;
    try {
      await navigator.clipboard.writeText(texto);
      copiou = true;
    } catch {
      copiou = copiarPorSelecao(texto);
    }
    this.mostrarAviso(copiou ? 'Lista copiada. Cole no WhatsApp ou e-mail.' : 'Não foi possível copiar.');
  }

  // ---------- textos ----------

  nomeSetor(id: number): string {
    return this.nomesSetor.get(id) ?? '—';
  }

  rotuloSituacao(item: ReposicaoItemDto): string {
    return SITUACOES_COMPRA.find(s => s.id === item.coluna)?.rotulo ?? 'Excesso';
  }

  classe(item: ReposicaoItemDto): ClasseAbc | null {
    const c = curvaDoItem(item, this.curva);
    return c && c !== 'SEM_VENDA' ? c : null;
  }

  dicaClasse(c: ClasseAbc): string {
    return textoClasseAbc(c);
  }

  dicaCurva(c: FiltroCurva): string {
    return c === 'SEM_VENDA' ? `Não vendeu nos últimos ${this.diasCurva} dias` : textoClasseAbc(c);
  }

  dicaPerdida(item: ReposicaoItemDto): string {
    return `Ficou ${item.diasZeradoRecente} ${item.diasZeradoRecente === 1 ? 'dia' : 'dias'} sem estoque nos últimos 30 dias; ` +
      `vendendo ${this.ritmo(item.giroDiario ?? 0)}, deixou de vender ~${fmtQuantidade(item.vendaPerdida)} un. (estimativa).`;
  }

  ritmo(porDia: number): string {
    return textoRitmo(porDia);
  }

  /** "↑ em alta: 7 em 14 dias" (abaixo da media de 3 meses, sem o "15x" que confundiria), "↓ em queda (parou)". */
  rotuloTendencia(item: ReposicaoItemDto): string {
    return item.tendencia === 'ALTA'
      ? `↑ em alta: ${fmtQuantidade(item.vendidoRecente)} em ${this.diasTendencia} dias`
      : `↓ em queda (${valorTendencia(item)})`;
  }

  dicaTendencia(item: ReposicaoItemDto): string {
    return detalheTendencia(item, this.diasTendencia);
  }

  fmtQtd(v: number): string {
    return fmtQuantidade(v);
  }

  fmtMoney(v: number): string {
    return formatBRL(v);
  }

  trackItem(_: number, item: ReposicaoItemDto): number {
    return item.id;
  }

  // ---------- interno ----------

  private aplicar(): void {
    this.visiveis = filtrarCompra(this.itens, this.filtros, this.curva, this.digitadas, id => this.nomeSetor(id));
    this.contagemTendencia = contarTendencias(this.itens, this.filtros, this.curva, id => this.nomeSetor(id));
  }

  private itensDaLista(): ItemLista[] {
    return this.itens
      .filter(i => this.selecionados.has(i.id) && this.quantidade(i) > 0)
      .map(i => ({
        nome: i.nome,
        codigoBarra: i.codigoBarra ?? null,
        setor: this.nomeSetor(i.setorFilhoId),
        quantidade: this.quantidade(i),
        custo: i.precoCusto || 0,
      }));
  }

  private selecaoMudou(): void {
    const itens = this.itensDaLista();
    this.resumo = {
      produtos: itens.length,
      unidades: itens.reduce((s, i) => s + i.quantidade, 0),
      valor: itens.reduce((s, i) => s + i.quantidade * i.custo, 0),
    };
    this.guardarSelecao();
  }

  private mostrarAviso(texto: string): void {
    this.aviso = texto;
    if (this.avisoTimer) clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(() => (this.aviso = ''), 4000);
  }

  private get chaveSelecao(): string {
    return `listaCompra.${this.lojaId}`;
  }

  private guardarSelecao(): void {
    try {
      sessionStorage.setItem(this.chaveSelecao, JSON.stringify({
        selecionados: [...this.selecionados],
        digitadas: [...this.digitadas],
      }));
    } catch {
      // sem armazenamento: a selecao vale so enquanto a tela estiver aberta
    }
  }

  /** Volta a selecao da ultima visita (nesta aba), sem os produtos que sairam do quadro. */
  private restaurarSelecao(): void {
    try {
      const salvo = JSON.parse(sessionStorage.getItem(this.chaveSelecao) ?? 'null');
      if (!salvo) return;
      const ids = new Set(this.itens.map(i => i.id));
      this.digitadas = new Map((salvo.digitadas ?? []).filter(([id, v]: [number, number]) => ids.has(id) && Number.isFinite(v)));
      this.selecionados = new Set((salvo.selecionados ?? []).filter((id: number) => ids.has(id)));
    } catch {
      // idem
    }
    for (const id of [...this.selecionados]) {
      const item = this.itens.find(i => i.id === id);
      if (!item || this.quantidade(item) <= 0) this.selecionados.delete(id);
    }
    this.selecaoMudou();
  }
}

/** Plano B quando o navegador nao deixa usar a area de transferencia direto. */
function copiarPorSelecao(texto: string): boolean {
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}
