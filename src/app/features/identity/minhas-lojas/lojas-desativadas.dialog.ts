// src/app/features/identity/minhas-lojas/lojas-desativadas.dialog.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { UsuarioService, Loja } from '../../../core/services/usuario.service';

@Component({
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  selector: 'app-lojas-desativadas-dialog',
  template: `
    <div class="dlg">
      <header class="dlg__header">
        <div class="title">
          <span class="material-symbols-outlined">history_toggle_off</span>
          <h3>Lojas desativadas</h3>
        </div>
        <button class="icon-btn close" (click)="close()" aria-label="Fechar">
          <span class="material-symbols-outlined">close</span>
        </button>
      </header>

      <div class="body" *ngIf="loading">
        <div class="skeleton" *ngFor="let _ of skeleton"></div>
      </div>

      <div class="body" *ngIf="!loading && lojas.length === 0">
        <p class="muted">Nenhuma loja desativada.</p>
      </div>

      <ul class="list" *ngIf="!loading && lojas.length > 0">
        <li *ngFor="let l of lojas" class="row">
          <span class="avatar">{{ initials(l.nome) }}</span>
          <span class="name">{{ l.nome }}</span>
          <button
            class="icon-btn ok"
            (click)="reativar(l)"
            title="Reativar loja"
            aria-label="Reativar loja"
          >
            <span class="material-symbols-outlined">settings_backup_restore</span>
          </button>
        </li>
      </ul>
    </div>
  `,
  styles: [`
    .material-symbols-outlined{
      font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    }

    /* ========== CONTAINER DO DIALOG ========== */
    .dlg{
      width: 100%;
      max-width: min(640px, 100vw - 32px); /* 16px de margem de cada lado */
      box-sizing: border-box;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: var(--shadow);
      padding: 14px;
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      overflow-x: hidden; /* some a barra horizontal */
      margin: 0 auto;
    }

    .dlg__header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      margin-bottom:6px;
    }

    .title{
      display:flex;
      align-items:center;
      gap:8px;
    }
    .title h3{
      margin:0;
      font-size:1.1rem;
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
    }
    .icon-btn.close .material-symbols-outlined{
      display:block;
      line-height:1;
      font-size:20px;
      width:20px;
      height:20px;
      transform:translateY(1px);
    }
    .icon-btn:hover{
      background:rgba(127,127,127,.08);
      color:var(--text);
      border-color:#cfcfd4;
    }
    .icon-btn.ok{
      color:rgb(52,211,153);
      border-color:rgba(52,211,153,.35);
    }
    .icon-btn.ok:hover{
      background:rgba(52,211,153,.12);
      border-color:rgba(52,211,153,.6);
    }

    .body{
      padding:8px 4px 10px;
    }
    .muted{
      color:var(--muted);
    }

    .list{
      list-style:none;
      margin:8px 0 0;
      padding:0;
      display:grid;
      gap:8px;
    }

    .row{
      display:flex;
      align-items:center;
      gap:12px;
      border:1px solid var(--border);
      border-radius:12px;
      padding:10px;
    }

    .name{
      flex:1;
      min-width:0;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }

    .avatar{
      width:32px;
      height:32px;
      border-radius:8px;
      display:grid;
      place-items:center;
      font-weight:700;
      font-size:.9rem;
      color:#151515;
      background:
        linear-gradient(180deg, rgba(255,255,255,.35), transparent 40%),
        linear-gradient(135deg, #F5D97A 0%, #D4AF37 45%, #B8860B 100%);
      box-shadow: 0 4px 14px rgba(212,175,55,.25);
    }

    .skeleton{
      height:44px;
      border-radius:12px;
      border:1px solid var(--border);
      background: linear-gradient(90deg,
        rgba(255,255,255,.06),
        rgba(255,255,255,.15),
        rgba(255,255,255,.06)
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer{
      to { background-position: -200% 0; }
    }

    @media (max-width: 600px){
      .dlg{
        padding: 10px;
        border-radius: 14px;
      }
      .row{
        padding:8px;
      }
    }
  `]
})
export class LojasDesativadasDialogComponent implements OnInit {
  private api = inject(UsuarioService);
  private ref = inject(MatDialogRef<LojasDesativadasDialogComponent>);

  lojas: Loja[] = [];
  loading = true;
  changed = false;
  skeleton = Array.from({ length: 6 });

  ngOnInit(): void {
    this.load();
  }

load(){
  this.loading = true;
  this.api.lojasDesativadas().subscribe({
    next: r => this.lojas = r ?? [],
    error: err => {
      console.error('Erro ao buscar lojas desativadas', err);
      this.lojas = [];
    },
    complete: () => this.loading = false
  });
}

  initials(nome: string){
    if (!nome) return 'LJ';
    const p = nome.trim().split(/\s+/);
    return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
  }
reativar(l: Loja){
  this.api.reativarLoja(l.id).subscribe({
    next: () => {
      this.changed = true;
      this.load(); // recarrega a lista de desativadas do backend
    },
    error: (err) => {
      console.error('Erro ao reativar loja', err);
      alert(err?.error?.message ?? 'Não foi possível reativar esta loja.');
    }
  });
}


  close(){
    this.ref.close(this.changed);
  }
}
