// src/app/features/loja/setores/setores-dialog.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';

import {
  SetorService,
  Setor
} from '../../../core/services/setor.service';
import { ProdutoService } from '../../../core/services/produto.service';

import {
  SetorFormDialogComponent,
  SetorFormData
} from './setor-form.dialog';

import { SetoresDesativadosDialogComponent } from './setores-desativados.dialog';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog.component';

@Component({
  standalone: true,
  selector: 'app-setores-dialog',
  imports: [CommonModule, MatDialogModule],
  template: `
  <div class="dialog-card">
    <header class="dialog-header">
      <div class="avatar">
        <span class="material-symbols-outlined">category</span>
      </div>
      <div class="header-text">
        <h2>Setores da loja</h2>
        <p class="subtitle">
          Gerencie os setores (ex.: Vendas, Estoque, Financeiro...)
        </p>
      </div>
    </header>

    <!-- LISTA -->
    <section class="body">
      <ng-container *ngIf="setores.length; else empty">
        <div class="list">
          <div class="row" *ngFor="let s of setores">
            <div class="info">
              <div class="name">{{ s.nome }}</div>
              <div class="desc muted" *ngIf="s.descricao">{{ s.descricao }}</div>
            </div>

            <div class="actions">
              <button class="icon-btn edit" (click)="editar(s)">
                <span class="material-symbols-outlined">edit</span>
              </button>

              <button class="icon-btn danger" (click)="desativar(s)">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>
        </div>
      </ng-container>

      <ng-template #empty>
        <div class="empty">
          <div class="empty-icon">
            <span class="material-symbols-outlined">symmetry</span>
          </div>
          <p class="empty-title">Nenhum setor cadastrado ainda.</p>
          <p class="empty-text">
            Use o botão <strong>Novo setor</strong> para começar a organizar sua loja.
          </p>
        </div>
      </ng-template>
    </section>

    <!-- RODAPÉ -->
    <footer class="footer">
      <button class="btn btn-outline" (click)="abrirDesativados()">
        <span class="material-symbols-outlined">delete_history</span>
        <span>Setores desativados</span>
      </button>

      <button class="btn btn-gold" (click)="novo()">
        <span class="material-symbols-outlined">add</span>
        <span>Novo setor</span>
      </button>
    </footer>
  </div>
  `,
  styles: [`
    :host{
      display:block;
      max-width:100vw;
    }

    .material-symbols-outlined{
      font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
    }

    .dialog-card{
      width: 100%;
      max-width: min(560px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 20px 22px 18px;
      background: var(--surface);
      border-radius: 18px;
      border: 1px solid rgba(240,210,122,.7);
      box-shadow: 0 0 0 1px rgba(0,0,0,.7),
                  0 0 38px rgba(240,210,122,.45);
      box-sizing: border-box;
      color: var(--text);
      overflow: hidden; /* nada vaza da caixa */
    }

    .dialog-header{
      display:flex;
      align-items:center;
      gap:14px;
      margin-bottom:14px;
    }

    .avatar{
      width:48px;
      height:48px;
      border-radius:16px;
      display:grid;
      place-items:center;
      background: linear-gradient(180deg, rgba(255,255,255,.35), transparent 40%),
                  linear-gradient(135deg,#F5D97A 0%,#D4AF37 45%,#B8860B 100%);
      box-shadow:0 4px 14px rgba(212,175,55,.35);
      color:#151515;
      flex-shrink:0;
    }

    .header-text h2{
      margin:0;
      font-size:1.25rem;
    }

    .subtitle{
      margin:2px 0 0;
      font-size:.88rem;
      color:var(--muted);
    }

    .body{
      margin-top:4px;
    }

    .muted{ color: var(--muted); }

    .list{
      display:flex;
      flex-direction:column;
      gap:8px;
      margin-top:6px;
      max-height: 260px;
      overflow-y:auto;
      padding-right:2px;
    }

    .row{
      display:flex;
      align-items:center;
      gap:10px;
      padding:8px 10px;
      border-radius:10px;
      border:1px solid var(--border);
      background:#050814;
      min-width:0; /* evita estourar largura */
    }

    .info{
      flex:1;
      min-width:0;
    }

    .name{
      font-weight:500;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    .desc{
      font-size:.82rem;
    }

    .actions{
      display:flex;
      gap:6px;
      flex-shrink:0;
    }

    .icon-btn{
      width:34px;
      height:34px;
      display:grid;
      place-items:center;
      border-radius:10px;
      border:1px solid var(--border);
      background:transparent;
      color:var(--muted);
      cursor:pointer;
      transition: background .15s, border-color .15s,
                  color .15s, transform .05s;
      flex-shrink:0;
    }
    .icon-btn:hover{
      background:rgba(127,127,127,.1);
      color:var(--text);
    }

    .icon-btn.edit{
      color:#facc15;
      border-color:rgba(250,204,21,.4);
    }
    .icon-btn.edit:hover{
      background:rgba(250,204,21,.12);
      border-color:rgba(250,204,21,.7);
    }

    .icon-btn.danger{
      color:#ef4444;
      border-color:rgba(239,68,68,.4);
    }
    .icon-btn.danger:hover{
      background:rgba(239,68,68,.10);
      border-color:rgba(239,68,68,.7);
    }

    .empty{
      text-align:center;
      padding:32px 10px 18px;
    }

    .empty-icon{
      width:46px;
      height:46px;
      margin:0 auto 10px;
      border-radius:999px;
      display:grid;
      place-items:center;
      background:rgba(148,163,184,.08);
      color:var(--muted);
    }

    .empty-title{
      margin:0 0 4px;
      font-weight:500;
    }

    .empty-text{
      margin:0;
      font-size:.88rem;
      color:var(--muted);
    }

    .footer{
      display:flex;
      justify-content:space-between;
      gap:10px;
      margin-top:18px;
      flex-wrap:wrap; /* se apertar, quebra linha e não cria scroll */
    }

    .btn{
      height:40px;
      padding:0 16px;
      border-radius:999px;
      border:1px solid transparent;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      cursor:pointer;
      font-size:.9rem;
      font-weight:600;
      white-space:nowrap;
      flex-shrink:0;
    }

    .btn-outline{
      background:transparent;
      border-color:var(--border);
      color:var(--muted);
    }
    .btn-outline:hover{
      background:rgba(127,127,127,.12);
      color:var(--text);
      border-color:#cfcfd4;
    }

    .btn-gold{
      position: relative;
      overflow: hidden;
      isolation: isolate;
      border: 1px solid #9e7b14;
      color: #151515;
      background:
        radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.20), transparent 60%),
        linear-gradient(180deg, #F5DF7B 0%, var(--primary) 55%, var(--primary-600) 100%);
      box-shadow: 0 10px 26px rgba(218,171,31,.40),
                  inset 0 -2px 0 rgba(0,0,0,.18);
      transition: transform .05s ease,
                  box-shadow .2s,
                  filter .2s,
                  background .2s;
    }
    .btn-gold:hover{
      background:
        radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.28), transparent 60%),
        linear-gradient(180deg,#F9E992 0%, #E3BD43 55%, #BE8E1A 100%);
    }
  `]
})
export class SetoresDialogComponent implements OnInit {
  private api   = inject(SetorService);
  private ref   = inject(MatDialogRef<SetoresDialogComponent, boolean>);
  private dialog = inject(MatDialog);
  private produtoService = inject(ProdutoService);

