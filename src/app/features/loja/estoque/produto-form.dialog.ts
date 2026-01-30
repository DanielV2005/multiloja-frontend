// src/app/features/loja/estoque/produto-form.dialog.ts
import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';

import {
  ProdutoService,
  SalvarProdutoRequest,
  Produto,
} from '../../../core/services/produto.service';
import { SetorService, Setor } from '../../../core/services/setor.service';

/**
 * Dados passados ao abrir o diálogo.
 * - lojaId: sempre obrigatório
 * - produto: se vier => modo edição
 */
export interface ProdutoFormDialogData {
  lojaId: number;
  produto?: Produto;
}

@Component({
  standalone: true,
  selector: 'app-produto-form-dialog',
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  template: `
  <section class="dialog-card">
    <header class="dialog-header">
      <div class="avatar">
        <span class="material-symbols-outlined">inventory_2</span>
      </div>

      <div class="title">
        <h2>{{ titulo }}</h2>
        <p class="subtitle">
          {{ subtitulo }}
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
      <!-- LINHA 1: nome + setor -->
      <div class="field-row">
        <!-- NOME -->
        <div class="field field-full">
          <label for="nome">Nome do produto</label>
          <input
            id="nome"
            type="text"
            autocomplete="off"
            formControlName="nome"
          />
          <small
            class="error"
            *ngIf="nomeCtrl?.touched && nomeCtrl?.invalid && !nomeServerError"
          >
            Informe o nome do produto.
          </small>
          <small class="error" *ngIf="nomeServerError">{{ nomeServerError }}</small>
        </div>

        <!-- SETOR -->
        <div class="field">
          <label for="setorId">Setor</label>
          <select
            id="setorId"
            formControlName="setorId"
          >
            <option value="">Selecione...</option>
            <option
              *ngFor="let s of setores"
              [value]="s.id"
            >
              {{ s.nome }}
            </option>
          </select>
          <small
            class="error"
            *ngIf="setorIdCtrl?.touched && setorIdCtrl?.invalid"
          >
            Selecione um setor.
          </small>
        </div>
      </div>

      <!-- LINHA 2: código de barras -->
      <div class="field-row">
        <div class="field">
          <label for="codigoBarra">Código de barras (opcional)</label>
          <input
            id="codigoBarra"
            type="text"
            autocomplete="off"
            formControlName="codigoBarra"
          />
          <small class="error" *ngIf="codigoServerError">{{ codigoServerError }}</small>
        </div>
      </div>

      <!-- LINHA 3: números -->
      <div class="field-row">
        <div class="field small">
          <label for="quantidade">Quantidade</label>
          <input
            id="quantidade"
            type="number"
            min="0"
            formControlName="quantidade"
          />
          <small
            class="error"
            *ngIf="quantidadeCtrl?.touched && quantidadeCtrl?.invalid"
          >
            Informe uma quantidade &ge; 0.
          </small>
        </div>

        <div class="field small">
          <label for="precoCusto">Preço de custo</label>
          <input
            id="precoCusto"
            type="number"
            min="0"
            step="0.01"
            formControlName="precoCusto"
          />
          <small
            class="error"
            *ngIf="precoCustoCtrl?.touched && precoCustoCtrl?.invalid"
          >
            Informe o preço de custo &ge; 0.
          </small>
        </div>

        <div class="field small">
          <label for="precoVenda">Preço de venda</label>
          <input
            id="precoVenda"
            type="number"
            min="0"
            step="0.01"
            formControlName="precoVenda"
          />
          <small
            class="error"
            *ngIf="precoVendaCtrl?.touched && precoVendaCtrl?.invalid"
          >
            Informe o preço de venda &ge; 0.
          </small>
        </div>

        <div class="field small">
          <label for="margem">Margem (%)</label>
          <input
            id="margem"
            type="text"
            [value]="margemFormatada"
            readonly
          />
          <small class="hint">
            Calculada automaticamente a partir do custo e venda.
          </small>
        </div>
      </div>
    </main>

    <small class="error" *ngIf="errorMessage && !nomeServerError && !codigoServerError">{{ errorMessage }}</small>

    <footer class="dialog-footer">
      <button
        type="button"
        class="btn btn-outline"
        (click)="fechar(false)"
      >
        Cancelar
      </button>

      <button
        type="button"
        class="btn btn-gold"
        [disabled]="form.invalid || salvando"
        (click)="salvar()"
      >
        <span
          class="spinner"
          *ngIf="salvando"
        ></span>
        <span *ngIf="!salvando">{{ textoBotao }}</span>
      </button>
    </footer>
  </section>
  `,
  styles: [`
    .material-symbols-outlined{
      font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
    }

    .dialog-card{
      width:100%;
      max-width:640px;
      max-height:90vh;
      padding:20px 22px 18px;
      background:var(--surface);
      border-radius:18px;
      border:1px solid rgba(240,210,122,.7);
      box-shadow:0 0 0 1px rgba(0,0,0,.7), 0 0 38px rgba(240,210,122,.45);
      box-sizing:border-box;
      color:var(--text);
      overflow-y:auto;      /* scroll só vertical, nada de scroll horizontal */
    }

    .dialog-header{
      display:flex;
      align-items:flex-start;
      gap:12px;
      margin-bottom:14px;
    }

    .avatar{
      width:40px;
      height:40px;
      border-radius:12px;
      display:grid;
      place-items:center;
      background:linear-gradient(180deg, rgba(255,255,255,.35), transparent 40%),
                 linear-gradient(135deg,#F5D97A 0%,#D4AF37 45%,#B8860B 100%);
      box-shadow:0 4px 14px rgba(212,175,55,.35);
      color:#151515;
      flex-shrink:0;
    }

    .title h2{
      margin:0;
      font-size:1.25rem;
    }
    .subtitle{
      margin:2px 0 0;
      font-size:.86rem;
      color:var(--muted);
    }

    .icon-btn.ghost{
      margin-left:auto;
      width:30px;
      height:30px;
      border-radius:999px;
      border:1px solid transparent;
      background:transparent;
      display:grid;
      place-items:center;
      cursor:pointer;
      color:var(--muted);
      transition:background .15s, color .15s, border-color .15s;
    }
    .icon-btn.ghost.close .material-symbols-outlined{
      display:block;
      line-height:1;
      font-size:20px;
      width:20px;
      height:20px;
      transform:translateY(1px);
    }
    .icon-btn.ghost:hover{
      background:rgba(240,210,122,.10);
      color:var(--text);
      border-color:rgba(240,210,122,.5);
    }

    .dialog-body{
      margin-top:4px;
    }

    .field-row{
      display:flex;
      gap:12px;
      margin-bottom:10px;
      flex-wrap:wrap;           /* quebra para baixo em telas menores */
      align-items:flex-start;
    }

    .field{
      display:flex;
      flex-direction:column;
      gap:4px;
      flex:1 1 0;
      min-width:140px;
    }
    .field-full{
      flex:2 1 0;
      min-width:180px;
    }
    .field.small{
      max-width:180px;
      flex:1 1 120px;
    }

    label{
      font-size:.85rem;
      color:var(--muted);
    }

    input, select{
      height:34px;
      border-radius:10px;
      border:1px solid var(--border);
      background:#050814;
      color:var(--text);
      padding:0 10px;
      font-size:.9rem;
      outline:none;
      box-sizing:border-box;
    }
    input:focus,
    select:focus{
      border-color:var(--primary);
      box-shadow:0 0 0 1px rgba(240,210,122,.45);
    }

    .error{
      color:#fecaca;
      font-size:.78rem;
    }

    .hint{
      color:var(--muted);
      font-size:.75rem;
    }

    .dialog-footer{
      margin-top:14px;
      display:flex;
      justify-content:flex-end;
      gap:10px;
    }

    .btn{
      min-width:100px;
      height:34px;
      padding:0 16px;
      border-radius:999px;
      border:1px solid transparent;
      font-size:.9rem;
      cursor:pointer;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      transition:
        background .15s,
        box-shadow .2s,
        transform .05s,
        color .15s,
        border-color .15s;
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
      position:relative;
      overflow:hidden;
      isolation:isolate;
      background:
        radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.20), transparent 60%),
        linear-gradient(180deg,#F5DF7B 0%, var(--primary) 55%, var(--primary-600) 100%);
      color:#151515;
      border-color:#9e7b14;
      box-shadow:0 8px 20px rgba(218,171,31,.45), inset 0 -2px 0 rgba(0,0,0,.18);
      font-weight:600;
    }
    .btn-gold:hover:not(:disabled){
      background:
        radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.26), transparent 60%),
        linear-gradient(180deg,#F9E992 0%, #E3BD43 55%, #BE8E1A 100%);
    }
    .btn-gold:disabled{
      opacity:.7;
      cursor:default;
      box-shadow:none;
    }

    .spinner{
      width:16px;
      height:16px;
      border-radius:50%;
      border:2px solid rgba(0,0,0,.2);
      border-top-color:#111827;
      animation:spin .8s linear infinite;
    }
    @keyframes spin{ to{ transform:rotate(360deg); } }

    @media (max-width: 540px){
      .dialog-card{
        padding:14px 12px 14px;
      }
      .field-row{
        flex-direction:column;
      }
      .field.small{
        max-width:none;
      }
    }
  `],
})
export class ProdutoFormDialogComponent implements OnInit {
  form: FormGroup;
  setores: Setor[] = [];
  salvando = false;
  errorMessage = '';
  nomeServerError = '';
  codigoServerError = '';

