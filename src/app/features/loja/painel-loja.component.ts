// src/app/features/loja/painel-loja.component.ts
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { UsuarioService, Loja } from '../../core/services/usuario.service';
import { FuncionarioFormDialogComponent } from './funcionarios/funcionario-form.dialog';
import { SetoresDialogComponent } from './setores/setores-dialog';

@Component({
  standalone: true,
  selector: 'app-painel-loja',
  imports: [CommonModule, RouterLink, MatDialogModule],
  template: `
    <section class="page">
      <header class="topbar">
        <a class="link" [routerLink]="['/minhas-lojas']">
          <span class="material-symbols-outlined">arrow_back</span>
          <span>Minhas Lojas</span>
        </a>

        <div class="title">
          <h2>{{ loja?.nome || 'Loja' }}</h2>
          <small class="muted" *ngIf="loja?.endereco">
            {{ loja?.endereco }}
          </small>
        </div>

        <span class="spacer"></span>
      </header>

      <!-- HOTBAR -->
      <nav class="hotbar">
        <button class="tab active" type="button">
          <span class="material-symbols-outlined">dashboard</span>
          <span>Painel</span>
        </button>

        <!-- MENU INVENTÁRIO -->
        <div class="menu-inv" (click)="$event.stopPropagation()">
          <button
            type="button"
            class="tab"
            (click)="toggleMenuInventario($event)"
            [class.disabled]="!loja"
          >
            <span class="material-symbols-outlined">inventory_2</span>
            <span>Inventário</span>
            <span class="material-symbols-outlined caret">
              {{ menuInventarioAberto ? 'expand_less' : 'expand_more' }}
            </span>
          </button>

          <div class="inv-menu" *ngIf="menuInventarioAberto">
            <button class="action-btn" type="button" (click)="irParaEstoqueViaMenu()">
              <span class="material-symbols-outlined">inventory_2</span>
              <span>Estoque</span>
            </button>

            <button class="action-btn" type="button" (click)="irParaServicos()">
              <span class="material-symbols-outlined">build</span>
              <span>Serviços</span>
            </button>
          </div>
        </div>

        <!-- SETORES -->
        <button class="tab" type="button" (click)="abrirGerenciarSetores()">
          <span class="material-symbols-outlined">category</span>
          <span>Setores</span>
        </button>

        <!-- MENU FUNCIONÁRIOS -->
        <div class="menu-func" (click)="$event.stopPropagation()">
          <button class="tab" type="button" (click)="toggleMenuFuncionarios($event)" [class.disabled]="!loja">
            <span class="material-symbols-outlined">group</span>
            <span>Funcionários</span>
            <span class="material-symbols-outlined caret">
              {{ menuFuncionariosAberto ? 'expand_less' : 'expand_more' }}
            </span>
          </button>

          <div class="func-menu" *ngIf="menuFuncionariosAberto">
            <button class="action-btn" type="button" (click)="irParaFuncionarios()">
              <span class="material-symbols-outlined">list</span>
              <span>Lista</span>
            </button>

            <button class="action-btn" type="button" (click)="abrirCadastroFuncionario()">
              <span class="material-symbols-outlined">person_add</span>
              <span>Cadastrar</span>
            </button>
          </div>
        </div>

        <button class="tab" type="button">
          <span class="material-symbols-outlined">receipt_long</span>
          <span>Relatórios</span>
        </button>

        <!-- PDV -->
        <button class="tab" type="button" (click)="irParaPdv()" [class.disabled]="!loja">
          <span class="material-symbols-outlined">point_of_sale</span>
          <span>PDV</span>
        </button>
      </nav>

      <!-- CONTEÚDO -->
      <main class="content">
        <div class="card chart">
          <header class="card__header">
            <h3>Resumo da loja</h3>
            <small class="muted"> {{ loja?.nome || 'Loja selecionada' }} — gráfico em breve </small>
          </header>

          <div class="chart-placeholder" role="img" aria-label="Gráfico em breve">
            <div class="spark"></div>
            <div class="grid">
              <div *ngFor="let _ of gridCols"></div>
            </div>
            <div class="legend muted">
              Área reservada para gráfico da loja (faturamento, vendas, etc.)
            </div>
          </div>
        </div>
      </main>
    </section>
  `,
  styles: [
    `
      .material-symbols-outlined {
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      }

      .page {
        min-height: 100dvh;
        padding: 20px 18px;
        background: var(--bg);
        color: var(--text);
      }

      .topbar {
        display: flex;
        align-items: center;
        gap: 16px;
        margin: 4px 0 14px;
      }

      .link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: 1px solid #d4af37;
        color: var(--text);
        border-radius: 999px;
        height: 36px;
        padding: 0 12px;
        cursor: pointer;
        text-decoration: none;
      }
      .link:hover {
        background: rgba(240, 210, 122, 0.1);
        box-shadow: 0 0 14px rgba(240, 210, 122, 0.45);
      }

      .title h2 {
        margin: 0;
        font-size: 1.4rem;
      }
      .title .muted {
        font-size: 0.85rem;
      }
      .spacer {
        flex: 1;
      }

      .hotbar {
        display: flex;
        gap: 10px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .tab {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 999px;
        border: 1px solid #d4af37;
        background: #050814;
        color: var(--text);
        cursor: pointer;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
        transition: background 0.15s, box-shadow 0.2s, transform 0.05s, color 0.15s;
        font-size: 0.9rem;
      }

      .tab .material-symbols-outlined {
        font-size: 18px;
      }

      .tab:hover {
        background: rgba(250, 215, 100, 0.14);
        box-shadow: 0 0 0 1px rgba(250, 215, 100, 0.4), 0 0 18px rgba(250, 215, 100, 0.28);
        transform: translateY(-1px);
      }

      .tab.active {
        background: radial-gradient(120% 120% at 50% -20%, rgba(255, 255, 255, 0.2), transparent 55%),
          linear-gradient(180deg, #f5df7b 0%, #e3bd43 55%, #be8e1a 100%);
        color: #141414;
        box-shadow: 0 10px 24px rgba(218, 171, 31, 0.45);
        border-color: #9e7b14;
      }

      .tab.disabled {
        opacity: 0.5;
        cursor: default;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
        transform: none;
        pointer-events: none;
      }

      .caret {
        font-size: 18px;
        margin-left: 2px;
      }

      .menu-func,
      .menu-inv {
        position: relative;
      }

      .func-menu,
      .inv-menu {
        position: absolute;
        top: 110%;
        left: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        background: #050814;
        border-radius: 14px;
        border: 1px solid #d4af37;
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.8);
        z-index: 50;
        min-width: 210px;
      }

      .action-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 10px;
        border: 1px solid #d4af37;
        background: transparent;
        color: var(--text);
        cursor: pointer;
        font-size: 0.86rem;
        transition: background 0.15s, box-shadow 0.2s, transform 0.05s;
        text-align: left;
      }
      .action-btn .material-symbols-outlined {
        font-size: 18px;
      }

      .action-btn:hover {
        background: rgba(250, 215, 100, 0.14);
        box-shadow: 0 0 0 1px rgba(250, 215, 100, 0.4), 0 0 18px rgba(250, 215, 100, 0.2);
        transform: translateY(-1px);
      }

      .content {
        display: block;
      }

      .card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        padding: 16px 16px 18px;
      }
      .card__header {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin-bottom: 12px;
      }

      .chart {
        min-height: 420px;
      }

      .chart-placeholder {
        position: relative;
        height: 360px;
        border: 1px dashed var(--border);
        border-radius: 14px;
        display: grid;
        place-items: center;
        overflow: hidden;
        background: radial-gradient(900px 500px at 100% 0, rgba(99, 102, 241, 0.05), transparent 55%),
          radial-gradient(900px 500px at 0 100%, rgba(37, 99, 235, 0.05), transparent 55%);
      }

      .chart-placeholder .spark {
        position: absolute;
        inset: -20% -10% auto -10%;
        height: 120px;
        filter: blur(18px);
        opacity: 0.25;
        background: linear-gradient(115deg, transparent 0%, #fff 15%, transparent 30%);
        animation: slide 2.8s ease-in-out infinite;
      }
      @keyframes slide {
        0% {
          transform: translateX(-60%);
        }
        100% {
          transform: translateX(160%);
        }
      }

      .chart-placeholder .grid {
        position: absolute;
        inset: 20px;
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 10px;
        opacity: 0.5;
      }
      .chart-placeholder .grid > div {
        background: rgba(127, 127, 127, 0.08);
        border-radius: 10px;
        height: 48%;
      }

      .chart-placeholder .legend {
        position: absolute;
        bottom: 12px;
        left: 16px;
      }

      .muted {
        color: var(--muted);
      }
    `,
  ],
})
export class PainelLojaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(UsuarioService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  loja: Loja | null = null;
  gridCols = Array.from({ length: 12 });

  menuFuncionariosAberto = false;
  menuInventarioAberto = false;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id)) return;

    this.api.loja(id).subscribe({
      next: (l) => (this.loja = l),
      error: () => (this.loja = null),
    });
  }

  @HostListener('document:click')
  fecharMenus(): void {
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;
  }

  toggleMenuFuncionarios(ev?: MouseEvent): void {
    ev?.stopPropagation();
    if (!this.loja) return;
    this.menuInventarioAberto = false;
    this.menuFuncionariosAberto = !this.menuFuncionariosAberto;
  }

  toggleMenuInventario(ev?: MouseEvent): void {
    ev?.stopPropagation();
    if (!this.loja) return;
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = !this.menuInventarioAberto;
  }

  irParaFuncionarios(): void {
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;
    if (!this.loja?.id) return;
    this.router.navigate(['/loja', this.loja.id, 'funcionarios']);
  }

  abrirCadastroFuncionario(): void {
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;

    this.dialog.open(FuncionarioFormDialogComponent, {
      autoFocus: false,
      panelClass: 'ml-dialog',
    });
  }

  abrirGerenciarSetores(): void {
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;

    this.dialog.open(SetoresDialogComponent, {
      autoFocus: false,
      panelClass: 'ml-dialog',
    });
  }

  irParaEstoqueViaMenu(): void {
    this.menuInventarioAberto = false;
    if (!this.loja?.id) return;
    this.router.navigate(['/loja', this.loja.id, 'estoque']);
  }

  irParaServicos(): void {
    this.menuInventarioAberto = false;
    if (!this.loja?.id) return;
    this.router.navigate(['/loja', this.loja.id, 'servicos']);
  }

  irParaPdv(): void {
    this.menuFuncionariosAberto = false;
    this.menuInventarioAberto = false;

    if (!this.loja?.id) return;
    this.router.navigate(['/loja', this.loja.id, 'pdv']);
  }
}
