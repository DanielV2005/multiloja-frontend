// src/app/features/loja/estoque/estoque-movimento.dialog.ts
import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
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
import { formatDecimal } from '../../../shared/format';

export interface EstoqueMovimentoDialogData {
  produto: Produto;
}

/** Compra soma o que chegou, perda/avaria/... tira o que saiu e ajuste troca pela contagem nova. */
type ModoMovimento = 'entrada' | 'saida' | 'ajuste';

const MOTIVOS_SAIDA: EstoqueMovimentoMotivo[] = [
  EstoqueMovimentoMotivo.Perda,
  EstoqueMovimentoMotivo.Avaria,
  EstoqueMovimentoMotivo.Defeito,
  EstoqueMovimentoMotivo.Roubo,
  EstoqueMovimentoMotivo.Vencimento,
  EstoqueMovimentoMotivo.ConsumoInterno,
];

export function modoDoMotivo(motivo: EstoqueMovimentoMotivo): ModoMovimento {
  if (motivo === EstoqueMovimentoMotivo.Compra) return 'entrada';
  if (MOTIVOS_SAIDA.includes(motivo)) return 'saida';
  return 'ajuste';
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
          Produto: <strong>{{ produto.nome }}</strong>
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
          <label for="motivo">O que aconteceu?</label>
          <select id="motivo" formControlName="motivo">
            <optgroup label="Entrada">
              <option [ngValue]="EstoqueMovimentoMotivo.Compra">Compra (chegou mercadoria)</option>
            </optgroup>
            <optgroup label="Saída">
              <option [ngValue]="EstoqueMovimentoMotivo.Perda">Perda</option>
              <option [ngValue]="EstoqueMovimentoMotivo.Avaria">Avaria</option>
              <option [ngValue]="EstoqueMovimentoMotivo.Defeito">Defeito</option>
              <option [ngValue]="EstoqueMovimentoMotivo.Roubo">Roubo</option>
              <option [ngValue]="EstoqueMovimentoMotivo.Vencimento">Vencimento</option>
              <option [ngValue]="EstoqueMovimentoMotivo.ConsumoInterno">Consumo interno</option>
            </optgroup>
            <optgroup label="Correção">
              <option [ngValue]="EstoqueMovimentoMotivo.Ajuste">Ajuste (corrigir a contagem)</option>
            </optgroup>
          </select>
        </div>

        <div class="field">
          <label>Quantidade atual</label>
          <div class="readonly">{{ fmt(quantidadeAtual) }}</div>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="quantidade">{{ rotuloQuantidade }}</label>
          <input
            #campoQuantidade
            id="quantidade"
            type="text"
            inputmode="decimal"
            formControlName="quantidade"
            [placeholder]="modo === 'ajuste' ? '' : 'Ex.: 12'"
          />
          <small class="error" *ngIf="mostrarErro && erroQuantidade">{{ erroQuantidade }}</small>
        </div>

        <div class="field">
          <label>Fica com</label>
          <div class="readonly" [class.in]="!erroQuantidade && delta > 0" [class.out]="!erroQuantidade && delta < 0">
            {{ erroQuantidade ? '—' : fmt(novaQuantidade) }}
          </div>
        </div>
      </div>

      <div class="hint">
        <span class="pill" *ngIf="!erroQuantidade && delta !== 0" [class.in]="delta > 0" [class.out]="delta < 0">
          {{ delta > 0 ? 'Entrada' : 'Saída' }} de {{ fmt(deltaAbs) }}
        </span>
        <span class="muted">{{ dicaModo }}</span>
      </div>

      <div class="field-row">
        <div class="field field-full">
          <label for="obs">Observação (opcional)</label>
          <input
            id="obs"
            type="text"
            formControlName="observacao"
            [placeholder]="modo === 'entrada' ? 'Ex.: fornecedor, nota fiscal' : ''"
          />
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
    optgroup{ color: var(--muted); font-style: normal; }
    option{ color: var(--text); }
    .readonly{
      height:40px;
      border-radius:10px;
      border:1px solid var(--border);
      background: rgba(255,255,255,.04);
      display:flex;
      align-items:center;
      padding: 0 10px;
      font-variant-numeric: tabular-nums;
    }
    .readonly.in{ color:#22c55e; font-weight:600; }
    .readonly.out{ color:#ef4444; font-weight:600; }
    .hint{
      display:flex;
      align-items:center;
      gap:10px;
      flex-wrap:wrap;
      min-height:28px;
    }
    .pill{
      padding:4px 10px;
      border-radius:999px;
      border:1px solid var(--border);
      font-size:.85rem;
    }
    .pill.in{ color: #22c55e; border-color: rgba(34,197,94,.4); }
    .pill.out{ color: #ef4444; border-color: rgba(239,68,68,.4); }
    .muted{ color: var(--muted); font-size:.88rem; }
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
  @ViewChild('campoQuantidade') campoQuantidade?: ElementRef<HTMLInputElement>;

  produto: Produto;
  quantidadeAtual = 0;
  loading = false;
  errorMessage = '';
  tentouSalvar = false;

  form: FormGroup;

  EstoqueMovimentoMotivo = EstoqueMovimentoMotivo;

  private modoAnterior: ModoMovimento = 'ajuste';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: EstoqueMovimentoDialogData,
    private dialogRef: MatDialogRef<EstoqueMovimentoDialogComponent>,
    private fb: FormBuilder,
    private produtoService: ProdutoService,
  ) {
    this.produto = data.produto;
    this.quantidadeAtual = data.produto.quantidade ?? 0;
    // Abre em "Ajuste" com a quantidade atual, como antes: quem digita o total continua certo
    this.form = this.fb.group({
      motivo: [EstoqueMovimentoMotivo.Ajuste],
      quantidade: [String(this.quantidadeAtual)],
      observacao: [''],
    });
    this.form.get('motivo')!.valueChanges.subscribe(motivo => this.aoTrocarMotivo(motivo));
  }

  get modo(): ModoMovimento {
    return modoDoMotivo(this.form.get('motivo')!.value);
  }

  get rotuloQuantidade(): string {
    switch (this.modo) {
      case 'entrada': return 'Quantidade que chegou';
      case 'saida': return 'Quantidade que saiu';
      default: return 'Quantidade contada (nova quantidade)';
    }
  }

  get dicaModo(): string {
    switch (this.modo) {
      case 'entrada': return 'Soma ao estoque. Registrar as compras ajuda o sistema a acompanhar a reposição.';
      case 'saida': return 'Tira do estoque. Não conta como venda.';
      default: return 'Troca o estoque pela contagem. Para mercadoria que chegou, use Compra.';
    }
  }

  private get valorDigitado(): number {
    return this.parseDecimal(this.form.get('quantidade')!.value);
  }

  /** Quanto entra (+) ou sai (-) do estoque, pelo modo do motivo escolhido. */
  get delta(): number {
    const v = this.valorDigitado;
    if (!Number.isFinite(v)) return 0;
    const bruto = this.modo === 'entrada' ? v : this.modo === 'saida' ? -v : v - this.quantidadeAtual;
    return Math.round(bruto * 1000) / 1000;
  }

  get deltaAbs(): number {
    return Math.abs(this.delta);
  }

  get novaQuantidade(): number {
    return Math.round((this.quantidadeAtual + this.delta) * 1000) / 1000;
  }

  get erroQuantidade(): string {
    const v = this.valorDigitado;
    if (!Number.isFinite(v) || v < 0) return 'Informe uma quantidade válida.';
    if (this.modo !== 'ajuste' && v === 0) return 'Informe uma quantidade maior que zero.';
    if (this.modo === 'saida' && v > this.quantidadeAtual) {
      return `Só há ${this.fmt(this.quantidadeAtual)} em estoque.`;
    }
    return '';
  }

  get mostrarErro(): boolean {
    return this.tentouSalvar || !!this.form.get('quantidade')?.touched;
  }

  fechar(ok: boolean) {
    this.dialogRef.close(ok ? this.form.value : null);
  }

  salvar() {
    this.errorMessage = '';
    this.tentouSalvar = true;
    if (this.erroQuantidade) return;

    if (!this.produto?.id) {
      this.errorMessage = 'Produto inválido.';
      return;
    }

    if (this.delta === 0) {
      this.errorMessage = 'A quantidade contada é igual à atual: não há o que mudar.';
      return;
    }

    const req: EstoqueMovimentoRequest = {
      produtoId: this.produto.id,
      tipo: this.delta > 0 ? EstoqueMovimentoTipo.Entrada : EstoqueMovimentoTipo.Saida,
      motivo: this.form.get('motivo')!.value,
      quantidade: this.deltaAbs,
      referenciaTipo: 'MovimentacaoManual',
      referenciaId: null,
      observacao: this.form.value.observacao?.trim() || null,
    };

    this.loading = true;
    this.produtoService.movimentarEstoque(req).subscribe({
      next: () => {
        this.loading = false;
        this.dialogRef.close({ novaQuantidade: this.novaQuantidade });
      },
      error: err => {
        console.error('[EstoqueMovimentoDialog] erro ao salvar', err);
        this.loading = false;
        this.errorMessage = err?.error?.error || 'Não foi possível registrar o movimento.';
      },
    });
  }

  fmt(v: number): string {
    return formatDecimal(v, 0, 3);
  }

  /** Mudou de compra para perda (ou ajuste): o numero digitado significa outra coisa, entao recomeca. */
  private aoTrocarMotivo(motivo: EstoqueMovimentoMotivo) {
    const modo = modoDoMotivo(motivo);
    if (modo === this.modoAnterior) return;
    this.modoAnterior = modo;
    this.tentouSalvar = false;
    this.errorMessage = '';
    const campo = this.form.get('quantidade')!;
    campo.setValue(modo === 'ajuste' ? String(this.quantidadeAtual) : '');
    campo.markAsUntouched();
    setTimeout(() => this.campoQuantidade?.nativeElement.focus());
  }

  private parseDecimal(value: unknown): number {
    if (typeof value === 'number') return value;
    const raw = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
    if (!raw) return NaN;
    const num = Number(raw);
    return Number.isFinite(num) ? num : NaN;
  }
}