  constructor(
    private fb: FormBuilder,
    private produtoService: ProdutoService,
    private setorService: SetorService,
    private dialogRef: MatDialogRef<ProdutoFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProdutoFormDialogData,
  ) {
    this.form = this.fb.group({
      nome: ['', [Validators.required, Validators.maxLength(120)]],
      setorId: [null, [Validators.required]],
      codigoBarra: [''],
      quantidade: [0, [Validators.required, Validators.min(0)]],
      precoCusto: [0, [Validators.required, Validators.min(0)]],
      precoVenda: [0, [Validators.required, Validators.min(0)]],
    });
  }

  get isEdicao(): boolean {
    return !!this.data?.produto;
  }

  get titulo(): string {
    return this.isEdicao ? 'Editar produto' : 'Novo produto';
  }

  get subtitulo(): string {
    return this.isEdicao
      ? 'Altere as informações do produto selecionado.'
      : 'Cadastre um produto para o estoque da loja.';
  }

  get textoBotao(): string {
    return this.isEdicao ? 'Salvar alterações' : 'Salvar produto';
  }

  // GETTERS para usar no template
  get nomeCtrl()        { return this.form.get('nome'); }
  get setorIdCtrl()     { return this.form.get('setorId'); }
  get quantidadeCtrl()  { return this.form.get('quantidade'); }
  get precoCustoCtrl()  { return this.form.get('precoCusto'); }
  get precoVendaCtrl()  { return this.form.get('precoVenda'); }

