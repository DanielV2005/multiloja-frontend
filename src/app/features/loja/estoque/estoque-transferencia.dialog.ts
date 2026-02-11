// src/app/features/loja/estoque/estoque-transferencia.dialog.ts
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
import { FormsModule } from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';

import { Produto, ProdutoService, TransferenciaEstoqueRequest } from '../../../core/services/produto.service';
import { UsuarioService, Loja } from '../../../core/services/usuario.service';

export interface EstoqueTransferenciaDialogData {
  produto: Produto;
  lojaId: number;
}

@Component({
  standalone: true,
  selector: 'app-estoque-transferencia-dialog',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule],
  template: `
  <section class="dialog-card">
    <header class="dialog-header">
      <div class="avatar">
        <span class="material-symbols-outlined">swap_horiz</span>
      </div>

      <div class="title">
        <h2>Transferir estoque</h2>
        <p class="subtitle">
          Produto origem: <strong>{{ produto?.nome }}</strong>
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
          <label for="quantidade">Quantidade a transferir</label>
          <input
            id="quantidade"
            type="text"
            inputmode="decimal"
            formControlName="quantidade"
          />
          <small class="error" *ngIf="quantidadeCtrl?.touched && quantidadeCtrl?.invalid">
            Informe uma quantidade valida.
          </small>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="lojaDestinoNome">Loja destino</label>
          <div class="combo">
            <div class="combo-input-wrap">
              <input
                id="lojaDestinoNome"
                type="text"
                [(ngModel)]="lojaDestinoTexto"
                (ngModelChange)="onLojaDestinoInput($event)"
                (focus)="menuLojaAberto = true"
                (blur)="fecharMenuLojaComDelay()"
                [ngModelOptions]="{ standalone: true }"
                placeholder="Digite o nome da loja..."
                autocomplete="off"
              />
              <button type="button" class="combo-toggle" (mousedown)="$event.preventDefault()" (click)="toggleMenuLoja()">
                <span class="material-symbols-outlined">expand_more</span>
              </button>
            </div>
            <div class="combo-menu" *ngIf="menuLojaAberto">
              <button
                type="button"
                class="combo-item"
                *ngFor="let l of lojasFiltradasPorTexto"
                (mousedown)="$event.preventDefault()"
                (click)="selecionarLoja(l)"
              >
                {{ l.nome }}
              </button>
              <div class="combo-empty" *ngIf="lojasFiltradasPorTexto.length === 0">Nenhuma loja encontrada.</div>
            </div>
          </div>
        </div>

        <div class="field">
          <label for="produtoDestinoNome">Produto destino</label>
          <div class="combo">
            <div class="combo-input-wrap">
              <input
                id="produtoDestinoNome"
                type="text"
                [(ngModel)]="produtoDestinoTexto"
                (ngModelChange)="onProdutoDestinoInput($event)"
                (focus)="menuProdutoAberto = true"
                (blur)="fecharMenuProdutoComDelay()"
                [ngModelOptions]="{ standalone: true }"
                [disabled]="!form.get('lojaDestinoId')?.value || carregandoProdutos"
                [placeholder]="carregandoProdutos ? 'Carregando produtos...' : 'Digite o nome do produto...'"
                autocomplete="off"
              />
              <button
                type="button"
                class="combo-toggle"
                [disabled]="!form.get('lojaDestinoId')?.value || carregandoProdutos"
                (mousedown)="$event.preventDefault()"
                (click)="toggleMenuProduto()"
              >
                <span class="material-symbols-outlined">expand_more</span>
              </button>
            </div>
            <div class="combo-menu" *ngIf="menuProdutoAberto">
              <button
                type="button"
                class="combo-item"
                *ngFor="let p of produtosDestinoFiltradosPorTexto"
                (mousedown)="$event.preventDefault()"
                (click)="selecionarProduto(p)"
              >
                {{ p.nome }}
              </button>
              <div class="combo-empty" *ngIf="produtosDestinoFiltradosPorTexto.length === 0">
                {{ produtosDestinoCompativeis.length === 0 ? 'Nenhum produto compatível na loja destino.' : 'Nenhum produto encontrado.' }}
              </div>
            </div>
          </div>
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
        {{ loading ? 'Transferindo...' : 'Transferir' }}
      </button>
    </footer>
  </section>
  `,
  styles: [`
    .material-symbols-outlined{
      font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
    }
    :host{
      display:block;
      overflow:visible;
    }
    :host ::ng-deep .transfer-dialog-panel .mat-mdc-dialog-surface{
      background: transparent !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      overflow:visible !important;
    }
    :host ::ng-deep .transfer-dialog-panel .mat-mdc-dialog-container{
      overflow:visible !important;
    }
    .dialog-card{
      width:min(1020px, 96vw);
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
    .combo{ position:relative; }
    .combo-input-wrap{ position:relative; display:flex; }
    .combo-input-wrap input{ padding-right:38px; width:100%; }
    .combo-toggle{
      position:absolute;
      right:6px;
      top:6px;
      width:28px;
      height:28px;
      border:none;
      border-radius:8px;
      background:transparent;
      color:var(--muted);
      display:grid;
      place-items:center;
      cursor:pointer;
    }
    .combo-toggle:hover{ background:rgba(148,163,184,.14); color:var(--text); }
    .combo-toggle:disabled{ opacity:.45; cursor:default; }
    .combo-menu{
      position:absolute;
      left:0;
      right:0;
      top:44px;
      z-index:20;
      border:1px solid var(--border);
      border-radius:10px;
      background:#111827;
      box-shadow:var(--shadow);
      max-height:180px;
      overflow-y:auto;
      overflow-x:hidden;
    }
    .combo-item{
      width:100%;
      text-align:left;
      border:none;
      background:transparent;
      color:var(--text);
      padding:10px 12px;
      cursor:pointer;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .combo-item:hover{ background:rgba(148,163,184,.16); }
    .combo-empty{
      color:var(--muted);
      padding:10px 12px;
      font-size:.9rem;
    }
    .readonly{
      height:40px;
      border-radius:10px;
      border:1px solid var(--border);
      background: rgba(255,255,255,.04);
      display:flex;
      align-items:center;
      padding: 0 10px;
    }
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
export class EstoqueTransferenciaDialogComponent {
  produto: Produto;
  lojas: Loja[] = [];
  produtosDestino: Produto[] = [];
  lojaDestinoTexto = '';
  produtoDestinoTexto = '';
  menuLojaAberto = false;
  menuProdutoAberto = false;
  lojaAtualId = 0;
  quantidadeAtual = 0;
  loading = false;
  carregandoProdutos = false;
  errorMessage = '';

  form: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: EstoqueTransferenciaDialogData,
    private dialogRef: MatDialogRef<EstoqueTransferenciaDialogComponent>,
    private fb: FormBuilder,
    private produtoService: ProdutoService,
    private usuarioService: UsuarioService,
  ) {
    this.produto = data.produto;
    this.quantidadeAtual = data.produto.quantidade ?? 0;
    this.lojaAtualId = data.lojaId;
    this.form = this.fb.group({
      quantidade: [1, [Validators.required, this.decimalMin(0.01)]],
      lojaDestinoId: [null, [Validators.required, Validators.min(1)]],
      produtoDestinoId: [null, [Validators.required, Validators.min(1)]],
      observacao: [''],
    });

    this.usuarioService.minhasLojas().subscribe({
      next: lojas => {
        this.lojas = (lojas ?? []).filter(l => l.id !== this.lojaAtualId);
      },
      error: () => {
        this.lojas = [];
      },
    });

    this.form.get('lojaDestinoId')?.valueChanges.subscribe(value => {
      const lojaId = Number(value);
      this.produtosDestino = [];
      this.produtoDestinoTexto = '';
      this.form.get('produtoDestinoId')?.setValue(null);
      if (!Number.isFinite(lojaId) || lojaId <= 0) return;

      this.carregandoProdutos = true;
      this.produtoService.listarPorLoja(lojaId).subscribe({
        next: produtos => {
          this.produtosDestino = produtos ?? [];
          this.carregandoProdutos = false;
        },
        error: err => {
          console.error('[EstoqueTransferenciaDialog] erro ao listar produtos destino', err);
          this.produtosDestino = [];
          this.carregandoProdutos = false;
        },
      });
    });
  }

  get quantidadeCtrl() {
    return this.form.get('quantidade');
  }

  get lojasFiltradasPorTexto(): Loja[] {
    const f = this.lojaDestinoTexto.trim().toLowerCase();
    if (!f) return this.lojas;
    return this.lojas.filter(l => (l.nome ?? '').toLowerCase().includes(f));
  }

  get produtosDestinoFiltradosPorTexto(): Produto[] {
    const f = this.produtoDestinoTexto.trim().toLowerCase();
    const base = this.produtosDestinoCompativeis;
    if (!f) return base;
    return base.filter(p => (p.nome ?? '').toLowerCase().includes(f));
  }

  get produtosDestinoCompativeis(): Produto[] {
    return this.produtosDestino.filter(p => this.isProdutoCompativel(p));
  }

  onLojaDestinoInput(value: string): void {
    this.lojaDestinoTexto = value ?? '';
    const loja = this.lojas.find(l => (l.nome ?? '').toLowerCase() === this.lojaDestinoTexto.trim().toLowerCase());
    this.form.get('lojaDestinoId')?.setValue(loja?.id ?? null);
  }

  onProdutoDestinoInput(value: string): void {
    this.produtoDestinoTexto = value ?? '';
    const produto = this.produtosDestinoFiltradosPorTexto.find(
      p => (p.nome ?? '').toLowerCase() === this.produtoDestinoTexto.trim().toLowerCase()
    );
    this.form.get('produtoDestinoId')?.setValue(produto?.id ?? null);
  }

  toggleMenuLoja(): void {
    this.menuLojaAberto = !this.menuLojaAberto;
  }

  toggleMenuProduto(): void {
    this.menuProdutoAberto = !this.menuProdutoAberto;
  }

  fecharMenuLojaComDelay(): void {
    setTimeout(() => (this.menuLojaAberto = false), 120);
  }

  fecharMenuProdutoComDelay(): void {
    setTimeout(() => (this.menuProdutoAberto = false), 120);
  }

  selecionarLoja(loja: Loja): void {
    this.lojaDestinoTexto = loja.nome ?? '';
    this.form.get('lojaDestinoId')?.setValue(loja.id);
    this.menuLojaAberto = false;
  }

  selecionarProduto(produto: Produto): void {
    this.produtoDestinoTexto = produto.nome ?? '';
    this.form.get('produtoDestinoId')?.setValue(produto.id ?? null);
    this.menuProdutoAberto = false;
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

    const produtoDestinoId = Number(this.form.value.produtoDestinoId);
    const produtoDestino = this.produtosDestino.find(p => p.id === produtoDestinoId);
    if (!produtoDestino || !this.isProdutoCompativel(produtoDestino)) {
      this.errorMessage = 'Produto destino incompatível com o produto de origem.';
      return;
    }

    const quantidade = this.parseDecimal(this.form.value.quantidade);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      this.errorMessage = 'Informe uma quantidade valida.';
      return;
    }

    const req: TransferenciaEstoqueRequest = {
      produtoIdOrigem: this.produto.id,
      lojaDestinoId: Number(this.form.value.lojaDestinoId),
      produtoIdDestino: produtoDestinoId,
      quantidade,
      observacao: this.form.value.observacao?.trim() || null,
    };

    this.loading = true;
    this.produtoService.transferirEstoque(req).subscribe({
      next: () => {
        this.loading = false;
        this.dialogRef.close(true);
      },
      error: err => {
        console.error('[EstoqueTransferenciaDialog] erro ao transferir', err);
        this.loading = false;
        this.errorMessage = err?.error?.error || 'Nao foi possivel transferir.';
      },
    });
  }

  private isProdutoCompativel(produto: Produto): boolean {
    if (!produto || !this.produto) return false;
    const nomeOrigem = (this.produto.nome ?? '').trim().toLowerCase();
    const nomeDestino = (produto.nome ?? '').trim().toLowerCase();
    if (nomeOrigem && nomeDestino && nomeOrigem === nomeDestino) return true;

    const codigoOrigem = (this.produto.codigoBarra ?? '').trim().toLowerCase();
    const codigoDestino = (produto.codigoBarra ?? '').trim().toLowerCase();
    if (codigoOrigem && codigoDestino && codigoOrigem === codigoDestino) return true;

    return false;
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
