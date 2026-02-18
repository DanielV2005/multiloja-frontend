import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
}

@Component({
  standalone: true,
  selector: 'app-confirm-dialog',
  imports: [CommonModule, MatDialogModule],
  template: `
    <section class="dialog-card">
      <header class="dialog-header">
        <div class="avatar">
          <span class="material-symbols-outlined">{{ data.icon || 'help' }}</span>
        </div>
        <div class="title">
          <h3>{{ data.title }}</h3>
          <p>{{ data.message }}</p>
        </div>
      </header>

      <footer class="dialog-footer">
        <button class="btn btn-outline" type="button" (click)="fechar(false)">
          {{ data.cancelText || 'Nao' }}
        </button>
        <button class="btn btn-gold" type="button" (click)="fechar(true)">
          {{ data.confirmText || 'Sim' }}
        </button>
      </footer>
    </section>
  `,
  styles: [`
    .dialog-card{
      min-width:min(520px, 94vw);
      background:var(--surface);
      color:var(--text);
      border:1px solid rgba(240,210,122,.7);
      border-radius:16px;
      box-shadow:0 0 0 1px rgba(0,0,0,.7), 0 0 38px rgba(240,210,122,.35);
      padding:16px;
    }
    .dialog-header{ display:flex; gap:12px; align-items:flex-start; }
    .avatar{
      width:40px; height:40px; border-radius:12px; flex-shrink:0;
      display:grid; place-items:center; color:#151515;
      background: linear-gradient(180deg, rgba(255,255,255,.35), transparent 40%),
                  linear-gradient(135deg,#F5D97A 0%,#D4AF37 45%,#B8860B 100%);
    }
    .title h3{ margin:0 0 6px; font-size:1.1rem; }
    .title p{ margin:0; color:var(--muted); line-height:1.4; }
    .dialog-footer{
      display:flex; justify-content:flex-end; gap:10px; margin-top:16px;
    }
    .btn{
      height:38px; padding:0 16px; border-radius:999px; border:1px solid transparent;
      cursor:pointer; font-weight:600;
    }
    .btn-outline{
      background:transparent; border-color:var(--border); color:var(--muted);
    }
    .btn-outline:hover{ background:rgba(127,127,127,.12); color:var(--text); }
    .btn-gold{
      border-color:#9e7b14;
      color:#151515;
      background:
        radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.20), transparent 60%),
        linear-gradient(180deg, #F5DF7B 0%, var(--primary) 55%, var(--primary-600) 100%);
      box-shadow:0 8px 20px rgba(218,171,31,.40), inset 0 -2px 0 rgba(0,0,0,.18);
    }
  `],
})
export class ConfirmDialogComponent {
  constructor(
    private ref: MatDialogRef<ConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  fechar(ok: boolean): void {
    this.ref.close(ok);
  }
}
