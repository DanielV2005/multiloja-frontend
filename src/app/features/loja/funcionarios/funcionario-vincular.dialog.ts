import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { FuncionarioService } from '../../../core/services/funcionario.service';

@Component({
  standalone: true,
  selector: 'app-funcionario-vincular-dialog',
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  template: `
  <section class="dialog-card" [formGroup]="form">
    <header class="dialog-header">
      <div class="avatar">
        <span class="material-symbols-outlined">link</span>
      </div>

      <div class="title">
        <h2>Vincular funcionário</h2>
        <p class="subtitle">Informe o CPF para vincular um usuário à loja.</p>
      </div>

      <button type="button" class="icon-btn ghost close" (click)="fechar(false)" aria-label="Fechar">
        <span class="material-symbols-outlined">close</span>
      </button>
    </header>

    <main class="dialog-body">
      <div class="field">
        <label for="cpf">CPF</label>
        <input id="cpf"
               type="text"
               autocomplete="off"
               inputmode="numeric"
               maxlength="14"
               formControlName="cpf"
               (input)="onCpfInput($event)" />
        <small class="error" *ngIf="cpfCtrl?.touched && cpfCtrl?.invalid">
          Informe um CPF válido.
        </small>
        <small class="error" *ngIf="errorMessage">{{ errorMessage }}</small>
      </div>
    </main>

    <footer class="dialog-footer">
      <button type="button" class="btn btn-outline" (click)="fechar(false)">
        Cancelar
      </button>

      <button type="button" class="btn btn-gold" [disabled]="form.invalid || salvando" (click)="vincular()">
        <span class="spinner" *ngIf="salvando"></span>
        <span *ngIf="!salvando">Vincular</span>
      </button>
    </footer>
  </section>
  `,
  styles: [`
    :host{ display:block; width:100%; max-width:520px; }
    *, *::before, *::after{ box-sizing:border-box; }

    .material-symbols-outlined{ font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; }

    .dialog-card{
      width:100%;
      max-width:520px;
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

    .title h2{ margin:0; font-size:1.2rem; }
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

    .field{ display:flex; flex-direction:column; gap:6px; min-width:0; }

    label{ font-size:.85rem; color:var(--muted); }

    input{
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
    input:focus{
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

    @media (max-width: 560px){
      .dialog-card{ padding:14px 12px 14px; }
      .btn{ min-width:0; }
    }
  `],
})
export class FuncionarioVincularDialogComponent {
  form: FormGroup;
  salvando = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private api: FuncionarioService,
    private dialogRef: MatDialogRef<FuncionarioVincularDialogComponent>,
  ) {
    this.form = this.fb.group({
      cpf: ['', [Validators.required, this.cpfDigitsValidator]],
    });
  }

  get cpfCtrl() { return this.form.get('cpf'); }

  vincular(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const cpf = this.onlyDigits(String(value.cpf ?? ''));

    this.errorMessage = '';
    this.salvando = true;

    this.api.vincular(cpf).subscribe({
      next: () => {
        this.salvando = false;
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.salvando = false;
        this.errorMessage = this.getErrorMessage(err);
      }
    });
  }

  private getErrorMessage(err: any): string {
    const body = err?.error;
    if (typeof body === 'string' && body.trim()) return body;
    if (body?.message) return String(body.message);
    if (body?.error) return String(body.error);
    return 'Usu\u00E1rio n\u00E3o possui cadastro na empresa.';
  }

  fechar(result: boolean): void {
    this.dialogRef.close(result);
  }

  onCpfInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = this.onlyDigits(input.value).slice(0, 11);
    const formatted = this.formatCpf(digits);
    if (formatted !== input.value) {
      input.value = formatted;
    }
    this.form.get('cpf')?.setValue(formatted, { emitEvent: false });
  }

  private cpfDigitsValidator = (control: AbstractControl): ValidationErrors | null => {
    const digits = this.onlyDigits(String(control.value ?? ''));
    return digits.length === 11 ? null : { cpfDigits: true };
  };

  private onlyDigits(value: string): string {
    return value.replace(/\D/g, '');
  }

  private formatCpf(digits: string): string {
    const p1 = digits.slice(0, 3);
    const p2 = digits.slice(3, 6);
    const p3 = digits.slice(6, 9);
    const p4 = digits.slice(9, 11);
    let result = p1;
    if (p2) result += `.${p2}`;
    if (p3) result += `.${p3}`;
    if (p4) result += `-${p4}`;
    return result;
  }
}