  setores: Setor[] = [];

   ngOnInit(): void {
    console.log('[SetoresDialog] ngOnInit -> carregar()');
    this.carregar();
  }

  private carregar() {
    console.log('[SetoresDialog] chamando SetorService.listar()');
    this.api.listar().subscribe({
      next: (r: Setor[]) => {
        console.log('[SetoresDialog] resposta listar():', r);
        // Protecao de consistencia: mostra apenas ativos nesta tela.
        this.setores = (r ?? []).filter(s => s.ativo !== false);
      },
      error: (err: any) => {
        console.error('Erro ao carregar setores', err);
        this.setores = [];
      }
    });
  }

  novo() {
    const data: SetorFormData = { mode: 'create' };
    this.dialog.open(SetorFormDialogComponent, {
      data,
      autoFocus: false
    }).afterClosed().subscribe((ok: boolean | undefined) => {
      if (ok) this.carregar();
    });
  }

  editar(s: Setor) {
    const data: SetorFormData = { mode: 'edit', setor: s };
    this.dialog.open(SetorFormDialogComponent, {
      data,
      autoFocus: false
    }).afterClosed().subscribe((ok: boolean | undefined) => {
      if (ok) this.carregar();
    });
  }

  desativar(s: Setor) {
    this.dialog.open(ConfirmDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Desativar setor',
        message: `Desativar o setor "${s.nome}"?`,
        confirmText: 'Sim',
        cancelText: 'Nao',
      },
    }).afterClosed().subscribe((confirmou: boolean | undefined) => {
      if (!confirmou) return;

      this.api.desativar(s.id).subscribe({
        next: () => {
          this.setores = this.setores.filter(x => x.id !== s.id);
          this.desativarProdutosDoSetor(s.id);
        },
        error: (err: any) => {
          console.error('Erro ao desativar setor', err);
          alert('Não foi possível desativar o setor.');
        }
      });
    });
  }

  private desativarProdutosDoSetor(setorId: number): void {
    this.produtoService.listar().subscribe({
      next: (produtos) => {
        const ids = (produtos ?? [])
          .filter(p => p.setorFilhoId === setorId && p.id != null)
          .map(p => p.id as number);

        if (ids.length === 0) return;

        forkJoin(ids.map(id => this.produtoService.desativar(id))).subscribe({
          error: (err) => {
            console.error('Erro ao desativar produtos do setor', err);
          }
        });
      },
      error: (err) => {
        console.error('Erro ao listar produtos do setor', err);
      }
    });
  }

  abrirDesativados() {
    this.dialog.open(SetoresDesativadosDialogComponent, {
      autoFocus: false
    }).afterClosed().subscribe((changed: boolean | undefined) => {
      if (changed) this.carregar();
    });
  }
}
