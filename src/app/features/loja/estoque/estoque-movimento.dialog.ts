// src/app/features/loja/estoque/estoque-movimento.dialog.ts
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';

import {
  Produto,
  ProdutoService,
  EstoqueMovimentoRequest,
  EstoqueMovimentoMotivo,
  EstoqueMovimentoTipo,
} from '../../../core/services/produto.service';

export interface EstoqueMovimentoDialogData {
  produto: Produto;
}

@Component({
  standalone: true,
  selector: 'app-estoque-movimento-dialog',
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  template: `
  <section class="dialog-card">
    <header class="dialog-header">
      <div class="avatar">
        <span class="material-symbols-outlined">swap_vert</span>
      </div>

      <div class="title">
        <h2>Movimentar estoque</h2>
        <p class="subtitle">
          Produto: <strong>{{ produto?.nome }}</strong>
        </p>
      </div>

      <button
        type="button"
        class="icon-btn ghost close"
        (click)="fechar(false)"
        aria-label="Fechar"
      >
        <span class="material-symbols-outlined">close</span>
      </button>
    </header>

    <main class="dialog-body" [formGroup]="form">
      <div class="field-row">
        <div class="field">
          <label>Quantidade atual</label>
          <div class="readonly">{{ quantidadeAtual }}</div>
        </div>

        <div class="field">
          <label for="novaQuantidade">Nova quantidade</label>
          <input
            id="novaQuantidade"
            type="text"
            inputmode="decimal"
            formControlName="novaQuantidade"
          />
          <small class="error" *ngIf="novaCtrl?.touched && novaCtrl?.invalid">
            Informe uma quantidade valida.
          </small>
        </div>
      </div>

      <div class="hint" *ngIf="delta !== 0">
        <span class="pill" [class.in]="delta > 0" [class.out]="delta < 0">
          {{ delta > 0 ? 'Entrada' : 'Saida' }} de {{ deltaAbs }}
        </span>
        <span class="muted">Tipo calculado automaticamente.</span>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="motivo">Motivo (opcional)</label>
          <select id="motivo" formControlName="motivo">
            <option [ngValue]="EstoqueMovimentoMotivo.Ajuste">Ajuste</option>
            <option [ngValue]="EstoqueMovimentoMotivo.Perda">Perda</option>
            <option [ngValue]="EstoqueMovimentoMotivo.Avaria">Avaria</option>
            <option [ngValue]="EstoqueMovimentoMotivo.Roubo">Roubo</option>
            <option [ngValue]="EstoqueMovimentoMotivo.Vencimento">Vencimento</option>
            <option [ngValue]="EstoqueMovimentoMotivo.ConsumoInterno">Consumo interno</option>
          </select>
        </div>
      </div>

      <div class="field-row">
        <div class="field field-full">
          <label for="obs">Observacao (opcional)</label>
          <input id="obs" type="text" formControlName="observacao" />
        </div>
      </div>

      <small class="error" *ngIf="errorMessage">{{ errorMessage }}</small>
    </main>

    <footer class="dialog-footer">
      <button class="btn-ghost" type="button" (click)="fechar(false)">Cancelar</button>
      <button class="btn-gold" type="button" (click)="salvar()" [disabled]="loading">
        {{ loading ? 'Salvando...' : 'Salvar movimento' }}
      </button>
    </footer>
  </section>
  `,
  styles: [`
    :host{
      display:block;
      overflow:visible;
    }
    .material-symbols-outlined{
      font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
    }
    .dialog-card{
      width:min(960px, 96vw);
      min-width:0;
      box-sizing:border-box;
      background:var(--surface);
      color:var(--text);
      border:1px solid var(--border);
      border-radius:16px;
      padding:18px 18px 16px;
      box-shadow:var(--shadow);
      overflow:visible;
    }
    .dialog-header{
      display:flex;
      align-items:center;
      gap:12px;
      margin-bottom:10px;
    }
    .avatar{
      width:44px;
      height:44px;
      border-radius:12px;
      display:grid;
      place-items:center;
      background: linear-gradient(180deg, rgba(255,255,255,.35), transparent 40%),
                  linear-gradient(135deg, #F5D97A 0%, #D4AF37 45%, #B8860B 100%);
      color:#151515;
    }
    .title h2{ margin:0; font-size:1.2rem; }
    .subtitle{ margin:4px 0 0; color:var(--muted); }
    .icon-btn{
      margin-left:auto;
      width:34px;
      height:34px;
      display:grid;
      place-items:center;
      border-radius:10px;
      border:1px solid var(--border);
      background:transparent;
      color:var(--muted);
      cursor:pointer;
    }
    .icon-btn:hover{ color:var(--text); background:rgba(127,127,127,.08); }

    .dialog-body{ display:grid; gap:12px; margin:12px 0 10px; overflow:visible; }
    .field-row{ display:grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap:12px; }
    .field{ display:grid; gap:6px; }
    .field-full{ grid-column: 1 / -1; }
    label{ font-size:.88rem; color:var(--muted); }
    input, select{
      width:100%;
      min-width:0;
      height:40px;
      border-radius:10px;
      border:1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      padding: 0 10px;
      outline: none;
    }
    input:focus, select:focus{ border-color: var(--primary); box-shadow: var(--focus); }
    .readonly{
      height:40px;
      border-radius:10px;
      border:1px solid var(--border);
      background: rgba(255,255,255,.04);
      display:flex;
      align-items:center;
      padding: 0 10px;
    }
    .hint{
      display:flex;
      align-items:center;
      gap:10px;
    }
    .pill{
      padding:4px 10px;
      border-radius:999px;
      border:1px solid var(--border);
      font-size:.85rem;
    }
    .pill.in{ color: #22c55e; border-color: rgba(34,197,94,.4); }
    .pill.out{ color: #ef4444; border-color: rgba(239,68,68,.4); }
    .muted{ color: var(--muted); }
    .error{ color:#f87171; }

    .dialog-footer{
      display:flex;
      justify-content:flex-end;
      gap:10px;
      margin-top:6px;
    }
    .btn-ghost{
      height:40px;
      padding:0 14px;
      border-radius:10px;
      border:1px solid var(--border);
      background:transparent;
      color:var(--text);
      cursor:pointer;
    }
    .btn-gold{
      height:40px;
      padding:0 16px;
      border-radius:10px;
      border:1px solid #9e7b14;
      background: linear-gradient(180deg, #F5DF7B 0%, var(--primary) 55%, var(--primary-600) 100%);
      color:#151515;
      font-weight:600;
      cursor:pointer;
    }
    @media (max-width: 820px){
      .dialog-card{
        width:min(760px, 96vw);
        padding:14px;
      }
      .field-row{
        grid-template-columns:1fr;
        gap:10px;
      }
      .dialog-footer{
        flex-wrap:wrap;
      }
    }
  `],
})
export class EstoqueMovimentoDialogComponent {
  produto: Produto;
  quantidadeAtual = 0;
  loading = false;
  errorMessage = '';

