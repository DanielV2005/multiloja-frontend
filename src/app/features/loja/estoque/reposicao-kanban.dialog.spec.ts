import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { ReposicaoKanbanDialogComponent } from './reposicao-kanban.dialog';
import { CurvaAbcService } from '../../../core/services/curva-abc.service';
import { AuthStorageService } from '../../../core/services/auth-storage.service';
import { ClasseAbc } from '../../../shared/curva-abc';
import {
  dicaMaximo,
  parseQuantidadeMaxima,
  placeholderMaximo,
  textoBaseGiro,
  textoDuracao,
  textoHaQuanto,
  textoRitmo,
} from './estoque-maximo';
import { ProdutoService, ReposicaoDto, ReposicaoItemDto } from '../../../core/services/produto.service';

const item = (over: Partial<ReposicaoItemDto>): ReposicaoItemDto => ({
  id: 1, nome: 'Produto', setorFilhoId: 1, quantidade: 0, estoqueMaximo: null, maximoAutomatico: null,
  minimo: null, meio: null, maximo: null, precoCusto: 10, precoVenda: 20, margemLucro: 100,
  giroDiario: null, baseGiro: null, diasSemEstoque: 0, diasDeEstoque: null, diasAteMinimo: null,
  sugestaoCompra: 0, excedente: 0, coluna: 'OK', prioridade: 0,
  ultimaMovimentacao: null, ultimaCompra: null, ultimaVenda: null, diasSemVender: null, encalhado: false,
  diasZeradoRecente: 0, vendaPerdida: 0, valorVendaPerdida: 0,
  vendidoRecente: 0, diasComEstoqueRecente: 14, giroRecente: 0, giroAnterior: null, tendencia: null, ...over,
});

describe('parseQuantidadeMaxima', () => {
  it('le numero, decimal com virgula, milhar e vazio (= automatico)', () => {
    expect(parseQuantidadeMaxima('10')).toEqual({ ok: true, valor: 10 });
    expect(parseQuantidadeMaxima(' 2,5 ')).toEqual({ ok: true, valor: 2.5 });
    expect(parseQuantidadeMaxima('1.500')).toEqual({ ok: true, valor: 1500 });
    expect(parseQuantidadeMaxima('2.5')).toEqual({ ok: true, valor: 2.5 });
    expect(parseQuantidadeMaxima('0')).toEqual({ ok: true, valor: 0 });
    expect(parseQuantidadeMaxima('')).toEqual({ ok: true, valor: null });
  });

  it('recusa negativo, texto e valor absurdo', () => {
    expect(parseQuantidadeMaxima('-1').ok).toBeFalse();
    expect(parseQuantidadeMaxima('abc').ok).toBeFalse();
    expect(parseQuantidadeMaxima('2000000').ok).toBeFalse();
  });
});

describe('textos do estoque maximo', () => {
  it('ritmo na unidade que da numero de gente', () => {
    expect(textoRitmo(3)).toBe('~3/dia');
    expect(textoRitmo(0.5)).toBe('~3,5/semana');
    expect(textoRitmo(0.05)).toBe('~1,5/mês');
  });

  it('duracao arredondada', () => {
    expect(textoDuracao(0.4)).toBe('menos de 1 dia');
    expect(textoDuracao(1.2)).toBe('~1 dia');
    expect(textoDuracao(9.6)).toBe('~10 dias');
    expect(textoDuracao(95)).toBe('~3 meses');
  });

  it('de onde saiu a media e os dias zerados que ficaram de fora', () => {
    expect(textoBaseGiro(item({ baseGiro: 'TRIMESTRE', diasSemEstoque: 12 })))
      .toBe('Média de vendas dos últimos 3 meses · sem contar 12 dias sem estoque');
    expect(textoBaseGiro(item({ baseGiro: 'SEMESTRE', diasSemEstoque: 1 }))).toBe('Média de 6 meses (poucas vendas nos últimos 3 meses) · sem contar 1 dia sem estoque');
    expect(textoBaseGiro(item({ baseGiro: null }))).toBe('');
  });

  it('campo vazio mostra o automatico; a dica explica automatico, fixado e sem vendas', () => {
    expect(placeholderMaximo(item({ maximoAutomatico: 84 }))).toBe('84');
    expect(placeholderMaximo(item({}))).toBe('—');
    expect(dicaMaximo(item({ maximoAutomatico: 84, giroDiario: 3, minimo: 21, meio: 42 })))
      .toContain('Automático: 84 (4 semanas de venda; vende ~3/dia). Mínimo 21, meio 42.');
    expect(dicaMaximo(item({ estoqueMaximo: 10, maximoAutomatico: 84, minimo: 3, meio: 5 })))
      .toBe('Máximo fixado por você. Mínimo 3, meio 5. Pelas vendas, o automático seria 84. Apague para voltar ao automático.');
    expect(dicaMaximo(item({ estoqueMaximo: 0 }))).toContain('Não acompanhado');
    expect(dicaMaximo(item({}))).toContain('Sem vendas nos últimos 6 meses');
  });

  it('ha quanto tempo', () => {
    const agora = new Date('2026-10-28T12:00:00Z');
    expect(textoHaQuanto('2026-10-28T09:00:00Z', agora)).toBe('hoje');
    expect(textoHaQuanto('2026-10-27T09:00:00Z', agora)).toBe('ontem');
    expect(textoHaQuanto('2026-10-16T12:00:00Z', agora)).toBe('há 12 dias');
    expect(textoHaQuanto('2026-07-20T12:00:00Z', agora)).toBe('há 3 meses');
  });
});

