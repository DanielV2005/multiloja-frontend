// src/app/features/identity/minhas-lojas/minhas-lojas.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';

import {
  UsuarioService,
  Loja,
  NovaLoja
} from '../../../core/services/usuario.service';
import { AuthStorageService } from '../../../core/services/auth-storage.service';

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
            <h3>Lucros Totais</h3>
            <small class="muted">todas as lojas � em breve</small>
          </header>

          <div class="chart-placeholder"
               role="img"
               aria-label="Gr�fico de lucros (em breve)">
            <div class="spark"></div>
            <div class="grid"><div *ngFor="let _ of gridCols"></div></div>
            <div class="legend muted">
              �rea reservada para gr�fico (Chart.js/Recharts/NGX-Charts)
            </div>
          </div>
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

    .chart-placeholder{
      position: relative;
      height: 360px;
      border: 1px dashed var(--border);
      border-radius: 14px;
      display:grid;
      place-items:center;
      overflow:hidden;
      background: radial-gradient(900px 500px at 100% 0,
                    rgba(99,102,241,.05), transparent 55%),
                  radial-gradient(900px 500px at 0 100%,
                    rgba(37,99,235,.05), transparent 55%);
    }

    .chart-placeholder .spark{
      position:absolute;
      inset:-20% -10% auto -10%;
      height:120px;
      filter: blur(18px);
      opacity:.25;
      background: linear-gradient(115deg,
                                  transparent 0%,
                                  #fff 15%,
                                  transparent 30%);
      animation: slide 2.8s ease-in-out infinite;
    }

    @keyframes slide {
      0%{ transform: translateX(-60%);}
      100%{ transform: translateX(160%);}
    }

    .chart-placeholder .grid{
      position:absolute;
      inset:20px;
      display:grid;
      grid-template-columns: repeat(12, 1fr);
      gap:10px;
      opacity:.5;
    }

    .chart-placeholder .grid > div{
      background: rgba(127,127,127,.08);
      border-radius: 10px;
      height: 48%;
    }

    .chart-placeholder .legend{
      position:absolute;
      bottom:12px;
      left:16px;
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
  `]
})
export class MinhasLojasComponent implements OnInit {
  private api    = inject(UsuarioService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private auth   = inject(AuthStorageService);

  lojas: Loja[] = [];
  loading = true;
  selectedId: number | null = null;

  skeleton = Array.from({ length: 6 });
  gridCols = Array.from({ length: 12 });

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
        this.loading = false;
      },
      error: err => {
        console.error('Erro ao carregar lojas', err);
        this.lojas = [];
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

  logout(){
    this.auth.clear();
    this.router.navigateByUrl('/login');
  }
}










