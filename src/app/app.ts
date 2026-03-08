import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthStorageService } from './core/services/auth-storage.service';
import { MetaVendaDialogComponent } from './shared/meta-venda-dialog.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MatDialogModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private auth = inject(AuthStorageService);
  private dialog = inject(MatDialog);
  private storageListener?: (event: StorageEvent) => void;
  currentTheme: 'dark' | 'light' = 'dark';
  get showHeader() { return this.router.url !== '/login' && !!this.auth.token; }
  logout() { this.auth.clear(); this.router.navigateByUrl('/login'); }

  ngOnInit(): void {
    this.applyTheme();
    this.router.events
      .pipe(filter(event => event instanceof NavigationStart || event instanceof NavigationEnd))
      .subscribe((event) => {
        this.applyTheme();
        const url = event instanceof NavigationStart ? event.url : this.router.url;
        if (url === '/login' || url.startsWith('/login?')) {
          // garante logout quando volta para a tela de login
          if (this.auth.token) this.auth.clear();
        }
      });

    this.storageListener = (event: StorageEvent) => {
      if (event.key !== 'token' && event.key !== 'auth_user') return;
      const token = localStorage.getItem('token');
      const authUser = localStorage.getItem('auth_user');

      // se token foi removido em outra aba, derruba aqui tambem
      if (!token) {
        if (this.auth.token) {
          this.auth.clear();
          this.router.navigateByUrl('/login');
        }
        return;
      }

      // se mudou de usuario em outra aba, derruba esta sessao
      const currentUser = this.auth.userId ?? this.auth.email ?? '';
      if (authUser && currentUser && authUser !== currentUser) {
        this.auth.clear();
        this.router.navigateByUrl('/login');
      }
    };
    window.addEventListener('storage', this.storageListener);
  }

  ngOnDestroy(): void {
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalShortcut(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const key = event.key.toLowerCase();
    if (key !== 'q') return;
    if (this.isTextInput(event.target)) return;
    if (!this.isAdmin()) return;
    if (this.isAtalhoBlockedRoute()) return;

    event.preventDefault();
    this.dialog.open(MetaVendaDialogComponent, {
      panelClass: ['ml-dialog', 'ml-dialog-meta'],
      autoFocus: false,
      data: { lojaId: this.auth.lojaId },
    });
  }

  private applyTheme(): void {
    const body = document.body;
    body.classList.remove('theme-dark', 'theme-light');

    const params = new URLSearchParams(window.location.search);
    let theme: 'dark' | 'light' | '' = (params.get('theme')?.toLowerCase() as 'dark' | 'light' | null) ?? '';

    if (theme !== 'dark' && theme !== 'light') {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') theme = stored;
    }

    if (theme !== 'dark' && theme !== 'light') {
      try {
        if (window.matchMedia) {
          if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            theme = 'light';
          } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            theme = 'dark';
          }
        }
      } catch {
        // ignore and fallback below
      }
    }

    const finalTheme: 'dark' | 'light' = theme === 'light' ? 'light' : 'dark';
    this.currentTheme = finalTheme;
    body.classList.add(`theme-${finalTheme}`);
  }

  toggleTheme(): void {
    const next = this.currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    this.applyTheme();
  }

  private isAdmin(): boolean {
    return this.auth.nivelAcesso === 1;
  }

  private isAtalhoBlockedRoute(): boolean {
    const url = this.router.url || '';
    if (url === '/login' || url.startsWith('/login?')) return true;
    if (url === '/minhas-lojas' || url.startsWith('/minhas-lojas?')) return true;
    return false;
  }

  private isTextInput(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.closest('[contenteditable=\"true\"]')) return true;
    const tag = el.tagName?.toLowerCase();
    if (!tag) return false;
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }
}
