import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { FuncionarioService, FuncionarioListItem, NovoFuncionario } from '../../../core/services/funcionario.service';

export interface FuncionarioFormDialogData {
  funcionario?: FuncionarioListItem;
}

@Component({
  standalone: true,
  selector: 'app-funcionario-form-dialog',
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  template: `
  <section class="dialog-card" [formGroup]="form">
    <header class="dialog-header">
      <div class="avatar">
        <span class="material-symbols-outlined">{{ isEdit ? 'edit' : 'person_add' }}</span>
      </div>

      <div class="title">
        <h2>{{ titulo }}</h2>
        <p class="subtitle">{{ subtitulo }}</p>
      </div>

      <button type="button" class="icon-btn ghost close" (click)="fechar(null)" aria-label="Fechar">
        <span class="material-symbols-outlined">close</span>
      </button>
    </header>

    <main class="dialog-body">
      <div class="grid">
        <div class="field">
          <label for="nome">Nome completo</label>
          <input id="nome" type="text" autocomplete="off" formControlName="nome" />
          <small class="error" *ngIf="nomeCtrl?.touched && nomeCtrl?.invalid">
            Informe o nome.
          </small>
        </div>

        <div class="field">
          <label for="email">E-mail</label>
          <input id="email" type="email" autocomplete="off" formControlName="email" />
          <small class="error" *ngIf="emailCtrl?.touched && emailCtrl?.invalid">
            Informe um e-mail válido.
          </small>
        </div>

        <div class="field" *ngIf="!isEdit">
          <label for="cpf">CPF</label>
          <input id="cpf" type="text" autocomplete="off" formControlName="cpf" />
          <small class="error" *ngIf="cpfCtrl?.touched && cpfCtrl?.invalid">
            Informe o CPF.
          </small>
        </div>

        <div class="field" *ngIf="!isEdit">
          <label for="senha">Senha temporária</label>
          <input id="senha" type="password" autocomplete="new-password" formControlName="senha" />
          <small class="error" *ngIf="senhaCtrl?.touched && senhaCtrl?.invalid">
            Informe uma senha (mínimo 6 caracteres).
          </small>
        </div>

        <div class="field" *ngIf="!isEdit">
          <label for="nivel">Nível de acesso</label>
          <select id="nivel" formControlName="nivelAcesso">
            <option [value]="1">Admin</option>
            <option [value]="2">Gerente</option>
            <option [value]="3">Operador</option>
          </select>
        </div>
      </div>
    </main>

    <footer class="dialog-footer">
      <button type="button" class="btn btn-outline" (click)="fechar(null)">
        Cancelar
      </button>

      <button type="button" class="btn btn-gold" [disabled]="form.invalid || salvando" (click)="salvar()">
        <span class="spinner" *ngIf="salvando"></span>
        <span *ngIf="!salvando">{{ textoBotao }}</span>
      </button>
    </footer>
  </section>
  `,
  styles: [`
    :host{ display:block; width:100%; max-width:720px; }
    *, *::before, *::after{ box-sizing:border-box; }

    .material-symbols-outlined{ font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; }

    .dialog-card{
      width:100%;
      max-width:720px;
      overflow-x:hidden;
      padding:20px 22px 18px;
      background:var(--surface);
      border-radius:18px;
      border:1px solid rgba(240,210,122,.7);
      box-shadow:0 0 0 1px rgba(0,0,0,.7), 0 0 38px rgba(240,210,122,.45);
      color:var(--text);
    }

    .dialog-header{ display:flex; align-items:flex-start; gap:12px; margin-bottom:14px; }

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

    .title h2{ margin:0; font-size:1.25rem; }
    .subtitle{ margin:2px 0 0; font-size:.86rem; color:var(--muted); }

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

    .dialog-body{ width:100%; min-width:0; }

    .grid{
      display:grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap:12px;
      width:100%;
      min-width:0;
    }

    .field{ display:flex; flex-direction:column; gap:4px; min-width:0; }

    label{ font-size:.85rem; color:var(--muted); }

    input, select{
      width:100%;
      min-width:0;
      height:34px;
      border-radius:10px;
      border:1px solid var(--border);
      background:#050814;
      color:var(--text);
      padding:0 10px;
      font-size:.9rem;
      outline:none;
    }
    input:focus, select:focus{
      border-color:var(--primary);
      box-shadow:0 0 0 1px rgba(240,210,122,.45);
    }

    .error{ color:#fecaca; font-size:.78rem; }

    .dialog-footer{
      margin-top:14px;
      display:flex;
      justify-content:flex-end;
      gap:10px;
      flex-wrap:wrap;
    }

    .btn{
      min-width:110px;
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
      transition: background .15s, box-shadow .2s, transform .05s, color .15s, border-color .15s;
      white-space:nowrap;
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
    .btn-gold:disabled{ opacity:.7; cursor:default; box-shadow:none; }

    .spinner{
      width:16px;
      height:16px;
      border-radius:50%;
      border:2px solid rgba(0,0,0,.2);
      border-top-color:#111827;
      animation:spin .8s linear infinite;
    }
    @keyframes spin{ to{ transform:rotate(360deg); } }

    @media (max-width: 640px){
      .dialog-card{ padding:14px 12px 14px; }
      .grid{ grid-template-columns: 1fr; }
      .btn{ min-width:0; }
    }
  `],
})
export class FuncionarioFormDialogComponent {
  form: FormGroup;
  salvando = false;

