import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';


@Component({
  selector: 'app-root',
  standalone: true,
    imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent {
  private router = inject(Router);
  get showHeader() { return this.router.url !== '/login' && !!localStorage.getItem('token'); }
  logout() { localStorage.removeItem('token'); this.router.navigateByUrl('/login'); }
}