describe('ReposicaoKanbanDialogComponent', () => {
  let c: ReposicaoKanbanDialogComponent;
  let produtos: jasmine.SpyObj<ProdutoService>;
  let curvaAbc: { dias: number; ultimos90Dias: jasmine.Spy };
  let router: { navigate: jasmine.Spy };
  let ref: { close: jasmine.Spy };

  const quadro = (itens: ReposicaoItemDto[]): ReposicaoDto => ({
    diasMinimo: 7, diasMeio: 14, diasMaximo: 28, diasVendaPerdida: 30, diasEncalhado: 60, diasTendencia: 14, itens,
  });

  /** Simula o operador digitando no campo do maximo e saindo dele. */
  function digitarMaximo(alvo: ReposicaoItemDto, texto: string) {
    const input = document.createElement('input');
    input.value = texto;
    c.salvarMaximo(alvo, { target: input } as any);
    return input;
  }

  beforeEach(() => {
    produtos = jasmine.createSpyObj<ProdutoService>('ProdutoService', ['listarReposicao', 'definirEstoqueMaximo']);
    curvaAbc = { dias: 90, ultimos90Dias: jasmine.createSpy('ultimos90Dias').and.returnValue(of(new Map<number, ClasseAbc>())) };
    router = { navigate: jasmine.createSpy('navigate') };
    ref = { close: jasmine.createSpy('close') };
    TestBed.configureTestingModule({
      imports: [ReposicaoKanbanDialogComponent],
      providers: [
        { provide: ProdutoService, useValue: produtos },
        { provide: CurvaAbcService, useValue: curvaAbc },
        { provide: AuthStorageService, useValue: { lojaId: 3 } },
        { provide: Router, useValue: router },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    c = TestBed.createComponent(ReposicaoKanbanDialogComponent).componentInstance;
  });

  it('distribui os produtos nas colunas na ordem do servidor e conta os que ficam fora do quadro', () => {
    produtos.listarReposicao.and.returnValue(of(quadro([
      item({ id: 1, nome: 'Camiseta', coluna: 'SEM_ESTOQUE', prioridade: 100 }),
      item({ id: 2, nome: 'Meia', coluna: 'REPOR', prioridade: 42 }),
      item({ id: 3, nome: 'Bone', coluna: 'OK' }),
      item({ id: 4, nome: 'Cinto', coluna: 'SEM_ESTOQUE', prioridade: 60 }),
      item({ id: 5, nome: 'Brinde', coluna: 'NAO_MONITORADO' }),
      item({ id: 6, nome: 'Novo', coluna: 'SEM_HISTORICO' }),
      item({ id: 7, nome: 'Novo 2', coluna: 'SEM_HISTORICO' }),
    ])));

    c.ngOnInit();

    expect(c.itensDa('SEM_ESTOQUE').map(i => i.nome)).toEqual(['Camiseta', 'Cinto']);
    expect(c.itensDa('REPOR').map(i => i.nome)).toEqual(['Meia']);
    expect(c.itensDa('ATENCAO')).toEqual([]);
    expect(c.totalOk).toBe(1);
    expect(c.totalNaoMonitorado).toBe(1);
    expect(c.totalSemHistorico).toBe(2);

    c.onFiltro('cin');
    expect(c.itensDa('SEM_ESTOQUE').map(i => i.nome)).toEqual(['Cinto']);
    expect(c.itensDa('REPOR')).toEqual([]);
  });

  it('no excesso, primeiro onde ha mais dinheiro parado', () => {
    produtos.listarReposicao.and.returnValue(of(quadro([
      item({ id: 1, nome: 'Barato', coluna: 'EXCESSO', excedente: 50, precoCusto: 1 }),     // R$ 50
      item({ id: 2, nome: 'Caro', coluna: 'EXCESSO', excedente: 2, precoCusto: 100 }),      // R$ 200
      item({ id: 3, nome: 'Sem custo', coluna: 'EXCESSO', excedente: 9, precoCusto: 0 }),
    ])));

    c.ngOnInit();

    expect(c.itensDa('EXCESSO').map(i => i.nome)).toEqual(['Caro', 'Barato', 'Sem custo']);
    expect(c.valorExcessoTotal).toBe(250);
  });

  it('salva o maximo, recalcula o quadro e avisa quem abriu ao fechar', () => {
    const meia = item({ id: 2, nome: 'Meia', quantidade: 3, coluna: 'ATENCAO', maximoAutomatico: 8 });
    produtos.listarReposicao.and.returnValues(
      of(quadro([meia])),
      of(quadro([{ ...meia, estoqueMaximo: 40, minimo: 10, meio: 20, maximo: 40, coluna: 'REPOR', prioridade: 42 }])),
    );
    produtos.definirEstoqueMaximo.and.returnValue(of(undefined));
    c.ngOnInit();

    digitarMaximo(meia, '40');

    expect(produtos.definirEstoqueMaximo).toHaveBeenCalledOnceWith(2, 40);
    expect(c.itensDa('REPOR').map(i => i.estoqueMaximo)).toEqual([40]);
    c.fechar();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('nao envia nada para o mesmo valor, Esc ou texto invalido', () => {
    const meia = item({ id: 2, estoqueMaximo: 10, coluna: 'REPOR' });
    produtos.listarReposicao.and.returnValue(of(quadro([meia])));
    c.ngOnInit();

    digitarMaximo(meia, '10');
    const input = document.createElement('input');
    input.value = '99';
    c.cancelarMaximo(meia, { target: input } as any);
    c.salvarMaximo(meia, { target: input } as any);
    expect(input.value).toBe('10');
    digitarMaximo(meia, 'abc');

    expect(produtos.definirEstoqueMaximo).not.toHaveBeenCalled();
    expect(c.errosMaximo.get(2)).toContain('número');
    c.fechar();
    expect(ref.close).toHaveBeenCalledWith(false);
  });

  it('campo vazio volta ao maximo automatico', () => {
    const meia = item({ id: 2, estoqueMaximo: 10, coluna: 'REPOR' });
    produtos.listarReposicao.and.returnValue(of(quadro([meia])));
    produtos.definirEstoqueMaximo.and.returnValue(of(undefined));
    c.ngOnInit();

    digitarMaximo(meia, '');

    expect(produtos.definirEstoqueMaximo).toHaveBeenCalledOnceWith(2, null);
  });

  it('mostra aviso de permissao e volta o valor quando o servidor recusa', () => {
    spyOn(console, 'error');
    const meia = item({ id: 2, estoqueMaximo: 10, coluna: 'REPOR' });
    produtos.listarReposicao.and.returnValue(of(quadro([meia])));
    produtos.definirEstoqueMaximo.and.returnValue(throwError(() => ({ status: 403 })));
    c.ngOnInit();

    const input = digitarMaximo(meia, '4');

    expect(c.errosMaximo.get(2)).toContain('permissão');
    expect(input.value).toBe('10');
    expect(c.salvando.has(2)).toBeFalse();
  });

  it('erro ao carregar mostra mensagem em vez de quadro vazio', () => {
    spyOn(console, 'error');
    const resposta = new Subject<ReposicaoDto>();
    produtos.listarReposicao.and.returnValue(resposta);
    c.ngOnInit();
    expect(c.loading).toBeTrue();

    resposta.error({ status: 500 });

    expect(c.loading).toBeFalse();
    expect(c.erro).toContain('Não foi possível');
  });

  it('descreve o ritmo, quando pedir e a barra de 0 ao maximo', () => {
    produtos.listarReposicao.and.returnValue(of(quadro([])));
    c.ngOnInit();

    expect(c.textoGiro(item({ giroDiario: null }))).toBe('Sem vendas nos últimos 6 meses');
    expect(c.textoGiro(item({ quantidade: 8, giroDiario: 0.5, diasDeEstoque: 16 }))).toBe('Vende ~3,5/semana · dura ~16 dias');
    expect(c.textoGiro(item({ quantidade: 0, giroDiario: 3 }))).toBe('Vende ~3/dia · acabou');
    expect(c.textoGiro(item({ quantidade: 30, giroDiario: 3, diasDeEstoque: 10, diasAteMinimo: 3, coluna: 'ATENCAO' })))
      .toBe('Vende ~3/dia · dura ~10 dias · pedir em ~3 dias');

    const p = item({ quantidade: 42, minimo: 21, meio: 42, maximo: 84 });
    expect(c.posicao(p, p.minimo)).toBe(25);
    expect(c.posicao(p, p.meio)).toBe(50);
    expect(c.larguraBarra(p)).toBe(50);
    expect(c.larguraBarra(item({ quantidade: 200, maximo: 84 }))).toBe(100);
    expect(c.larguraBarra(item({ quantidade: 5, maximo: null }))).toBe(0);
  });

  it('rodape: base da media, automatico quando o maximo foi fixado e ultima compra', () => {
    produtos.listarReposicao.and.returnValue(of(quadro([])));
    c.ngOnInit();

    expect(c.textoRodape(item({ baseGiro: 'TRIMESTRE', estoqueMaximo: 10, maximoAutomatico: 84 })))
      .toBe('Média de vendas dos últimos 3 meses · máximo automático seria 84');
    expect(c.textoRodape(item({ ultimaCompra: new Date().toISOString() }))).toBe('última compra hoje');
    expect(c.textoRodape(item({}))).toBe('');
  });

  it('selo da curva ABC dos ultimos 90 dias; sem as vendas do PDV o quadro funciona sem selo', () => {
    curvaAbc.ultimos90Dias.and.returnValue(of(new Map<number, ClasseAbc>([[1, 'A'], [2, 'C']])));
    produtos.listarReposicao.and.returnValue(of(quadro([])));
    c.ngOnInit();

    expect(c.classe(item({ id: 1 }))).toBe('A');
    expect(c.classe(item({ id: 2 }))).toBe('C');
    expect(c.classe(item({ id: 9 }))).toBeNull();          // nao vendeu nos 90 dias
    expect(c.dicaClasse('A')).toContain('80% do faturamento');

    curvaAbc.ultimos90Dias.and.returnValue(throwError(() => ({ status: 500 })));
    c.ngOnInit();
    expect(c.classe(item({ id: 1 }))).toBeNull();
  });

  it('explica a venda perdida do cartao', () => {
    produtos.listarReposicao.and.returnValue(of(quadro([])));
    c.ngOnInit();

    expect(c.dicaPerdida(item({ diasZeradoRecente: 12, giroDiario: 0.5, vendaPerdida: 6 })))
      .toBe('Ficou 12 dias sem estoque; vendendo ~3,5/semana, deixou de vender ~6 un. (estimativa pelo preço de venda).');
  });

  it('mudanca brusca no cartao e quantos dos em dia estao em alta', () => {
    produtos.listarReposicao.and.returnValue(of(quadro([
      item({ id: 1, nome: 'Pistola', coluna: 'ATENCAO', tendencia: 'ALTA', quantidade: 1, vendidoRecente: 7, giroRecente: 0.5, giroAnterior: 0.033 }),
      item({ id: 2, nome: 'Chiclets', coluna: 'EXCESSO', tendencia: 'QUEDA', quantidade: 62, giroAnterior: 0.811 }),
      item({ id: 3, nome: 'Bermuda', coluna: 'OK', tendencia: 'ALTA' }),
      item({ id: 4, nome: 'Meia', coluna: 'OK' }),
    ])));
    const fixture = TestBed.createComponent(ReposicaoKanbanDialogComponent);
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;
    const quadroTela = fixture.componentInstance;

    expect(quadroTela.totalOk).toBe(2);
    expect(quadroTela.totalOkEmAlta).toBe(1);
    expect(tela.querySelector('.resumo')!.textContent).toContain('(1 em alta)');
    expect([...tela.querySelectorAll('.cartao .tendencia')].map(e => e.textContent!.trim())).toEqual([
      '↑ Em alta: vendeu 7 em 14 dias (antes ~1/mês)',
      '↓ Em queda: não vendeu nos últimos 14 dias (esperado ~11)',
    ]);
    expect(tela.querySelector('.cartao .tendencia')!.getAttribute('title')).toContain('acaba em ~2 dias nesse ritmo');
    fixture.destroy();
  });

  it('montar lista de compra fecha o quadro e abre a lista da loja', () => {
    produtos.listarReposicao.and.returnValue(of(quadro([])));
    c.ngOnInit();

    c.abrirListaCompra();

    expect(ref.close).toHaveBeenCalledWith(false);
    expect(router.navigate).toHaveBeenCalledWith(['/loja', 3, 'relatorios', 'lista-de-compra']);
  });
});
