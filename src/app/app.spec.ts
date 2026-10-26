import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app';
import { AuthStorageService } from './core/services/auth-storage.service';

describe('AppComponent', () => {
  let token: string | null;

  beforeEach(async () => {
    token = null;
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStorageService, useValue: { get token() { return token; }, clear: () => (token = null) } },
      ],
    }).compileComponents();
  });

  it('cria o componente', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('esconde o botao de tema sem usuario logado e mostra com login', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.theme-toggle')).toBeNull();

    token = 'jwt';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.theme-toggle')).not.toBeNull();
  });
});
