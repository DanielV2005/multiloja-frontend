// src/app/features/identity/minhas-lojas/minhas-lojas.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  UsuarioService,
  Loja
} from '../../../core/services/usuario.service';
import { AuthStorageService } from '../../../core/services/auth-storage.service';
import { Produto, ProdutoService } from '../../../core/services/produto.service';
import { SetorService } from '../../../core/services/setor.service';

import {
  LojaFormDialogComponent,
  LojaFormData
} from './loja-form.dialog';

import { LojasDesativadasDialogComponent } from './lojas-desativadas.dialog';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog.component';

@Component({
  standalone: true,
  selector: 'app-minhas-lojas',
  imports: [CommonModule, MatDialogModule],
  template: `
  <section class="page">
    <header class="topbar">
      <h2>Minhas Lojas</h2>
      <button class="link" (click)="logout()" aria-label="Sair">
        <span class="material-symbols-outlined">logout</span>
      </button>
    </header>

    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar__title">Lojas</div>

        <!-- loading -->
        <ul class="store-list" *ngIf="loading">
          <li *ngFor="let _ of skeleton">
            <div class="skeleton-row"></div>
          </li>
        </ul>

        <!-- lista -->
        <ul class="store-list" *ngIf="!loading">
          <li *ngFor="let l of lojas">
            <div class="store-row" [class.active]="l.id === selectedId">
              <div class="store-pill"
                   #pillEl
                   (mouseenter)="setScrollable(pillEl, nameEl)"
                   (mouseleave)="clearScrollable(pillEl)"
                   role="button"
                   tabindex="0"
                   [attr.aria-pressed]="l.id===selectedId"
                   (click)="selecionar(l)"
                   (keydown.enter)="selecionar(l)"
                   (keydown.space)="selecionar(l)">
                <span class="avatar" aria-hidden="true">
                  {{ initials(l.nome) }}
                </span>

                <span class="name" #nameEl><span class="name-text">{{ l.nome }}</span></span>

                <div class="row-actions">
                  <!-- ENTRAR NA LOJA -->
                  <button class="icon-btn ok"
                          aria-label="Entrar"
                          title="Entrar na loja"
                          (click)="entrarNaLoja(l); $event.stopPropagation()">
                    <span class="material-symbols-outlined">check</span>
                  </button>

                  <!-- EDITAR -->
                  <button class="icon-btn edit"
                          aria-label="Editar"
                          title="Editar loja"
                          (click)="abrirEdicao(l); $event.stopPropagation()">
                    <span class="material-symbols-outlined">edit</span>
                  </button>

                  <!-- DESATIVAR -->
                  <button class="icon-btn danger"
                          aria-label="Desativar"
                          title="Desativar loja"
                          (click)="desativar(l); $event.stopPropagation()">
                    <span class="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
            </div>
          </li>
        </ul>

        <p class="muted small"
           *ngIf="!loading && lojas.length === 0">
          Nenhuma loja encontrada.
        </p>

        <!-- rodap� com bot�es -->
        <div class="create">
          <button
            class="gold icon-only"
            (click)="abrirCriacao()"
            aria-label="Nova loja"
            title="Nova loja">
            <span class="material-symbols-outlined">add</span>
          </button>

          <button
            class="gold icon-only"
            (click)="abrirLojasDesativadas()"
            aria-label="Lojas desativadas"
            title="Lojas desativadas">
            <span class="material-symbols-outlined">delete_history</span>
          </button>
        </div>
      </aside>

      <!-- coluna da direita (gr�fico geral) -->
      <main class="content">
        <div class="card chart">
          <header class="card__header">
            <div>
              <h3>Consolidado das lojas</h3>
              <small class="muted">estoque e patrimônio somados de todas as lojas</small>
            </div>
          </header>

          <div class="overview-grid" *ngIf="!loadingOverview">
            <article class="metric-card">
              <span class="metric-label">Lojas</span>
              <strong class="metric-value">{{ lojas.length }}</strong>
            </article>

            <article class="metric-card">
              <span class="metric-label">Patrimônio de custo</span>
              <strong class="metric-value">{{ fmtMoney(totalPatrimonioCusto) }}</strong>
            </article>

            <article class="metric-card">
              <span class="metric-label">Patrimônio de venda</span>
              <strong class="metric-value">{{ fmtMoney(totalPatrimonioVenda) }}</strong>
            </article>

            <article class="metric-card">
              <span class="metric-label">Produtos em estoque</span>
              <strong class="metric-value">{{ totalQuantidadeProdutos }}</strong>
            </article>

            <article class="metric-card">
              <span class="metric-label">Lucro potencial</span>
              <strong class="metric-value">{{ fmtMoney(totalLucroPotencial) }}</strong>
            </article>

            <article class="metric-card">
              <span class="metric-label">Setores encontrados</span>
              <strong class="metric-value">{{ setoresConsolidados.length }}</strong>
            </article>
          </div>

          <div class="panel-loading" *ngIf="loadingOverview">
            <div class="spinner"></div>
            <span>Somando dados das lojas...</span>
          </div>

          <div class="panel-error muted" *ngIf="!loadingOverview && overviewError">
            {{ overviewError }}
          </div>

          <div class="sector-table" *ngIf="!loadingOverview && setoresConsolidados.length">
            <div class="sector-head">
              <span>Setor</span>
              <span class="num">Qtd.</span>
              <span class="num">Patrimônio custo</span>
              <span class="num">Patrimônio venda</span>
              <span class="num">Lucro potencial</span>
            </div>

            <div class="sector-row" *ngFor="let setor of setoresConsolidados">
              <span class="sector-name">{{ setor.nome }}</span>
              <span class="num">{{ setor.quantidade }}</span>
              <span class="num">{{ fmtMoney(setor.custoTotal) }}</span>
              <span class="num">{{ fmtMoney(setor.vendaTotal) }}</span>
              <span class="num">{{ fmtMoney(setor.lucroTotal) }}</span>
            </div>
          </div>

          <p class="panel-empty muted" *ngIf="!loadingOverview && !overviewError && !setoresConsolidados.length">
            Nenhum produto encontrado nas lojas.
          </p>
        </div>
      </main>
    </div>
  </section>
  `,
  styles: [`
    .material-symbols-outlined{
      font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
    }

    :host{
      --ok-rgb: 52,211,153;
      --edit-rgb: 250,204,21;
      --danger-rgb: 239,68,68;
    }

    .page{
      min-height:100dvh;
      padding:20px 18px;
      background: var(--bg);
      color: var(--text);
    }

    .topbar{
      display:flex;
      align-items:center;
      justify-content:space-between;
      margin: 4px 0 14px;
    }

    .link{
      display:inline-flex;
      align-items:center;
      gap:6px;
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 10px;
      height: 36px;
      padding: 0 12px;
      cursor: pointer;
    }
    .link:hover{
      background: rgba(127,127,127,.08);
    }

    .layout{
      display:grid;
      gap:20px;
      grid-template-columns: 340px 1fr;
    }
    @media (max-width: 980px){
      .layout{ grid-template-columns: 1fr; }
    }

    .sidebar{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 14px;
      display:flex;
      flex-direction: column;
      min-height: calc(100dvh - 120px);
    }

    .sidebar__title{
      font-weight: 600;
      margin: 6px 4px 12px;
    }

    .store-list{
      list-style:none;
      margin:0;
      padding:0;
      display:grid;
      gap:8px;
    }
    .store-list li{
      min-width:0;
    }

    .store-row{
      width:100%;
      overflow:hidden;
    }


    .store-pill{
      display:flex;
      align-items:center;
      gap:12px;
      height:52px;
      padding:0 10px;
      border:1px solid var(--border);
      border-radius:12px;
      background:transparent;
      color:var(--text);
      cursor:pointer;
      transition: background .15s, border-color .15s, box-shadow .2s;
      width:100%;
      overflow:hidden;
      box-sizing:border-box;
    }

    .store-row.active .store-pill{
      border-color: var(--primary);
      background: rgba(240,210,122,.08);
    }

    .store-pill:hover{
      background: rgba(127,127,127,.06);
      border-color: var(--primary);
      box-shadow: var(--focus);
    }

    .row-actions{
      margin-left:auto;
      display:flex;
      align-items:center;
      gap:8px;
      opacity:.95;

      flex-shrink:0;
    }
    .store-pill:hover .row-actions{
      opacity:1;
    }

    .icon-btn{
      width:36px;
      height:36px;
      display:grid;
      place-items:center;
      border:1px solid var(--border);
      border-radius:10px;
      background:transparent;
      color:var(--muted);
      cursor:pointer;
      transition: background .15s, border-color .15s,
                  color .15s, transform .05s;
    }

    .icon-btn .material-symbols-outlined{
      font-size:22px;
      line-height:1;
      color: currentColor;
    }

    .icon-btn:hover{
      background: rgba(127,127,127,.08);
      color: var(--text);
      border-color:#cfcfd4;
    }
    .icon-btn:active{
      transform: translateY(1px);
    }

    .icon-btn.ok{
      color: rgb(var(--ok-rgb));
      border-color: rgba(var(--ok-rgb), .35);
    }
    .icon-btn.ok:hover{
      background: rgba(var(--ok-rgb), .12);
      border-color: rgba(var(--ok-rgb), .60);
      color: rgb(var(--ok-rgb));
    }

    .icon-btn.edit{
      color: rgb(var(--edit-rgb));
      border-color: rgba(var(--edit-rgb), .35);
    }
    .icon-btn.edit:hover{
      background: rgba(var(--edit-rgb), .12);
      border-color: rgba(var(--edit-rgb), .60);
      color: rgb(var(--edit-rgb));
    }

    .icon-btn.danger{
      color: rgb(var(--danger-rgb));
      border-color: rgba(var(--danger-rgb), .35);
    }
    .icon-btn.danger:hover{
      background: rgba(var(--danger-rgb), .10);
      border-color: rgba(var(--danger-rgb), .60);
      color: rgb(var(--danger-rgb));
    }

    .avatar{
      width:32px;
      height:32px;
      border-radius: 8px;
      display:grid;
      place-items:center;
      font-weight:700;
      font-size:.9rem;
      color:#151515;
      background: linear-gradient(180deg, rgba(255,255,255,.35), transparent 40%),
                  linear-gradient(135deg, #F5D97A 0%, #D4AF37 45%, #B8860B 100%);
      box-shadow: 0 4px 14px rgba(212,175,55,.25);

      flex-shrink:0;
    }

    .name{
      flex:1 1 0;
      min-width:0;
      overflow:hidden;
      position:relative;
    }
    .name-text{
      display:inline-block;
      white-space:nowrap;
      padding-right:16px;
      transform:translateX(0);
      max-width:100%;
    }
    .store-pill.scrollable:hover .name-text{
      animation: name-scroll 8s linear infinite;
    }
    @keyframes name-scroll{
      0%{ transform: translateX(0); }
      100%{ transform: translateX(-100%); }
    }
    .skeleton-row{
      height:44px;
      border-radius:12px;
      border:1px solid var(--border);
      background: linear-gradient(90deg,
                    rgba(255,255,255,.06),
                    rgba(255,255,255,.15),
                    rgba(255,255,255,.06));
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }

    @keyframes shimmer{
      to { background-position: -200% 0; }
    }

    .card{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 16px 16px 18px;
    }

    .card__header{
      display:flex;
      align-items:baseline;
      gap:10px;
      margin-bottom:12px;
    }

    .chart{ min-height: 420px; }

    .overview-grid{
      display:grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap:12px;
      margin-bottom:16px;
    }

    .metric-card{
      border:1px solid var(--border);
      border-radius:14px;
      padding:14px;
      background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01));
      min-height:92px;
      display:flex;
      flex-direction:column;
      justify-content:space-between;
    }

    .metric-label{
      color:var(--muted);
      font-size:.84rem;
    }

    .metric-value{
      font-size:1.25rem;
      line-height:1.2;
    }

    .panel-loading,
    .panel-error{
      min-height:220px;
      border:1px dashed var(--border);
      border-radius:14px;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px;
      padding:16px;
    }

    .spinner{
      width:18px;
      height:18px;
      border-radius:50%;
      border:2px solid rgba(255,255,255,.35);
      border-top-color:#fff;
      animation: spin .8s linear infinite;
    }

    @keyframes spin{
      to { transform: rotate(360deg); }
    }

    .sector-table{
      border:1px solid var(--border);
      border-radius:14px;
      overflow:hidden;
      background:#0a1020;
    }

    .sector-head,
    .sector-row{
      display:grid;
      grid-template-columns: minmax(160px, 1.2fr) 90px repeat(3, minmax(120px, 1fr));
      gap:0;
    }

    .sector-head{
      background:rgba(255,255,255,.03);
      color:var(--muted);
      font-size:.78rem;
      text-transform:uppercase;
      letter-spacing:.04em;
    }

    .sector-head span,
    .sector-row span{
      padding:12px 14px;
      border-right:1px solid rgba(148,163,184,.18);
    }

    .sector-head span:last-child,
    .sector-row span:last-child{
      border-right:none;
    }

    .sector-row{
      border-top:1px solid rgba(148,163,184,.18);
    }

    .sector-row:nth-child(even){
      background:rgba(255,255,255,.015);
    }

    .sector-name{
      font-weight:600;
    }

    .num{
      text-align:right;
      font-variant-numeric:tabular-nums;
    }

    .muted{ color: var(--muted); }

    .create{
      margin-top:auto;
      padding-top:12px;
      border-top:1px solid var(--border);
      display:flex;
      gap:10px;
    }

    .gold{
      position: relative;
      overflow: hidden;
      isolation: isolate;
      height: 44px;
      border-radius: 12px;
      border: 1px solid #9e7b14;
      color: #151515;
      background: radial-gradient(120% 100% at 50% -40%,
                    rgba(255,255,255,.20), transparent 60%),
                  linear-gradient(180deg, #F5DF7B 0%,
                    var(--primary) 55%, var(--primary-600) 100%);
      box-shadow: 0 10px 26px rgba(218,171,31,.40),
                  inset 0 -2px 0 rgba(0,0,0,.18);
      cursor: pointer;
      padding: 0 14px;
      font-weight: 600;
      transition: transform .05s ease,
                  box-shadow .2s,
                  filter .2s,
                  background .2s;
      flex:1;
    }

    .gold:hover{
      background: radial-gradient(120% 100% at 50% -40%,
                    rgba(255,255,255,.28), transparent 60%),
                  linear-gradient(180deg,
                    #F9E992 0%, #E3BD43 55%, #BE8E1A 100%);
    }

    .icon-only span{ font-size: 28px; }

    .panel-empty{
      margin:0;
      min-height:180px;
      display:grid;
      place-items:center;
      border:1px dashed var(--border);
      border-radius:14px;
    }

    @media (max-width: 1180px){
      .overview-grid{
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 900px){
      .overview-grid{
        grid-template-columns: 1fr;
      }

      .sector-table{
        overflow:auto;
      }

      .sector-head,
      .sector-row{
        min-width:720px;
      }
    }
  `]
})
export class MinhasLojasComponent implements OnInit {
  private api    = inject(UsuarioService);
  private produtosApi = inject(ProdutoService);
  private setorApi = inject(SetorService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private auth   = inject(AuthStorageService);

  lojas: Loja[] = [];
  loading = true;
  loadingOverview = true;
  overviewError = '';
  selectedId: number | null = null;

  skeleton = Array.from({ length: 6 });
  setoresConsolidados: SetorConsolidado[] = [];
  totalQuantidadeProdutos = 0;
  totalPatrimonioCusto = 0;
  totalPatrimonioVenda = 0;
  totalLucroPotencial = 0;

  ngOnInit(): void {
    this.recarregar();
  }

  recarregar(selectId?: number){
    this.loading = true;

    this.api.minhasLojas().subscribe({
      next: r => {
        this.lojas = r || [];
        if (selectId != null) {
          this.selectedId = selectId;
        }
        void this.carregarConsolidado();
        this.loading = false;
      },
      error: err => {
        console.error('Erro ao carregar lojas', err);
        this.lojas = [];
        this.loadingOverview = false;
        this.overviewError = 'Não foi possível carregar o consolidado das lojas.';
        this.loading = false;

        if (err?.status === 401) {
          alert('Sessão expirada. Faça login novamente.');
          this.auth.clear();
          this.router.navigateByUrl('/login');
        }
      }
    });
  }

  initials(nome: string){
    if (!nome) return 'LJ';
    const p = nome.trim().split(/\s+/);
    return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
  }

  // S� marca sele��o no backend e visualmente
  selecionar(l: Loja){
    if (l?.id == null || Number.isNaN(+l.id)) {
      console.warn('Loja sem id v�lido:', l);
      return;
    }

    this.selectedId = l.id;
    this.api.selecionarLoja(l.id).subscribe({
      error: err => console.warn('Falha ao registrar sele��o da loja (mas ignoro):', err)
    });
  }

  // Marca sele��o E navega para o painel
  entrarNaLoja(l: Loja){
    if (l?.id == null || Number.isNaN(+l.id)) return;

    this.selectedId = l.id;

    this.api.selecionarLoja(l.id).subscribe({
      next: _ => this.router.navigate(['/loja', l.id]),
      error: err => {
        console.warn('Erro ao selecionar loja no backend, indo mesmo assim...', err);
        this.router.navigate(['/loja', l.id]);
      }
    });
  }

  setScrollable(pill: HTMLElement, name: HTMLElement){
    if (!pill || !name) return;
    if (name.scrollWidth > name.clientWidth) {
      pill.classList.add('scrollable');
    } else {
      pill.classList.remove('scrollable');
    }
  }

  clearScrollable(pill: HTMLElement){
    pill?.classList.remove('scrollable');
  }

  abrirCriacao(){
    const data: LojaFormData = { mode: 'create' };
    this.dialog.open(LojaFormDialogComponent, { data, autoFocus: false })
      .afterClosed()
      .subscribe((id?: number) => {
        if (!id) return;
        this.recarregar(id);
      });
  }

  abrirEdicao(l: Loja){
    if (l?.id == null) {
      alert('Loja sem id.');
      return;
    }

    const data: LojaFormData = { mode: 'edit', loja: l };
    this.dialog.open(LojaFormDialogComponent, { data, autoFocus: false })
      .afterClosed()
      .subscribe((id?: number) => {
        if (!id) return;
        this.recarregar(id);
      });
  }
  abrirLojasDesativadas(){
    this.dialog
      .open(LojasDesativadasDialogComponent, { autoFocus: false })
      .afterClosed()
      .subscribe(() => {
        // Sempre recarrega as lojas ao fechar o dialog
        this.recarregar(this.selectedId ?? undefined);
      });
  }

  desativar(l: Loja){
    if (l?.id == null) {
      alert('Loja sem id.');
      return;
    }
    this.dialog.open(ConfirmDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Desativar loja',
        message: `Desativar a loja "${l.nome}"?`,
        confirmText: 'Sim',
        cancelText: 'Nao',
      },
    }).afterClosed().subscribe((confirmou: boolean | undefined) => {
      if (!confirmou) return;

      this.api.desativarLoja(l.id).subscribe({
        next: () => {
          this.lojas = this.lojas.filter(x => x.id !== l.id);
          if (this.selectedId === l.id) this.selectedId = null;
        },
        error: _ => alert('Não foi possível desativar a loja.')
      });
    });
  }

  private async carregarConsolidado(): Promise<void> {
    this.loadingOverview = true;
    this.overviewError = '';
    this.setoresConsolidados = [];
    this.totalQuantidadeProdutos = 0;
    this.totalPatrimonioCusto = 0;
    this.totalPatrimonioVenda = 0;
    this.totalLucroPotencial = 0;

    if (!this.lojas.length) {
      this.loadingOverview = false;
      return;
    }

    const requests = this.lojas.map(loja =>
      this.produtosApi.listarPorLoja(loja.id).pipe(
        catchError(err => {
          console.error(`[MinhasLojas] erro ao carregar produtos da loja ${loja.id}`, err);
          return of([]);
        })
      )
    );

    try {
      const respostas = await firstValueFrom(forkJoin(requests));
      const setorMaps = await this.carregarMapasDeSetores(respostas);
      const mapa = new Map<string, SetorConsolidado>();

      respostas.forEach((lista, index) => {
        const lojaId = this.lojas[index]?.id ?? 0;
        const setorMap = setorMaps.get(lojaId) ?? new Map<number, string>();

        (lista ?? []).forEach(produto => {
          const setorId = Number((produto as any)?.setorFilhoId ?? 0);
          const nome = this.resolverNomeSetor(produto, setorId, setorMap);
          const chave = this.normalizarChaveSetor(nome, setorId);
          const quantidade = this.toNumber((produto as any)?.quantidade);
          const custoUnitario = this.toNumber((produto as any)?.precoCusto);
          const vendaUnitario = this.toNumber((produto as any)?.precoVenda);
          const custoTotal = custoUnitario * quantidade;
          const vendaTotal = vendaUnitario * quantidade;
          const lucroTotal = vendaTotal - custoTotal;

          this.totalQuantidadeProdutos += quantidade;
          this.totalPatrimonioCusto += custoTotal;
          this.totalPatrimonioVenda += vendaTotal;
          this.totalLucroPotencial += lucroTotal;

          const atual = mapa.get(chave) ?? {
            setorId,
            nome,
            quantidade: 0,
            custoTotal: 0,
            vendaTotal: 0,
            lucroTotal: 0,
          };

          atual.quantidade += quantidade;
          atual.custoTotal += custoTotal;
          atual.vendaTotal += vendaTotal;
          atual.lucroTotal += lucroTotal;
          if ((!atual.nome || atual.nome.startsWith('Setor ')) && nome) {
            atual.nome = nome;
          }

          mapa.set(chave, atual);
        });
      });

      this.setoresConsolidados = Array.from(mapa.values())
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
      this.loadingOverview = false;
    } catch (err) {
      console.error('[MinhasLojas] erro ao consolidar lojas', err);
      this.overviewError = 'Não foi possível consolidar os dados das lojas.';
      this.loadingOverview = false;
    }
  }

  private async carregarMapasDeSetores(respostas: Produto[][]): Promise<Map<number, Map<number, string>>> {
    const resultado = new Map<number, Map<number, string>>();
    const lojasComIdsFaltando = new Set<number>();

    respostas.forEach((lista, index) => {
      const lojaId = this.lojas[index]?.id ?? 0;
      if (!lojaId) return;

      const faltando = (lista ?? []).some(produto => {
        const setorId = Number((produto as any)?.setorFilhoId ?? 0);
        if (setorId <= 0) return false;
        const nome = this.resolverNomeSetor(produto, setorId);
        return nome === `Setor ${setorId}`;
      });

      if (faltando) {
        lojasComIdsFaltando.add(lojaId);
      }
    });

    if (!lojasComIdsFaltando.size) {
      return resultado;
    }

    const originalToken = this.auth.token;
    try {
      for (const lojaId of lojasComIdsFaltando) {
        try {
          await firstValueFrom(this.api.selecionarLoja(lojaId));
          const setores = await firstValueFrom(
            this.setorApi.listar().pipe(
              catchError(err => {
                console.error(`[MinhasLojas] erro ao carregar setores da loja ${lojaId}`, err);
                return of([]);
              })
            )
          );
          const mapa = new Map<number, string>();
          (setores ?? []).forEach(setor => {
            if (setor?.id != null && setor?.nome) {
              mapa.set(Number(setor.id), String(setor.nome));
            }
          });
          resultado.set(lojaId, mapa);
        } catch (err) {
          console.error(`[MinhasLojas] erro ao resolver nomes de setores da loja ${lojaId}`, err);
        }
      }
    } finally {
      if (originalToken) {
        this.auth.setToken(originalToken);
      }
    }

    return resultado;
  }

  private resolverNomeSetor(produto: Produto, setorId: number, setorMap?: Map<number, string>): string {
    const anyProduto = produto as any;
    const nome =
      anyProduto?.setorNome ??
      anyProduto?.nomeSetor ??
      anyProduto?.setorFilhoNome ??
      anyProduto?.setor?.nome ??
      anyProduto?.setorFilho?.nome ??
      setorMap?.get(setorId);

    if (typeof nome === 'string' && nome.trim()) {
      return nome.trim();
    }

    return setorId > 0 ? `Setor ${setorId}` : 'Sem setor';
  }

  private normalizarChaveSetor(nome: string, setorId: number): string {
    const texto = (nome ?? '').trim().toLocaleLowerCase('pt-BR');
    if (texto && !texto.startsWith('setor ')) {
      return texto;
    }
    return `id:${setorId}`;
  }

  private toNumber(value: unknown): number {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  fmtMoney(value: number | null | undefined): string {
    const n = this.toNumber(value);
    return n.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  logout(){
    this.auth.clear();
    this.router.navigateByUrl('/login');
  }
}

interface SetorConsolidado {
  setorId: number;
  nome: string;
  quantidade: number;
  custoTotal: number;
  vendaTotal: number;
  lucroTotal: number;
}










