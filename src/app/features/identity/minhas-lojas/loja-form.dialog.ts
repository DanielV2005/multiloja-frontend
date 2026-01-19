import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Loja, NovaLoja } from '../../../core/services/usuario.service';

export type FormMode = 'create' | 'edit';
export interface LojaFormData { mode: FormMode; loja?: Loja; }

@Component({
  standalone: true,
  selector: 'app-loja-form-dialog',
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  template: `
  <div class="dlg">
    <header class="dlg__header">
      <div class="icon"><span class="material-symbols-outlined">{{ data.mode === 'create' ? 'add' : 'edit' }}</span></div>
      <div class="title">{{ data.mode === 'create' ? 'Nova loja' : 'Editar loja' }}</div>
    </header>

    <form class="dlg__form" [formGroup]="form" (ngSubmit)="submit()">
      <label class="lbl">Nome</label>
      <input class="input" type="text" formControlName="nome" placeholder="Ex.: Loja Centro" />
      <small class="err" *ngIf="form.controls['nome'].touched && form.controls['nome'].invalid">Informe o nome.</small>

      <label class="lbl">Endereço (opcional)</label>
      <input class="input" type="text" formControlName="endereco" placeholder="Rua, número, bairro…" />

      <footer class="dlg__footer">
        <button type="button" class="link" (click)="close()">Cancelar</button>
        <button class="gold" [disabled]="form.invalid">{{ data.mode === 'create' ? 'Criar' : 'Salvar' }}</button>
      </footer>
    </form>
  </div>
  `,
  styles: [`
    .material-symbols-outlined{ font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; }

    .dlg{ min-width: min(520px, 92vw); }
    .dlg__header{ display:flex; align-items:center; gap:10px; margin-bottom:10px; }
    .icon{
      width:34px; height:34px; border-radius:10px; display:grid; place-items:center;
      background:
        linear-gradient(180deg, rgba(255,255,255,.35), transparent 40%),
        linear-gradient(135deg, #F5D97A 0%, #D4AF37 45%, #B8860B 100%);
      box-shadow: 0 6px 18px rgba(212,175,55,.28);
      color:#121212;
    }
    .title{ font-weight:600; font-size:1.06rem; }

    .dlg__form{ display:grid; gap:10px; }
    .lbl{ font-size:.9rem; color: var(--muted); }
    .input{
      height: 40px; width: 100%; border-radius: 10px; border: 1px solid var(--border);
      background: transparent; color: var(--text); padding: 0 12px; outline: none;
    }
    .input:focus-visible{ border-color: var(--primary); box-shadow: var(--focus); }
    .err{ color:#ef4444; margin-top:-4px; }

    .dlg__footer{ display:flex; gap:10px; justify-content:flex-end; margin-top:6px; }

    .link{
      background: transparent; border: 1px solid var(--border); color: var(--text);
      border-radius: 10px; height: 36px; padding: 0 12px; cursor: pointer;
    }
    .link:hover{ background: rgba(127,127,127,.08); }

    .gold{
      position: relative; overflow: hidden; isolation: isolate; height: 36px;
      border-radius: 12px; border: 1px solid #9e7b14; color: #151515;
      background:
        radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.20), transparent 60%),
        linear-gradient(180deg, #F5DF7B 0%, var(--primary) 55%, var(--primary-600) 100%);
      box-shadow: 0 10px 26px rgba(218,171,31,.40), inset 0 -2px 0 rgba(0,0,0,.18);
      cursor: pointer; padding: 0 14px; font-weight: 600;
      transition: transform .05s ease, box-shadow .2s, filter .2s, background .2s;
    }
    .gold:hover{
      background:
        radial-gradient(120% 100% at 50% -40%, rgba(255,255,255,.28), transparent 60%),
        linear-gradient(180deg, #F9E992 0%, #E3BD43 55%, #BE8E1A 100%);
    }
  `]
})
export class LojaFormDialogComponent {
  private fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    endereco: ['']
  });

  constructor(
    private ref: MatDialogRef<LojaFormDialogComponent, NovaLoja | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: LojaFormData
  ) {
    if (data.loja){
      this.form.patchValue({
        nome: data.loja.nome ?? '',
        endereco: data.loja.endereco ?? ''
      });
    }
  }

  submit(){
    if (this.form.invalid){ this.form.markAllAsTouched(); return; }
    this.ref.close(this.form.getRawValue() as NovaLoja);
  }
  close(){ this.ref.close(undefined); }
}
