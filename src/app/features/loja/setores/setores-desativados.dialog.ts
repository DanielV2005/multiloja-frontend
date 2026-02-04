// src/app/features/loja/setores/setores-desativados.dialog.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { SetorService, Setor } from '../../../core/services/setor.service';

@Component({
  standalone: true,
  selector: 'app-setores-desativados-dialog',
  imports: [CommonModule, MatDialogModule],
  template: `
  <div class="dialog-card">
    <header class="dialog-header">
      <div class="avatar">
        <span class="material-symbols-outlined">history_toggle_off</span>
      </div>
      <div class="header-text">
        <h2>Setores desativados</h2>
        <p class="subtitle">
          Reative setores que foram desativados anteriormente.
        </p>
      </div>
    </header>

    <section class="body">
      <ng-container *ngIf="setores.length; else empty">
        <div class="list">
          <div class="row" *ngFor="let s of setores">
            <div class="info">
              <div class="name">{{ s.nome }}</div>
              <div class="desc muted" *ngIf="s.descricao">{{ s.descricao }}</div>
            </div>

            <button class="btn btn-restore" (click)="reativar(s)">
              <span class="material-symbols-outlined">settings_backup_restore</span>
              <span>Reativar</span>
            </button>
          </div>
        </div>
      </ng-container>

      <ng-template #empty>
        <p class="muted">Nenhum setor desativado.</p>
      </ng-template>
    </section>

    <footer class="footer">
      <button class="btn btn-outline" (click)="fechar()">
        Fechar
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
      width:100%;
      max-width:min(560px, calc(100vw - 32px));
      margin:0 auto;
      padding:20px 22px 18px;
      background:var(--surface);
      border-radius:18px;
      border:1px solid rgba(240,210,122,.7);
      box-shadow:0 0 0 1px rgba(0,0,0,.7),
                 0 0 38px rgba(240,210,122,.45);
      box-sizing:border-box;
      color:var(--text);
      overflow:hidden;
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

    .muted{ color:var(--muted); }

    .body{
      margin-top:4px;
    }

    .list{
      display:flex;
      flex-direction:column;
      gap:8px;
      margin-top:6px;
      max-height:260px;
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
      min-width:0;
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

    .btn{
      border-radius:999px;
      border:1px solid transparent;
      padding:0 14px;
      height:34px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      cursor:pointer;
      font-size:.86rem;
      white-space:nowrap;
      flex-shrink:0;
    }

    .btn-restore{
      background:rgba(22,163,74,.12);
      border-color:rgba(34,197,94,.7);
      color:#bbf7d0;
    }
    .btn-restore:hover{
      background:rgba(22,163,74,.20);
    }

    .footer{
      display:flex;
      justify-content:flex-end;
      margin-top:16px;
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
  `]
})
export class SetoresDesativadosDialogComponent implements OnInit {
  private api = inject(SetorService);
  private ref = inject(MatDialogRef<SetoresDesativadosDialogComponent, boolean>);

  setores: Setor[] = [];

  ngOnInit(): void {
    this.carregar();
  }

  private carregar() {
    this.api.listarDesativados().subscribe({
      // Protecao de consistencia: mostra apenas desativados nesta tela.
      next: (r: Setor[]) => this.setores = (r ?? []).filter(s => s.ativo === false),
      error: (err: any) => {
        console.error('Erro ao carregar setores desativados', err);
        this.setores = [];
      }
    });
  }

  reativar(s: Setor) {
    this.api.reativar(s.id).subscribe({
      next: () => {
        this.setores = this.setores.filter(x => x.id !== s.id);
        this.ref.close(true);
      },
      error: (err: any) => {
        console.error('Erro ao reativar setor', err);
        alert('Não foi possível reativar o setor.');
      }
    });
  }

  fechar() {
    this.ref.close(false);
  }
}
