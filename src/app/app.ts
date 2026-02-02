import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  currentTheme: 'dark' | 'light' = 'dark';
  get showHeader() { return this.router.url !== '/login' && !!localStorage.getItem('token'); }
  logout() { localStorage.removeItem('token'); this.router.navigateByUrl('/login'); }

  ngOnInit(): void {
    this.applyTheme();
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.applyTheme());
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
