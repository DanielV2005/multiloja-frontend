// src/app/shared/meta-venda-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface MetaVendaDialogData {
  lojaId: number | null;
}

@Component({
  standalone: true,
  selector: 'app-meta-venda-dialog',
  imports: [CommonModule, FormsModule, MatDialogModule],
  template: `
    <section class="dialog-card">
      <header class="dialog-header">
        <div class="avatar">
          <span class="material-symbols-outlined">target</span>
        </div>
        <div class="title">
          <h3>Meta de Preco de Venda</h3>
          <p>
            Meta da loja atual para o preco de venda. Ajuste a meta atual e acompanhe o progresso.
          </p>
        </div>
      </header>

      <section class="dialog-body">
        <div class="meta-grid">
          <div class="meta-block">
            <span class="label">Meta Atual</span>
            <input
              type="number"
              min="0"
              [max]="metaFinal"
              step="1000"
              inputmode="decimal"
              [(ngModel)]="metaAtual"
              (blur)="sanitizeMeta()"
            />
            <small class="hint">Valor atual: {{ formatMoney(metaAtual) }}</small>
          </div>
          <div class="meta-block readonly">
            <span class="label">Meta Final</span>
            <div class="readonly-value">{{ formatMoney(metaFinal) }}</div>
            <small class="hint">Nao ajustavel</small>
          </div>
        </div>

        <div class="progress-wrap" [attr.title]="progressLabelFinal">
          <div class="progress-title">Meta Final</div>
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="progressPercentFinal"></div>
          </div>
          <div class="progress-info">{{ progressLabelFinal }}</div>
        </div>

        <div class="progress-wrap" [attr.title]="progressLabelAtual">
          <div class="progress-title">Meta Atual</div>
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="progressPercentAtual"></div>
          </div>
          <div class="progress-info">{{ progressLabelAtual }}</div>
        </div>
      </section>

      <footer class="dialog-footer">
        <button class="btn btn-outline" type="button" (click)="fechar(false)">Fechar</button>
        <button class="btn btn-gold" type="button" (click)="salvar()">Salvar</button>
      </footer>
    </section>
  `,
  styles: [`
    .dialog-card{
      min-width:min(620px, 94vw);
      max-height:min(90vh, 780px);
      overflow:auto;
      width:100%;
      box-sizing:border-box;
      background:var(--surface);
      color:var(--text);
      border:1px solid rgba(240,210,122,.7);
      border-radius:16px;
      box-shadow:0 0 0 1px rgba(0,0,0,.7), 0 0 38px rgba(240,210,122,.35);
      padding:16px;
    }
    .dialog-header{ display:flex; gap:12px; align-items:flex-start; }
    .avatar{
      width:42px; height:42px; border-radius:12px; flex-shrink:0;
      display:grid; place-items:center; color:#151515;
      background: linear-gradient(180deg, rgba(255,255,255,.35), transparent 40%),
                  linear-gradient(135deg,#F5D97A 0%,#D4AF37 45%,#B8860B 100%);
    }
    .title h3{ margin:0 0 6px; font-size:1.1rem; }
    .title p{ margin:0; color:var(--muted); line-height:1.4; }
    .dialog-body{ margin:16px 0 6px; display:grid; gap:16px; }
    .meta-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .meta-block{
      background:rgba(255,255,255,.03);
      border:1px solid var(--border);
      border-radius:12px;
      padding:12px;
      display:grid;
      gap:8px;
    }
    .meta-block.readonly{ opacity:.9; }
    .label{ font-size:.85rem; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
    input{
      width:100%; height:40px; border-radius:10px; border:1px solid rgba(255,255,255,.12);
      background:rgba(0,0,0,.25); color:var(--text); padding:0 12px; font-size:1rem;
    }
    input:focus{ outline:2px solid rgba(240,210,122,.5); border-color:rgba(240,210,122,.6); }
    .readonly-value{
      height:40px; display:flex; align-items:center; padding:0 12px;
      background:rgba(0,0,0,.18); border-radius:10px; border:1px solid rgba(255,255,255,.08);
      font-weight:600;
    }
    .hint{ color:var(--muted); font-size:.85rem; }

    .progress-wrap{ display:grid; gap:8px; }
    .progress-title{ font-weight:600; color:var(--text); }
    .progress-bar{
      position:relative; height:10px; border-radius:999px; overflow:hidden;
      background:#bdbdbd;
    }
    .progress-fill{
      height:100%; background:linear-gradient(90deg, #f7d45a 0%, #f1b800 100%);
      transition:width .25s ease;
    }
    .progress-info{ color:var(--muted); font-size:.9rem; }

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

    @media (max-width: 640px){
      .meta-grid{ grid-template-columns:1fr; }
    }
  `],
})
export class MetaVendaDialogComponent {
  readonly metaFinal = 1_000_000;
  patrimonioVenda = 0;
  metaAtual = 0;

  constructor(
    private ref: MatDialogRef<MetaVendaDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: MetaVendaDialogData
  ) {
    this.metaAtual = this.loadMetaAtual();
    this.patrimonioVenda = this.loadPatrimonioVenda();
  }

  get progressPercentFinal(): number {
    if (!this.metaFinal) return 0;
    const ratio = this.patrimonioVenda / this.metaFinal;
    return this.clampPercent(ratio * 100);
  }

  get progressLabelFinal(): string {
    const pct = this.formatPercentLabel(this.progressPercentFinal);
    return `${pct}% da meta final`;
  }

  get progressPercentAtual(): number {
    if (!this.metaAtual) return 0;
    const ratio = this.patrimonioVenda / this.metaAtual;
    return this.clampPercent(ratio * 100);
  }

  get progressLabelAtual(): string {
    const pct = this.formatPercentLabel(this.progressPercentAtual);
    return `${pct}% da meta atual`;
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  sanitizeMeta(): void {
    if (!Number.isFinite(this.metaAtual)) {
      this.metaAtual = 0;
      return;
    }
    this.metaAtual = Math.max(0, Math.min(this.metaFinal, Math.round(this.metaAtual)));
  }

  salvar(): void {
    this.sanitizeMeta();
    localStorage.setItem(this.storageKey(), String(this.metaAtual));
    this.ref.close(true);
  }

  fechar(ok: boolean): void {
    this.ref.close(ok);
  }

  private loadMetaAtual(): number {
    const raw = localStorage.getItem(this.storageKey());
    const parsed = raw ? Number(raw) : 0;
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(this.metaFinal, Math.round(parsed)));
  }

  private loadPatrimonioVenda(): number {
    const raw = localStorage.getItem(this.patrimonioKey());
    const parsed = raw ? Number(raw) : 0;
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.round(parsed));
  }

  private clampPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
  }

  private formatPercentLabel(value: number): string {
    const clamped = this.clampPercent(value);
    const truncated = Math.trunc(clamped * 10000) / 10000; // sem arredondar (4 casas)
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(truncated);
  }

  private storageKey(): string {
    const lojaId = this.data?.lojaId ?? 'sem-loja';
    return `meta_venda_atual_loja_${lojaId}`;
  }

  private patrimonioKey(): string {
    const lojaId = this.data?.lojaId ?? 'sem-loja';
    return `patrimonio_venda_loja_${lojaId}`;
  }
}
