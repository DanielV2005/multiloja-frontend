import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UsuarioService, LoginResponse } from '../../../core/services/usuario.service';
import { AuthStorageService } from '../../../core/services/auth-storage.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
  <section class="auth">
    <div class="card">
      <header class="card__header">
        <div class="brand">
          <div class="brand__logo" aria-hidden="true"></div>
          <h1 class="brand__title">S&A-Multiloja</h1>
        </div>
        <p class="subtitle">Acesse sua conta para continuar</p>
      </header>

      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="nome">Usu«≠rio</label>
          <input id="nome"
                 class="input"
                 type="text"
                 autocomplete="username"
                 autocapitalize="none"
                 spellcheck="false"
                 formControlName="nome"
                 placeholder="Seu usu«≠rio" />
          <small class="hint error" *ngIf="form.controls.nome.touched && form.controls.nome.invalid">
            Informe seu usu«≠rio.
          </small>
        </div>

        <div class="field">
          <label for="senha">Senha</label>
          <div class="password">
            <input id="senha"
                   class="input"
                   [type]="show ? 'text' : 'password'"
                   autocomplete="current-password"
                   formControlName="senha"
                   placeholder="Sua senha" />
            <button type="button"
                    class="icon-btn"
                    (click)="show = !show"
                    [attr.aria-pressed]="show"
                    aria-label="Mostrar/ocultar senha">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="currentColor"
                  d="M12 5c5 0 9 3.5 10.5 7-1.5 3.5-5.5 7-10.5 7S3 15.5 1.5 12C3 8.5 7 5 12 5Zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>
              </svg>
            </button>
          </div>
          <small class="hint error" *ngIf="form.controls.senha.touched && form.controls.senha.invalid">
            Informe sua senha.
          </small>
        </div>

        <button class="btn btn--primary" [disabled]="loading || form.invalid">
          <span *ngIf="!loading">Entrar</span>
          <span class="spinner" *ngIf="loading" aria-hidden="true"></span>
        </button>
      </form>

      <footer class="card__footer muted">
        ∂∏ {{ year }} Multiloja É?Ω Seguran«ıa em primeiro lugar
      </footer>
    </div>
  </section>
  `,
  styles: [/* mesmo CSS que voc«¶ j«≠ tinha */`
    .auth{ min-height:100dvh; display:grid; place-items:center; padding:32px 16px;
           background: radial-gradient(1200px 600px at 100% -10%, rgba(37,99,235,.08), transparent 55%),
                       radial-gradient(900px 500px at -10% 100%, rgba(99,102,241,.08), transparent 55%); }
    .card{ width:min(420px,92vw); background:var(--surface); border:1px solid var(--border);
           border-radius:var(--radius); box-shadow:var(--shadow); padding:28px 24px 22px; }
    .card__header{ margin-bottom:18px; }
    .brand{ display:flex; align-items:center; gap:10px; }
    .brand__logo{ width:34px; height:34px; border-radius:10px;
                  background: linear-gradient(180deg, rgba(255,255,255,.35), transparent 40%),
                             linear-gradient(135deg, #F5D97A 0%, #D4AF37 45%, #B8860B 100%);
                  box-shadow:0 6px 18px rgba(212,175,55,.28); }
    .brand__title{ margin:0; font-size:1.25rem; letter-spacing:.3px; }
    .subtitle{ margin:6px 0 0; color:var(--muted); font-size:.92rem; }

    .form{ display:grid; gap:14px; margin-top:8px; }
    .field{ display:grid; gap:6px; }
    label{ font-size:.9rem; color:var(--muted); }
    .input{ width:100%; height:44px; border:1px solid var(--border); background:transparent; color:var(--text);
            border-radius:12px; padding:0 12px; outline:none; transition:border-color .2s, box-shadow .2s; }
    .input:focus-visible{ border-color:var(--primary); box-shadow:var(--focus); }

    .password{ position:relative; }
    .password .icon-btn{ position:absolute; top:50%; right:10px; transform:translateY(-50%);
                         border:0; background:transparent; color:var(--muted);
                         width:34px; height:34px; border-radius:8px; cursor:pointer; }
    .password .icon-btn:hover{ color:var(--text); background:rgba(127,127,127,.08); }

    .hint{ font-size:.8rem; color:var(--muted); }
    .hint.error{ color:#e11d48; }

    .btn{ height:44px; border-radius:12px; border:0; font-weight:600; cursor:pointer;
          transition: transform .05s ease, box-shadow .2s, opacity .2s, background .2s; }
    .btn--primary{ position:relative; overflow:hidden; isolation:isolate; border:1px solid #9e7b14; color:#151515;
                   background: radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.22), transparent 60%),
                               linear-gradient(180deg, #F5DF7B 0%, var(--primary) 55%, var(--primary-600) 100%);
                   box-shadow:0 10px 26px rgba(218,171,31,.40), inset 0 -2px 0 rgba(0,0,0,.18); }
    .btn--primary:active{ transform:translateY(1px); }
    .spinner{ width:18px; height:18px; border-radius:50%; border:2px solid rgba(255,255,255,.45);
              border-top-color:#fff; display:inline-block; animation:spin .8s linear infinite; }
    @keyframes spin{ to{ transform:rotate(360deg); } }
    .card__footer{ margin-top:18px; text-align:center; font-size:.82rem; }
    .muted{ color:var(--muted); }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private api = inject(UsuarioService);
  private authStorage = inject(AuthStorageService);
  private router = inject(Router);

  show = false;
  loading = false;
  year = new Date().getFullYear();

  form = this.fb.group({
    nome: ['', Validators.required],
    senha: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid || this.loading) return;
    this.loading = true;

    const { nome, senha } = this.form.value as { nome: string; senha: string };
    this.api.login({ nome: (nome ?? '').trim(), senha: (senha ?? '') }).subscribe({
      next: () => {
        const nivel = this.authStorage.nivelAcesso;
        const lojaId = this.authStorage.lojaId;

        if (nivel === 3) {
          if (lojaId) {
            this.router.navigate(['/loja', lojaId, 'pdv']);
            return;
          }

          this.api.minhasLojas().subscribe({
            next: lojas => {
              const list = Array.isArray(lojas) ? lojas : [];
              if (list.length === 1 && list[0]?.id) {
                const id = list[0].id;
                this.api.selecionarLoja(id).subscribe({
                  next: () => this.router.navigate(['/loja', id, 'pdv']),
                  error: () => this.router.navigateByUrl('/login'),
                });
                return;
              }

              alert('Operador sem loja unica vinculada.');
              this.authStorage.clear();
              this.router.navigateByUrl('/login');
            },
            error: () => {
              this.authStorage.clear();
              this.router.navigateByUrl('/login');
            }
          });
          return;
        }

        this.router.navigateByUrl('/minhas-lojas');
      },
      error: () => { this.loading = false; },
      complete: () => { this.loading = false; }
    });
  }
}
