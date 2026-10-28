import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { ReposicaoKanbanDialogComponent } from './reposicao-kanban.dialog';
import {
  dicaMinimo,
  parseQuantidadeMinima,
  placeholderMinimo,
  textoBaseGiro,
  textoDuracao,
  textoHaQuanto,
  textoRitmo,
} from './estoque-minimo';
import { ProdutoService, ReposicaoDto, ReposicaoItemDto } from '../../../core/services/produto.service';

const item = (over: Partial<ReposicaoItemDto>): ReposicaoItemDto => ({
  id: 1, nome: 'Produto', setorFilhoId: 1, quantidade: 0, estoqueMinimo: null, minimoAutomatico: null,
  minimo: null, meio: null, maximo: null, precoCusto: 10, precoVenda: 20, margemLucro: 100,
  giroDiario: null, baseGiro: null, diasSemEstoque: 0, diasDeEstoque: null, diasAteMinimo: null,
  sugestaoCompra: 0, excedente: 0, coluna: 'OK', prioridade: 0, parado: false,
  ultimaMovimentacao: null, ultimaCompra: null, ...over,
});

describe('parseQuantidadeMinima', () => {
  it('le numero, decimal com virgula, milhar e vazio (= automatico)', () => {
    expect(parseQuantidadeMinima('10')).toEqual({ ok: true, valor: 10 });
    expect(parseQuantidadeMinima(' 2,5 ')).toEqual({ ok: true, valor: 2.5 });
    expect(parseQuantidadeMinima('1.500')).toEqual({ ok: true, valor: 1500 });
    expect(parseQuantidadeMinima('2.5')).toEqual({ ok: true, valor: 2.5 });
    expect(parseQuantidadeMinima('0')).toEqual({ ok: true, valor: 0 });
    expect(parseQuantidadeMinima('')).toEqual({ ok: true, valor: null });
  });

  it('recusa negativo, texto e valor absurdo', () => {
    expect(parseQuantidadeMinima('-1').ok).toBeFalse();
    expect(parseQuantidadeMinima('abc').ok).toBeFalse();
    expect(parseQuantidadeMinima('2000000').ok).toBeFalse();
  });
});

describe('textos do estoque minimo', () => {
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
    expect(textoBaseGiro(item({ baseGiro: 'RECENTE', diasSemEstoque: 12 })))
      .toBe('Média de 3 meses, com peso maior no último mês · sem contar 12 dias sem estoque');
    expect(textoBaseGiro(item({ baseGiro: 'SEMESTRE', diasSemEstoque: 1 }))).toBe('Média de 6 meses (vende pouco) · sem contar 1 dia sem estoque');
    expect(textoBaseGiro(item({ baseGiro: null }))).toBe('');
  });

  it('campo vazio mostra o automatico; a dica explica automatico, fixado e sem vendas', () => {
    expect(placeholderMinimo(item({ minimoAutomatico: 21 }))).toBe('21');
    expect(placeholderMinimo(item({}))).toBe('—');
    expect(dicaMinimo(item({ minimoAutomatico: 21, giroDiario: 3 }))).toContain('Automático: 21');
    expect(dicaMinimo(item({ estoqueMinimo: 5, minimoAutomatico: 21 }))).toContain('o automático seria 21');
    expect(dicaMinimo(item({ estoqueMinimo: 0 }))).toContain('Não acompanhado');
    expect(dicaMinimo(item({}))).toContain('Sem vendas nos últimos 6 meses');
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
  let ref: { close: jasmine.Spy };

  const quadro = (itens: ReposicaoItemDto[]): ReposicaoDto => ({ diasMinimo: 7, diasMeio: 14, diasMaximo: 28, itens });

  /** Simula o operador digitando no campo do minimo e saindo dele. */
  function digitarMinimo(alvo: ReposicaoItemDto, texto: string) {
    const input = document.createElement('input');
    input.value = texto;
    c.salvarMinimo(alvo, { target: input } as any);
    return input;
  }

  beforeEach(() => {
    produtos = jasmine.createSpyObj<ProdutoService>('ProdutoService', ['listarReposicao', 'definirEstoqueMinimo']);
    ref = { close: jasmine.createSpy('close') };
    TestBed.configureTestingModule({
      imports: [ReposicaoKanbanDialogComponent],
      providers: [
        { provide: ProdutoService, useValue: produtos },
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

  it('salva o minimo, recalcula o quadro e avisa quem abriu ao fechar', () => {
    const meia = item({ id: 2, nome: 'Meia', quantidade: 3, coluna: 'ATENCAO', minimoAutomatico: 2 });
    produtos.listarReposicao.and.returnValues(
      of(quadro([meia])),
      of(quadro([{ ...meia, estoqueMinimo: 10, minimo: 10, coluna: 'REPOR', prioridade: 42 }])),
    );
    produtos.definirEstoqueMinimo.and.returnValue(of(undefined));
    c.ngOnInit();

    digitarMinimo(meia, '10');

    expect(produtos.definirEstoqueMinimo).toHaveBeenCalledOnceWith(2, 10);
    expect(c.itensDa('REPOR').map(i => i.estoqueMinimo)).toEqual([10]);
    c.fechar();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('nao envia nada para o mesmo valor, Esc ou texto invalido', () => {
    const meia = item({ id: 2, estoqueMinimo: 10, coluna: 'REPOR' });
    produtos.listarReposicao.and.returnValue(of(quadro([meia])));
    c.ngOnInit();

    digitarMinimo(meia, '10');
    const input = document.createElement('input');
    input.value = '99';
    c.cancelarMinimo(meia, { target: input } as any);
    c.salvarMinimo(meia, { target: input } as any);
    expect(input.value).toBe('10');
    digitarMinimo(meia, 'abc');

    expect(produtos.definirEstoqueMinimo).not.toHaveBeenCalled();
    expect(c.errosMinimo.get(2)).toContain('número');
    c.fechar();
    expect(ref.close).toHaveBeenCalledWith(false);
  });

  it('campo vazio volta ao minimo automatico', () => {
    const meia = item({ id: 2, estoqueMinimo: 10, coluna: 'REPOR' });
    produtos.listarReposicao.and.returnValue(of(quadro([meia])));
    produtos.definirEstoqueMinimo.and.returnValue(of(undefined));
    c.ngOnInit();

    digitarMinimo(meia, '');

    expect(produtos.definirEstoqueMinimo).toHaveBeenCalledOnceWith(2, null);
  });

  it('mostra aviso de permissao e volta o valor quando o servidor recusa', () => {
    spyOn(console, 'error');
    const meia = item({ id: 2, estoqueMinimo: 10, coluna: 'REPOR' });
    produtos.listarReposicao.and.returnValue(of(quadro([meia])));
    produtos.definirEstoqueMinimo.and.returnValue(throwError(() => ({ status: 403 })));
    c.ngOnInit();

    const input = digitarMinimo(meia, '4');

    expect(c.errosMinimo.get(2)).toContain('permissão');
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

  it('rodape: base da media, automatico quando o minimo foi fixado e ultima compra', () => {
    produtos.listarReposicao.and.returnValue(of(quadro([])));
    c.ngOnInit();

    expect(c.textoRodape(item({ baseGiro: 'TRIMESTRE', estoqueMinimo: 5, minimoAutomatico: 21 })))
      .toBe('Média de 3 meses (pouca venda no último mês) · mínimo automático seria 21');
    expect(c.textoRodape(item({ ultimaCompra: new Date().toISOString() }))).toBe('última compra hoje');
    expect(c.textoRodape(item({}))).toBe('');
  });
});