  /** Margem formatada em texto (apenas exibição) */
  get margemFormatada(): string {
    const custo  = Number(this.form.get('precoCusto')?.value ?? 0);
    const venda  = Number(this.form.get('precoVenda')?.value ?? 0);
    if (!custo || venda <= custo) {
      return '0,00%';
    }
    const margem = ((venda - custo) / custo) * 100;
    return margem.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '%';
  }

  ngOnInit(): void {
    this.carregarSetores();

    if (this.isEdicao && this.data.produto) {
      const p = this.data.produto;
      this.form.patchValue({
        nome:        p.nome,
        setorId:     p.setorFilhoId,
        codigoBarra: p.codigoBarra ?? '',
        quantidade:  p.quantidade,
        precoCusto:  p.precoCusto,
        precoVenda:  p.precoVenda,
      });
    }

    this.nomeCtrl?.valueChanges.subscribe(() => this.clearFieldError('nome'));
    this.form.get('codigoBarra')?.valueChanges.subscribe(() => this.clearFieldError('codigoBarra'));
  }

  private carregarSetores(): void {
    this.setorService.listar().subscribe({
      next: setores => this.setores = setores ?? [],
      error: err => console.error('[ProdutoFormDialog] erro ao carregar setores', err),
    });
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    const dto: SalvarProdutoRequest = {
      codigoBarra : value.codigoBarra || null,
      setorId     : Number(value.setorId),
      nome        : value.nome,
      precoCusto  : Number(value.precoCusto ?? 0),
      precoVenda  : Number(value.precoVenda ?? 0),
      quantidade  : Number(value.quantidade ?? 0),
      ativo       : true,
    };

    this.errorMessage = '';
    this.nomeServerError = '';
    this.codigoServerError = '';
    this.salvando = true;

    let request$;

    if (this.isEdicao) {
      const id = this.data.produto?.id;
      if (id == null) {
        // segurança: nunca faz POST se for edição sem id
        this.salvando = false;
        this.errorMessage = 'Nao foi possivel identificar o produto para edicao (id ausente).';
        console.error('[ProdutoFormDialog] edição sem id do produto', this.data.produto);
        return;
      }
      request$ = this.produtoService.atualizar(id, dto);
    } else {
      request$ = this.produtoService.criar(dto);
    }

    request$.subscribe({
      next: () => {
        this.salvando = false;
        this.dialogRef.close(true); // sinaliza sucesso
      },
      error: err => {
        console.error('[ProdutoFormDialog] erro ao salvar produto', err);
        this.salvando = false;
        this.applyServerErrors(err);
      }
    });
  }


