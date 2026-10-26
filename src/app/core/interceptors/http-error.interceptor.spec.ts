import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { httpErrorInterceptor } from './http-error.interceptor';
import { AuthStorageService } from '../services/auth-storage.service';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthStorageService, useValue: { token: null, clear: () => undefined } },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  function erroDe(body: string | object, status: number): HttpErrorResponse {
    let recebido!: HttpErrorResponse;
    http.get('/api/x').subscribe({ error: e => (recebido = e) });
    ctrl.expectOne('/api/x').flush(body, { status, statusText: 'erro' });
    return recebido;
  }

  it('bug 9: transforma erro de validacao ({ errors }) em message legivel', () => {
    const e = erroDe({ title: 'One or more validation errors occurred.', errors: { Percent: ['Percentual deve estar entre -99,99 e 100,00.'] } }, 400);
    expect(e.error.message).toBe('Percentual deve estar entre -99,99 e 100,00.');
  });

  it('mantem a mensagem de negocio enviada pelo backend', () => {
    const e = erroDe({ message: 'Venda não está aberta.' }, 400);
    expect(e.error.message).toBe('Venda não está aberta.');
  });

  it('esconde stack trace e mostra mensagem amigavel', () => {
    spyOn(console, 'error');
    const e = erroDe('System.InvalidOperationException: falhou\n   at X.Y()', 500);
    expect(e.error.message).toContain('erro inesperado');
  });
});
