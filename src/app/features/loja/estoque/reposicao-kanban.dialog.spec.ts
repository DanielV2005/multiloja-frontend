import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { ReposicaoKanbanDialogComponent } from './reposicao-kanban.dialog';
import { parseQuantidadeMinima } from './estoque-minimo';
import { ProdutoService, ReposicaoDto, ReposicaoItemDto } from '../../../core/services/produto.service';

describe('parseQuantidadeMinima', () => {
  it('le numero, decimal com virgula, milhar e vazio (= padrao)', () => {
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

describe('ReposicaoKanbanDialogComponent', () => {
  let c: ReposicaoKanbanDialogComponent;
  let produtos: jasmine.SpyObj<ProdutoService>;
  let ref: { close: jasmine.Spy };

  const item = (over: Partial<ReposicaoItemDto>): ReposicaoItemDto => ({
    id: 1, nome: 'Produto', setorFilhoId: 1, quantidade: 0, estoqueMinimo: null, minimoUsado: 5,
    precoCusto: 10, precoVenda: 20, margemLucro: 100, vendidoNoPeriodo: 0, giroDiario: 0, diasDeEstoque: null,
    faltaParaMinimo: 0, cobertura: 0, coluna: 'OK', prioridade: 0, parado: false, ultimaMovimentacao: null, ...over,
  });
  const quadro = (itens: ReposicaoItemDto[]): ReposicaoDto => ({ diasAnalisados: 30, minimoPadrao: 5, itens });

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

  it('distribui os produtos nas colunas na ordem do servidor e conta os que estao em dia', () => {
    produtos.listarReposicao.and.returnValue(of(quadro([
      item({ id: 1, nome: 'Camiseta', coluna: 'SEM_ESTOQUE', prioridade: 100 }),
      item({ id: 2, nome: 'Meia', coluna: 'CRITICO', prioridade: 42 }),
      item({ id: 3, nome: 'Bone', coluna: 'OK' }),
      item({ id: 4, nome: 'Cinto', coluna: 'SEM_ESTOQUE', prioridade: 60 }),
      item({ id: 5, nome: 'Brinde', coluna: 'NAO_MONITORADO' }),
    ])));

    c.ngOnInit();

    expect(c.itensDa('SEM_ESTOQUE').map(i => i.nome)).toEqual(['Camiseta', 'Cinto']);
    expect(c.itensDa('CRITICO').map(i => i.nome)).toEqual(['Meia']);
    expect(c.itensDa('REPOR')).toEqual([]);
    expect(c.totalOk).toBe(1);
    expect(c.totalNaoMonitorado).toBe(1);

    c.onFiltro('cin');
    expect(c.itensDa('SEM_ESTOQUE').map(i => i.nome)).toEqual(['Cinto']);
    expect(c.itensDa('CRITICO')).toEqual([]);
  });

  it('salva o minimo, recalcula o quadro e avisa quem abriu ao fechar', () => {
    const meia = item({ id: 2, nome: 'Meia', quantidade: 3, coluna: 'REPOR' });
    produtos.listarReposicao.and.returnValues(
      of(quadro([meia])),
      of(quadro([{ ...meia, estoqueMinimo: 10, coluna: 'CRITICO', prioridade: 42 }])),
    );
    produtos.definirEstoqueMinimo.and.returnValue(of(undefined));
    c.ngOnInit();

    digitarMinimo(meia, '10');

    expect(produtos.definirEstoqueMinimo).toHaveBeenCalledOnceWith(2, 10);
    expect(c.itensDa('CRITICO').map(i => i.estoqueMinimo)).toEqual([10]);
    c.fechar();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('nao envia nada para o mesmo valor, Esc ou texto invalido', () => {
    const meia = item({ id: 2, estoqueMinimo: 10, coluna: 'CRITICO' });
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

  it('campo vazio volta ao minimo padrao', () => {
    const meia = item({ id: 2, estoqueMinimo: 10, coluna: 'CRITICO' });
    produtos.listarReposicao.and.returnValue(of(quadro([meia])));
    produtos.definirEstoqueMinimo.and.returnValue(of(undefined));
    c.ngOnInit();

    digitarMinimo(meia, '');

    expect(produtos.definirEstoqueMinimo).toHaveBeenCalledOnceWith(2, null);
  });

  it('mostra aviso de permissao e volta o valor quando o servidor recusa', () => {
    spyOn(console, 'error');
    const meia = item({ id: 2, estoqueMinimo: 10, coluna: 'CRITICO' });
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

  it('descreve o giro e a cobertura do cartao', () => {
    produtos.listarReposicao.and.returnValue(of(quadro([])));
    c.ngOnInit();

    expect(c.textoGiro(item({ giroDiario: 0 }))).toBe('Sem vendas nos últimos 30 dias');
    expect(c.textoGiro(item({ quantidade: 8, giroDiario: 0.5, diasDeEstoque: 16 }))).toBe('Vende ~3,5/semana · acaba em ~16 dias');
    expect(c.textoGiro(item({ quantidade: 0, giroDiario: 1 }))).toBe('Vende ~7/semana');
    expect(c.larguraBarra(item({ cobertura: 1 }))).toBeCloseTo(66.67, 1);
    expect(c.larguraBarra(item({ cobertura: 3 }))).toBe(100);
  });
});