  constructor(
    private fb: FormBuilder,
    private api: FuncionarioService,
    private dialogRef: MatDialogRef<FuncionarioFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FuncionarioFormDialogData | null,
  ) {
    const isEdit = !!data?.funcionario;
    const senhaValidators = isEdit ? [] : [Validators.required, Validators.minLength(6)];
    const cpfValidators = isEdit ? [] : [Validators.required, Validators.maxLength(20)];
    const nivelInicial = data?.funcionario?.nivelAcesso ?? 3;

    this.form = this.fb.group({
      nome: ['', [Validators.required, Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
      cpf: ['', cpfValidators],
      senha: ['', senhaValidators],
      nivelAcesso: [nivelInicial, [Validators.required, Validators.min(1), Validators.max(3)]],
    });

    if (isEdit && data?.funcionario) {
      this.form.patchValue({
        nome: data.funcionario.nome,
        email: data.funcionario.email,
      });
    }
  }

  get isEdit(): boolean {
    return !!this.data?.funcionario;
  }

  get titulo(): string {
    return this.isEdit ? 'Editar funcionário' : 'Novo funcionário';
  }

  get subtitulo(): string {
    return this.isEdit
      ? 'Atualize os dados do funcionário selecionado.'
      : 'Cadastre um funcionário para a loja.';
  }

  get textoBotao(): string {
    return this.isEdit ? 'Salvar alterações' : 'Salvar funcionário';
  }

  get nomeCtrl() { return this.form.get('nome'); }
  get emailCtrl() { return this.form.get('email'); }
  get cpfCtrl() { return this.form.get('cpf'); }
  get senhaCtrl() { return this.form.get('senha'); }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (this.isEdit) {
      const funcionario = this.data?.funcionario;
      if (!funcionario?.usuarioId) return;

      const dto = {
        nome: String(value.nome ?? '').trim(),
        email: String(value.email ?? '').trim(),
      };

      this.salvando = true;

      this.api.atualizarFuncionario(funcionario.usuarioId, dto).subscribe({
        next: () => {
          this.salvando = false;
          this.dialogRef.close({ ...funcionario, ...dto });
        },
        error: (err) => {
          console.error('[FuncionarioFormDialog] erro ao atualizar', err);
          this.salvando = false;
        },
      });
      return;
    }

    const cpf = String(value.cpf ?? '').replace(/\D/g, '');

    const dto: NovoFuncionario = {
      nome: String(value.nome ?? '').trim(),
      email: String(value.email ?? '').trim(),
      cpf,
      senha: String(value.senha ?? ''),
      nivelAcesso: Number(value.nivelAcesso ?? 3),
    };

    this.salvando = true;

    this.api.cadastrarFuncionario(dto).subscribe({
      next: () => {
        this.salvando = false;
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('[FuncionarioFormDialog] erro ao salvar', err);
        this.salvando = false;
      },
    });
  }

  fechar(result: FuncionarioListItem | boolean | null): void {
    this.dialogRef.close(result);
  }
}
