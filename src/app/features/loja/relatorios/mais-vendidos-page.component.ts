// src/app/features/loja/relatorios/mais-vendidos-page.component.ts
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';

import { Loja, UsuarioService } from '../../../core/services/usuario.service';
import { PdvService } from '../../../core/services/pdv.service';
import { ProdutoService, ReposicaoColuna, ReposicaoItemDto } from '../../../core/services/produto.service';
import { SetorService } from '../../../core/services/setor.service';
import { STATUS_VENDIDAS } from '../../../core/services/curva-abc.service';
import { ClasseAbc, textoClasseAbc } from '../../../shared/curva-abc';
import { dataBR } from '../../../shared/datas';
import { formatBRL, formatDecimal } from '../../../shared/format';
import {
  ATALHOS_PERIODO,
  AtalhoPeriodo,
  FILTROS_PADRAO,
  FiltrosRanking,
  LinhaRanking,
  LinhaVisivel,
  ResumoClasse,
  filtrarRanking,
  montarRanking,
  periodoDoAtalho,
  resumirCurva,
} from './mais-vendidos';

const PREFERENCIAS = 'maisVendidos.preferencias';

interface OpcaoSetor {
  id: number;
  nome: string;
  itens: number;
}

/**
 * Mais vendidos do periodo. O PDV soma as vendas por produto; a tela junta com o catalogo (setor, estoque)
 * e filtra na memoria, sem ir ao servidor a cada letra digitada. Periodo, tipo, ordem e "top" ficam salvos.
 */
