// src/app/features/identity/trocar-senha/trocar-senha.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { UsuarioService } from '../../../core/services/usuario.service';

@Component({
  standalone: true,
  selector: 'app-trocar-senha',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
  <section class="auth">
    <div class="card">
      <header class="card__header">
        <h2>Trocar senha</h2>
        <p class="subtitle">Atualize sua senha com segurança</p>
      </header>

      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="senhaAtual">Senha atual</label>
          <input id="senhaAtual" class="input"
                 [type]="showAtual ? 'text' : 'password'"
                 formControlName="senhaAtual" autocomplete="current-password" />
          <small class="hint error" *ngIf="form.controls.senhaAtual.touched && form.controls.senhaAtual.invalid">
            Informe a senha atual.
          </small>
        </div>

        <div class="field">
          <label for="novaSenha">Nova senha</label>
          <input id="novaSenha" class="input"
                 [type]="showNova ? 'text' : 'password'"
                 formControlName="novaSenha" autocomplete="new-password" />
          <small class="hint" *ngIf="form.controls.novaSenha.valid && form.controls.novaSenha.value?.length! < 10">
            Dica: use ao menos 10 caracteres.
          </small>
          <small class="hint error" *ngIf="form.controls.novaSenha.touched && form.controls.novaSenha.invalid">
            Mínimo de 6 caracteres.
          </small>
        </div>

        <div class="actions">
          <button type="button" class="link" (click)="toggle('atual')">
            {{ showAtual ? 'Ocultar' : 'Mostrar' }} atual
          </button>
          <button type="button" class="link" (click)="toggle('nova')">
            {{ showNova ? 'Ocultar' : 'Mostrar' }} nova
          </button>
        </div>

        <button class="btn btn--primary" [disabled]="loading || form.invalid">
          <span *ngIf="!loading">Salvar</span>
          <span class="spinner" *ngIf="loading" aria-hidden="true"></span>
        </button>

        <p class="ok" *ngIf="ok">Senha atualizada com sucesso.</p>
        <p class="err" *ngIf="err">Não foi possível atualizar a senha.</p>
      </form>
    </div>
  </section>
  `,
  styles: [`
    .auth{ min-height:100dvh; display:grid; place-items:center; padding:32px 16px; }
    .card{ width:min(420px,92vw); background:var(--surface); border:1px solid var(--border);
           border-radius:var(--radius); box-shadow:var(--shadow); padding:28px 24px 22px; }
    .card__header{ margin-bottom:18px; }
    .subtitle{ margin:6px 0 0; color:var(--muted); font-size:.92rem; }

    .form{ display:grid; gap:14px; margin-top:8px; }
    .field{ display:grid; gap:6px; }
    label{ font-size:.9rem; color:var(--muted); }
    .input{ width:100%; height:44px; border:1px solid var(--border); background:transparent; color:var(--text);
            border-radius:12px; padding:0 12px; outline:none; }
    .input:focus-visible{ border-color:var(--primary); box-shadow:var(--focus); }
    .actions{ display:flex; gap:8px; }
    .link{ background: transparent; border: 1px solid var(--border); color: var(--text);
           border-radius: 10px; height: 32px; padding: 0 10px; cursor: pointer; }
    .btn{ height:44px; border-radius:12px; border:0; font-weight:600; cursor:pointer; }
    .btn--primary{ border:1px solid #9e7b14; color:#151515;
                   background: radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.22), transparent 60%),
                               linear-gradient(180deg, #F5DF7B 0%, var(--primary) 55%, var(--primary-600) 100%);
                   box-shadow:0 10px 26px rgba(218,171,31,.40), inset 0 -2px 0 rgba(0,0,0,.18); }
    .spinner{ width:18px; height:18px; border-radius:50%; border:2px solid rgba(255,255,255,.45);
              border-top-color:#fff; display:inline-block; animation:spin .8s linear infinite; }
    @keyframes spin{ to{ transform:rotate(360deg); } }
    .ok{ color:#16a34a; }
    .err{ color:#ef4444; }
  `]
})
export class TrocarSenhaComponent {
  private fb = inject(FormBuilder);
  private api = inject(UsuarioService);

  showAtual = false;
  showNova = false;
  loading = false;
  ok = false;
  err = false;

  readonly form = this.fb.nonNullable.group({
    senhaAtual: ['', Validators.required],
    novaSenha: ['', [Validators.required, Validators.minLength(6)]],
  });

  toggle(which: 'atual'|'nova'){
    if (which === 'atual') this.showAtual = !this.showAtual;
    else this.showNova = !this.showNova;
  }

  submit(){
    if (this.form.invalid || this.loading) return;
    this.loading = true;
    this.ok = this.err = false;

    const { senhaAtual, novaSenha } = this.form.getRawValue();
    this.api.trocarSenha(senhaAtual, novaSenha).subscribe({
      next: () => {
        this.ok = true;
        this.form.reset();
      },
      error: () => { this.err = true; },
      complete: () => { this.loading = false; },
    });
  }
}
