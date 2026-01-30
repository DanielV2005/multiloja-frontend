// src/app/features/loja/setores/setor-form.dialog.ts
import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA
} from '@angular/material/dialog';
import { EMPTY, forkJoin } from 'rxjs';
import { finalize, map, switchMap } from 'rxjs/operators';

import { SetorService, NovoSetor, Setor } from '../../../core/services/setor.service';

export type SetorFormMode = 'create' | 'edit';

export interface SetorFormData {
  mode: SetorFormMode;
  setor?: Setor;
}

@Component({
  standalone: true,
  selector: 'app-setor-form-dialog',
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  template: `
  <div class="dialog-card">
    <header class="dialog-header">
      <div class="avatar">
        <span class="material-symbols-outlined">
          {{ data.mode === 'create' ? 'add' : 'edit' }}
        </span>
      </div>
      <div>
        <h2>{{ data.mode === 'create' ? 'Novo setor' : 'Editar setor' }}</h2>
      </div>
    </header>

    <form [formGroup]="form" (ngSubmit)="salvar()" class="form-body">
      <label class="field">
        <span class="label">Nome</span>
        <input
          type="text"
          formControlName="nome"
          placeholder="Ex.: Vendas" />
        <small class="error" *ngIf="form.controls.nome.touched && form.controls.nome.invalid && !nomeDuplicado">
          Informe um nome v&aacute;lido (at&eacute; 80 caracteres).
        </small>
        <small class="error" *ngIf="nomeDuplicado">
          Ja existe um setor com este nome (ativo ou desativado).
        </small>
      </label>

      <label class="field">
        <span class="label">Descri&#231;&#227;o (opcional)</span>
        <input
          type="text"
          formControlName="descricao"
          placeholder="Ex.: Setor de vendas da loja" />
      </label>

      <div class="actions">
        <button type="button" class="btn btn-outline" (click)="fechar()">
          Cancelar
        </button>
        <button type="submit" class="btn btn-gold" [disabled]="loading || form.invalid">
          {{ loading ? 'Salvando...' : 'Salvar' }}
        </button>
      </div>
    </form>
  </div>
  `,
  styles: [/* CSS existente */`
    .material-symbols-outlined{
      font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
    }
    .dialog-card{
      max-width: 520px; width: min(520px, calc(100vw - 40px)); margin: 0 auto;
      padding: 20px 22px 18px; background: var(--surface); border-radius: 18px;
      border: 1px solid rgba(240,210,122,.7);
      box-shadow: 0 0 0 1px rgba(0,0,0,.7), 0 0 38px rgba(240,210,122,.45);
      box-sizing: border-box; color: var(--text);
    }
    .dialog-header{ display:flex; align-items:center; gap:12px; margin-bottom:14px; }
    .dialog-header h2{ margin:0; font-size:1.25rem; }
    .avatar{
      width:40px; height:40px; border-radius:12px; display:grid; place-items:center;
      background: linear-gradient(180deg, rgba(255,255,255,.35), transparent 40%),
                  linear-gradient(135deg,#F5D97A 0%,#D4AF37 45%,#B8860B 100%);
      box-shadow:0 4px 14px rgba(212,175,55,.35); color:#151515;
    }
    .form-body{ display:flex; flex-direction:column; gap:10px; margin-top:4px; }
    .field{ display:flex; flex-direction:column; gap:4px; }
    .label{ font-size:.9rem; }
    input{
      height:40px; border-radius:8px; border:1px solid var(--border);
      padding:0 10px; background:#050814; color:var(--text); outline:none; box-sizing:border-box;
    }
    input:focus{ border-color:#f0d27a; box-shadow:0 0 0 1px rgba(240,210,122,.45); }
    .error{ color:#f97373; font-size:.78rem; }
    .actions{ display:flex; justify-content:flex-end; gap:10px; margin-top:14px; }
    .btn{
      min-width:90px; height:34px; padding:0 14px; border-radius:999px;
      border:1px solid transparent; font-size:.9rem; cursor:pointer;
      transition: background .15s, box-shadow .2s, transform .05s,
                  color .15s, border-color .15s;
    }
    .btn-outline{ background:transparent; border-color:var(--border); color:var(--muted); }
    .btn-outline:hover{ background:rgba(127,127,127,.12); color:var(--text); border-color:#cfcfd4; }
    .btn-gold{
      position:relative; overflow:hidden; isolation:isolate;
      background: radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.20), transparent 60%),
                  linear-gradient(180deg,#F5DF7B 0%, var(--primary) 55%, var(--primary-600) 100%);
      color:#151515; border-color:#9e7b14;
      box-shadow:0 8px 20px rgba(218,171,31,.45), inset 0 -2px 0 rgba(0,0,0,.18);
      font-weight:600;
    }
    .btn-gold:hover{
      background: radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.26), transparent 60%),
                  linear-gradient(180deg,#F9E992 0%, #E3BD43 55%, #BE8E1A 100%);
    }
    .btn-gold:disabled{ opacity:.7; cursor:default; box-shadow:none; }
  `]
})
export class SetorFormDialogComponent {
  private fb  = inject(FormBuilder);
  private api = inject(SetorService);
  private ref = inject(MatDialogRef<SetorFormDialogComponent, boolean>);

  loading = false;
  nomeDuplicado = false;

  form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(80)]],
    descricao: ['']
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: SetorFormData) {
    if (data.setor) {
      this.form.patchValue({
        nome: data.setor.nome ?? '',
        descricao: data.setor.descricao ?? ''
      });
    }
    this.form.controls.nome.valueChanges.subscribe(() => {
      if (!this.nomeDuplicado) return;
      this.nomeDuplicado = false;
      if (this.form.controls.nome.hasError('duplicated')) {
        this.form.controls.nome.setErrors(null);
      }
    });
  }

  salvar(): void {
    if (this.form.invalid || this.loading) return;

    const raw = this.form.getRawValue();
    const nome = (raw.nome ?? '').trim();
    if (!nome) {
      this.form.controls.nome.setErrors({ required: true });
      this.form.controls.nome.markAsTouched();
      return;
    }

    const dto: NovoSetor = { ...raw, nome };
    const currentId = this.data.setor?.id ?? null;

    this.loading = true;
    this.nomeDuplicado = false;
    this.nomeJaExiste(nome, currentId)
      .pipe(
        switchMap((exists) => {
          if (exists) {
            this.nomeDuplicado = true;
            this.form.controls.nome.setErrors({ duplicated: true });
            this.form.controls.nome.markAsTouched();
            return EMPTY;
          }

          if (this.data.mode === 'create') {
            return this.api.criar(dto);
          }
          return this.api.atualizar(this.data.setor!.id, dto);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: () => this.ref.close(true),
        error: (err: any) => {
          console.error('Erro ao salvar setor', err);
          alert('Nao foi possivel salvar o setor.');
        }
      });
  }

  fechar(): void {
    this.ref.close(false);
  }

  private nomeJaExiste(nome: string, currentId: number | null) {
    const alvo = this.normalizeNome(nome);

    return forkJoin({
      ativos: this.api.listar(),
      desativados: this.api.listarDesativados(),
    }).pipe(
      map(({ ativos, desativados }) => {
        const todos = [...(ativos ?? []), ...(desativados ?? [])];
        return todos.some(s => {
          if (!s) return false;
          if (currentId && s.id === currentId) return false;
          return this.normalizeNome(s.nome ?? '') === alvo;
        });
      })
    );
  }

  private normalizeNome(value: string): string {
    return String(value ?? '').trim().toLowerCase();
  }
}