  private applyServerErrors(err: any): void {
    const body = err?.error;
    if (Array.isArray(body?.errors) && body.errors.length) {
      let matched = false;
      for (const item of body.errors) {
        const prop = String(item?.PropertyName ?? item?.propertyName ?? '').toLowerCase();
        const message = String(item?.ErrorMessage ?? item?.errorMessage ?? 'Nome em uso.');
        if (prop.includes('nome')) {
          this.nomeServerError = message;
          this.nomeCtrl?.setErrors({ server: true });
          matched = true;
        }
        if (prop.includes('codigo')) {
          this.codigoServerError = message;
          this.form.get('codigoBarra')?.setErrors({ server: true });
          matched = true;
        }
      }
      if (matched) return;
    }
    const msg = this.getErrorMessage(err);
    const msgLower = msg.toLowerCase();
    if (msgLower.includes('nome em uso')) {
      this.nomeServerError = msg;
      this.nomeCtrl?.setErrors({ server: true });
      return;
    }
    if (msgLower.includes('codigo em uso') || msgLower.includes('código em uso') || msgLower.includes('codigo')) {
      this.codigoServerError = msg;
      this.form.get('codigoBarra')?.setErrors({ server: true });
      return;
    }
    this.errorMessage = msg;
  }

  private clearFieldError(field: 'nome' | 'codigoBarra'): void {
    if (field === 'nome' && this.nomeServerError) {
      this.nomeServerError = '';
      const ctrl = this.nomeCtrl;
      if (ctrl?.hasError('server')) {
        ctrl.setErrors(null);
      }
    }
    if (field === 'codigoBarra' && this.codigoServerError) {
      this.codigoServerError = '';
      const ctrl = this.form.get('codigoBarra');
      if (ctrl?.hasError('server')) {
        ctrl.setErrors(null);
      }
    }
  }

  private getErrorMessage(err: any): string {
    const body = err?.error;
    if (Array.isArray(body?.errors) && body.errors.length) {
      const first = body.errors[0];
      return String(first?.ErrorMessage ?? first?.errorMessage ?? 'Nome em uso.');
    }
    if (typeof body === 'string' && body.trim()) return body;
    if (body?.message) return String(body.message);
    if (body?.error) return String(body.error);
    return 'Nome em uso.';
  }

  fechar(result: boolean): void {
    this.dialogRef.close(result);
  }
}
