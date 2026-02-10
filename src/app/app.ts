import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStorageService } from './core/services/auth-storage.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private auth = inject(AuthStorageService);
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
}