@Component({
  standalone: true,
  selector: 'app-mais-vendidos-page',
  imports: [CommonModule, RouterLink],
  styleUrls: ['./relatorio-pagina.css'],
  template: `
  <section class="page">
    <header class="topbar">
      <a class="link" [routerLink]="['/loja', lojaId]">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>Voltar para o painel</span>
      </a>
      <div class="title">
        <h2>Mais vendidos</h2>
        <small class="muted" *ngIf="loja">{{ loja.nome }}</small>
      </div>
      <span class="spacer"></span>
    </header>

    <main class="card">
      <div class="linha-filtros" role="group" aria-label="Período">
        <span class="rotulo">Período</span>
        <button
          *ngFor="let a of atalhos"
          type="button"
          class="chip"
          [class.ativo]="atalho === a.id"
          (click)="escolherAtalho(a.id)"
        >{{ a.rotulo }}</button>
        <button type="button" class="chip" [class.ativo]="atalho === 'datas'" (click)="abrirDatas()">Escolher datas</button>
      </div>

      <div class="linha-filtros" *ngIf="atalho === 'datas'">
        <input class="campo" type="date" aria-label="De" [value]="dataInicio" (change)="dataInicio = $any($event.target).value" />
        <span class="muted">até</span>
        <input class="campo" type="date" aria-label="Até" [value]="dataFim" (change)="dataFim = $any($event.target).value" />
        <button type="button" class="btn" (click)="aplicarDatas()">Aplicar</button>
        <span class="erro-datas" *ngIf="erroDatas">{{ erroDatas }}</span>
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
          <option *ngFor="let s of opcoesSetor" [value]="s.id">{{ s.nome }} ({{ s.itens }})</option>
        </select>
        <select class="campo" aria-label="Quantos mostrar" [value]="filtros.limite ?? ''" (change)="mudarLimite($any($event.target).value)">
          <option value="20">Top 20</option>
          <option value="50">Top 50</option>
          <option value="100">Top 100</option>
          <option value="">Todos</option>
        </select>
      </div>

      <div class="linha-filtros">
        <span class="rotulo">Mostrar</span>
        <button type="button" class="chip" [class.ativo]="filtros.tipo === 'PRODUTO'" (click)="mudar({ tipo: 'PRODUTO' })">Produtos</button>
        <button type="button" class="chip" [class.ativo]="filtros.tipo === 'SERVICO'" (click)="mudar({ tipo: 'SERVICO' })">Serviços</button>
        <button type="button" class="chip" [class.ativo]="filtros.tipo === 'TODOS'" (click)="mudar({ tipo: 'TODOS' })">Tudo</button>
        <span class="separador"></span>
        <span class="rotulo">Ordenar por</span>
        <button type="button" class="chip" [class.ativo]="filtros.ordem === 'quantidade'" (click)="mudar({ ordem: 'quantidade' })">Unidades</button>
        <button type="button" class="chip" [class.ativo]="filtros.ordem === 'faturamento'" (click)="mudar({ ordem: 'faturamento' })">Faturamento</button>
      </div>

      <div class="linha-filtros curva" *ngIf="!carregando && !erro && linhas.length">
        <span class="rotulo" title="Curva ABC pelo faturamento do período">Curva ABC</span>
        <button
          *ngFor="let c of curva"
          type="button"
          class="chip curva__classe"
          [class.ativo]="filtros.classe === c.classe"
          [title]="dicaClasse(c.classe)"
          (click)="mudar({ classe: filtros.classe === c.classe ? null : c.classe })"
        >
          <span class="abc" [attr.data-classe]="c.classe">{{ c.classe }}</span>
          {{ c.itens }} {{ c.itens === 1 ? 'item' : 'itens' }} · {{ pct(c.percentual) }} do faturamento
        </button>
      </div>

      <p class="estado" *ngIf="carregando">Carregando vendas de {{ textoPeriodo }}...</p>
      <div class="estado erro" *ngIf="!carregando && erro">
        {{ erro }}
        <button type="button" class="btn" (click)="carregar()">Tentar de novo</button>
      </div>
      <p class="estado" *ngIf="!carregando && !erro && !resultado.linhas.length">
        {{ linhas.length ? 'Nenhum item com esses filtros.' : 'Nenhuma venda em ' + textoPeriodo + '.' }}
      </p>

      <div class="tabela-wrap" *ngIf="!carregando && !erro && resultado.linhas.length">
        <table class="tabela">
          <thead>
            <tr>
              <th class="num">#</th>
              <th>Produto</th>
              <th>Setor</th>
              <th class="num ordenavel" [class.ativo]="filtros.ordem === 'quantidade'" (click)="mudar({ ordem: 'quantidade' })">Qtd. vendida</th>
              <th class="num ordenavel" [class.ativo]="filtros.ordem === 'faturamento'" (click)="mudar({ ordem: 'faturamento' })">Faturamento</th>
              <th class="num">% do total</th>
              <th class="centro">Curva</th>
              <th class="num">Estoque</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let l of resultado.linhas; trackBy: trackLinha">
              <td class="num muted">{{ l.posicao }}</td>
              <td>
                <div class="nome">{{ l.nome }}</div>
                <small class="muted" *ngIf="l.codigoBarra">{{ l.codigoBarra }}</small>
              </td>
              <td>{{ nomeSetor(l.setorId) }}</td>
              <td class="num">{{ fmtQtd(l.quantidade) }}</td>
              <td class="num">{{ fmtMoney(l.total) }}</td>
              <td class="num muted">{{ pct(l.percentual) }}</td>
              <td class="centro"><span class="abc" [attr.data-classe]="l.classe" [title]="dicaClasse(l.classe)">{{ l.classe }}</span></td>
              <td class="num">
                <span *ngIf="l.estoque != null" class="situacao" [attr.data-coluna]="l.coluna" [title]="dicaEstoque(l)">{{ fmtQtd(l.estoque) }}</span>
                <span *ngIf="l.estoque == null" class="muted">{{ l.tipo === 'SERVICO' ? '—' : 'inativo' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="rodape muted" *ngIf="!carregando && !erro && resultado.linhas.length">
        Mostrando {{ resultado.linhas.length }} de {{ resultado.encontrados }} · {{ textoPeriodo }} ·
        {{ fmtQtd(resultado.quantidade) }} {{ resultado.quantidade === 1 ? 'unidade' : 'unidades' }} ·
        {{ fmtMoney(resultado.total) }}
      </footer>
    </main>
  </section>
  `,
  styles: [`
    .separador { width: 1px; height: 22px; background: var(--border); margin: 0 4px; }
    .curva__classe { display: inline-flex; align-items: center; gap: 6px; }
    .erro-datas { color: #f87171; font-size: .85rem; }
    .rodape { font-size: .85rem; }
  `],
})
export class MaisVendidosPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private usuarios = inject(UsuarioService);
  private pdv = inject(PdvService);
  private produtos = inject(ProdutoService);
  private setores = inject(SetorService);

  readonly atalhos = ATALHOS_PERIODO;

  lojaId = 0;
  loja: Loja | null = null;
  atalho: AtalhoPeriodo | 'datas' = '30d';
  dataInicio = '';
  dataFim = '';
  erroDatas = '';
  carregando = true;
  erro = '';
  filtros: FiltrosRanking = { ...FILTROS_PADRAO };

  linhas: LinhaRanking[] = [];
  resultado = filtrarRanking([], FILTROS_PADRAO);
  curva: ResumoClasse[] = [];
  opcoesSetor: OpcaoSetor[] = [];

  private catalogo: ReposicaoItemDto[] = [];
  private nomesSetor = new Map<number, string>();
  private pedidos$ = new Subject<{ inicio: string; fim: string }>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.lojaId = Number(this.route.snapshot.paramMap.get('id')) || 0;
    this.lerPreferencias();
    const periodo = periodoDoAtalho(this.atalho === 'datas' ? '30d' : this.atalho);
    this.dataInicio = periodo.inicio;
    this.dataFim = periodo.fim;

    this.usuarios.loja(this.lojaId).subscribe({
      next: loja => (this.loja = loja ?? null),
      error: () => (this.loja = null),
    });

    // Catalogo e setores uma vez so; as vendas a cada periodo (o pedido novo cancela o anterior)
    const apoio$ = forkJoin({
      catalogo: this.produtos.listarReposicao().pipe(catchError(() => of(null))),
      setores: this.setores.listar().pipe(catchError(() => of([]))),
    });
    apoio$.pipe(takeUntil(this.destroy$)).subscribe(({ catalogo, setores }) => {
      this.catalogo = catalogo?.itens ?? [];
      this.nomesSetor = new Map(setores.map(s => [s.id, s.nome]));
      this.pedidos$
        .pipe(
          switchMap(p => this.pdv.listItemSummary(p.inicio, p.fim, STATUS_VENDIDAS).pipe(catchError(() => of(null)))),
          takeUntil(this.destroy$)
        )
        .subscribe(resumo => {
          this.carregando = false;
          if (!resumo) {
            this.erro = 'Não foi possível carregar as vendas.';
            this.linhas = [];
          } else {
            this.erro = '';
            this.linhas = montarRanking(resumo, this.catalogo);
          }
          this.atualizarOpcoesSetor();
          this.aplicar();
        });
      this.carregar();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get textoPeriodo(): string {
    return this.dataInicio === this.dataFim
      ? dataBR(this.dataInicio)
      : `${dataBR(this.dataInicio)} a ${dataBR(this.dataFim)}`;
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.pedidos$.next({ inicio: this.dataInicio, fim: this.dataFim });
  }

  escolherAtalho(atalho: AtalhoPeriodo): void {
    this.atalho = atalho;
    this.erroDatas = '';
    const p = periodoDoAtalho(atalho);
    this.dataInicio = p.inicio;
    this.dataFim = p.fim;
    this.salvarPreferencias();
    this.carregar();
  }

  abrirDatas(): void {
    this.atalho = 'datas';
  }

  aplicarDatas(): void {
    if (!this.dataInicio || !this.dataFim) {
      this.erroDatas = 'Escolha as duas datas.';
      return;
    }
    if (this.dataInicio > this.dataFim) {
      this.erroDatas = 'A data inicial é depois da final.';
      return;
    }
    this.erroDatas = '';
    this.carregar();
  }

  mudar(parte: Partial<FiltrosRanking>): void {
    this.filtros = { ...this.filtros, ...parte };
    if ('tipo' in parte || 'ordem' in parte) this.salvarPreferencias();
    if ('tipo' in parte) this.atualizarOpcoesSetor();
    this.aplicar();
  }

  mudarSetor(valor: string): void {
    this.mudar({ setorId: valor ? Number(valor) : null });
  }

  mudarLimite(valor: string): void {
    this.mudar({ limite: valor ? Number(valor) : null });
    this.salvarPreferencias();
  }

  nomeSetor(id: number | null): string {
    if (id == null) return '—';
    return this.nomesSetor.get(id) ?? '—';
  }

  dicaClasse(classe: ClasseAbc): string {
    return textoClasseAbc(classe);
  }

  dicaEstoque(l: LinhaRanking): string {
    const textos: Partial<Record<ReposicaoColuna, string>> = {
      SEM_ESTOQUE: 'Sem estoque',
      REPOR: 'Abaixo do mínimo: repor',
      ATENCAO: 'Atenção: abaixo do meio ou acaba em menos de 2 semanas',
      OK: 'Estoque em dia',
      EXCESSO: 'Acima do máximo',
    };
    return (l.coluna && textos[l.coluna]) || 'Estoque atual';
  }

  pct(v: number): string {
    return `${formatDecimal(v * 100, 0, 1)}%`;
  }

  fmtQtd(v: number): string {
    return formatDecimal(v, 0, 3);
  }

  fmtMoney(v: number): string {
    return formatBRL(v);
  }

  trackLinha(_: number, l: LinhaVisivel): string {
    return l.chave;
  }

  private aplicar(): void {
    this.resultado = filtrarRanking(this.linhas, this.filtros);
    this.curva = resumirCurva(this.linhas, this.filtros.tipo);
  }

  /** So os setores que tem algo vendido no periodo (e no tipo escolhido), com quantos itens. */
  private atualizarOpcoesSetor(): void {
    const contagem = new Map<number, number>();
    for (const l of this.linhas) {
      if (l.setorId == null || (this.filtros.tipo !== 'TODOS' && l.tipo !== this.filtros.tipo)) continue;
      contagem.set(l.setorId, (contagem.get(l.setorId) ?? 0) + 1);
    }
    this.opcoesSetor = [...contagem]
      .map(([id, itens]) => ({ id, nome: this.nomesSetor.get(id) ?? `Setor ${id}`, itens }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (this.filtros.setorId != null && !contagem.has(this.filtros.setorId)) {
      this.filtros = { ...this.filtros, setorId: null };
    }
  }

  private lerPreferencias(): void {
    try {
      const salvo = JSON.parse(localStorage.getItem(PREFERENCIAS) ?? 'null');
      if (!salvo) return;
      if (ATALHOS_PERIODO.some(a => a.id === salvo.atalho)) this.atalho = salvo.atalho;
      if (['PRODUTO', 'SERVICO', 'TODOS'].includes(salvo.tipo)) this.filtros.tipo = salvo.tipo;
      if (['quantidade', 'faturamento'].includes(salvo.ordem)) this.filtros.ordem = salvo.ordem;
      if (salvo.limite === null || [20, 50, 100].includes(salvo.limite)) this.filtros.limite = salvo.limite;
    } catch {
      // sem armazenamento (aba anonima, bloqueado): fica no padrao
    }
  }

  private salvarPreferencias(): void {
    try {
      localStorage.setItem(PREFERENCIAS, JSON.stringify({
        atalho: this.atalho === 'datas' ? undefined : this.atalho,
        tipo: this.filtros.tipo,
        ordem: this.filtros.ordem,
        limite: this.filtros.limite,
      }));
    } catch {
      // idem
    }
  }
}