  form: FormGroup;

  EstoqueMovimentoMotivo = EstoqueMovimentoMotivo;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: EstoqueMovimentoDialogData,
    private dialogRef: MatDialogRef<EstoqueMovimentoDialogComponent>,
    private fb: FormBuilder,
    private produtoService: ProdutoService,
  ) {
    this.produto = data.produto;
    this.quantidadeAtual = data.produto.quantidade ?? 0;
    this.form = this.fb.group({
      novaQuantidade: [this.quantidadeAtual, [Validators.required, this.decimalMin(0)]],
      motivo: [EstoqueMovimentoMotivo.Ajuste],
      observacao: [''],
    });
  }

  get novaCtrl() {
    return this.form.get('novaQuantidade');
  }

  get delta() {
    const novo = this.parseDecimal(this.novaCtrl?.value ?? this.quantidadeAtual);
    return novo - this.quantidadeAtual;
  }

  get deltaAbs() {
    return Math.abs(this.delta);
  }

  fechar(ok: boolean) {
    this.dialogRef.close(ok ? this.form.value : null);
  }

  salvar() {
    this.errorMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.produto?.id) {
      this.errorMessage = 'Produto invalido.';
      return;
    }

    if (this.delta === 0) {
      this.errorMessage = 'A quantidade deve ser diferente da atual.';
      return;
    }

    const tipo =
      this.delta > 0 ? EstoqueMovimentoTipo.Entrada : EstoqueMovimentoTipo.Saida;

    const quantidade = this.deltaAbs;
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      this.errorMessage = 'Informe uma quantidade valida.';
      return;
    }

    const req: EstoqueMovimentoRequest = {
      produtoId: this.produto.id,
      tipo,
      motivo: this.form.value.motivo,
      quantidade,
      referenciaTipo: 'MovimentacaoManual',
      referenciaId: null,
      observacao: this.form.value.observacao?.trim() || null,
    };

    this.loading = true;
    this.produtoService.movimentarEstoque(req).subscribe({
      next: () => {
        this.loading = false;
        this.dialogRef.close({
          novaQuantidade: this.quantidadeAtual + this.delta,
        });
      },
      error: err => {
        console.error('[EstoqueMovimentoDialog] erro ao salvar', err);
        this.loading = false;
        this.errorMessage = err?.error?.error || 'Nao foi possivel registrar o movimento.';
      },
    });
  }

  private parseDecimal(value: unknown): number {
    if (typeof value === 'number') return value;
    const raw = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
    const num = Number(raw);
    return Number.isFinite(num) ? num : NaN;
  }

  private decimalMin(min: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = this.parseDecimal(control.value);
      if (!Number.isFinite(value)) return { decimal: true };
      return value >= min ? null : { min: { min, actual: value } };
    };
  }
}
