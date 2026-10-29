import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';

import { MaisVendidosPageComponent } from './mais-vendidos-page.component';
import {
  FILTROS_PADRAO,
  FiltrosRanking,
  filtrarRanking,
  montarRanking,
  periodoDoAtalho,
  resumirCurva,
} from './mais-vendidos';
import { PdvService, SaleItemSummaryDto } from '../../../core/services/pdv.service';
import { ProdutoService, ReposicaoItemDto } from '../../../core/services/produto.service';
import { SetorService } from '../../../core/services/setor.service';
import { UsuarioService } from '../../../core/services/usuario.service';

const produto = (over: Partial<ReposicaoItemDto>): ReposicaoItemDto => ({
  id: 1, nome: 'Produto', codigoBarra: null, setorFilhoId: 1, quantidade: 5, estoqueMaximo: null, maximoAutomatico: null,
  minimo: null, meio: null, maximo: null, precoCusto: 10, precoVenda: 20, margemLucro: 100,
  giroDiario: null, baseGiro: null, diasSemEstoque: 0, diasDeEstoque: null, diasAteMinimo: null,
  sugestaoCompra: 0, excedente: 0, coluna: 'OK', prioridade: 0,
  ultimaMovimentacao: null, ultimaCompra: null, ultimaVenda: null, diasSemVender: null, encalhado: false,
  diasZeradoRecente: 0, vendaPerdida: 0, valorVendaPerdida: 0,
  vendidoRecente: 0, diasComEstoqueRecente: 14, giroRecente: 0, giroAnterior: null, tendencia: null, ...over,
});

const venda = (produtoId: number, nome: string, quantidade: number, total: number, tipo = 'PRODUTO'): SaleItemSummaryDto =>
  ({ produtoId, tipo, nome, quantidade, total });

describe('periodoDoAtalho', () => {
  const hoje = new Date(2026, 9, 29, 15, 30);   // 29/10/2026

  it('atalhos contam o dia de hoje', () => {
    expect(periodoDoAtalho('hoje', hoje)).toEqual({ inicio: '2026-10-29', fim: '2026-10-29' });
    expect(periodoDoAtalho('7d', hoje)).toEqual({ inicio: '2026-10-23', fim: '2026-10-29' });
    expect(periodoDoAtalho('30d', hoje)).toEqual({ inicio: '2026-09-30', fim: '2026-10-29' });
    expect(periodoDoAtalho('90d', hoje)).toEqual({ inicio: '2026-08-01', fim: '2026-10-29' });
    expect(periodoDoAtalho('mes', hoje)).toEqual({ inicio: '2026-10-01', fim: '2026-10-29' });
    expect(periodoDoAtalho('mes-passado', hoje)).toEqual({ inicio: '2026-09-01', fim: '2026-09-30' });
    expect(periodoDoAtalho('ano', hoje)).toEqual({ inicio: '2026-01-01', fim: '2026-10-29' });
  });

  it('mes passado em janeiro cai em dezembro do ano anterior', () => {
    expect(periodoDoAtalho('mes-passado', new Date(2026, 0, 15))).toEqual({ inicio: '2025-12-01', fim: '2025-12-31' });
  });
});

describe('ranking de mais vendidos', () => {
  const catalogo = [
    produto({ id: 1, nome: 'Caneta Azul', codigoBarra: '789001', setorFilhoId: 10, quantidade: 40 }),
    produto({ id: 2, nome: 'Caderno', setorFilhoId: 20, quantidade: 0, coluna: 'SEM_ESTOQUE' }),
    produto({ id: 3, nome: 'Borracha', setorFilhoId: 10, quantidade: 7 }),
  ];
  const resumo = [
    venda(1, 'CANETA AZUL', 30, 60),
    venda(2, 'Caderno', 5, 300),
    venda(3, 'Borracha', 12, 10),
    venda(3, 'Borracha antiga', 2, 2),       // mesmo produto com outro nome: soma
    venda(4, 'Mochila (desativada)', 1, 90),  // fora do catalogo ativo
    venda(5, 'Lapis', 3, 0),                 // brinde
    venda(6, 'Devolvido', 0, 0),             // todo devolvido: fica de fora
    venda(1, 'Conserto', 2, 100, 'SERVICO'), // servico com o mesmo id da caneta
  ];

  it('junta com o catalogo, separa produto de servico e calcula a curva por tipo', () => {
    const linhas = montarRanking(resumo, catalogo);

    expect(linhas.length).toBe(6);
    const caneta = linhas.find(l => l.chave === 'PRODUTO:1')!;
    expect(caneta.nome).toBe('Caneta Azul');                // nome atual do catalogo
    expect(caneta.setorId).toBe(10);
    expect(caneta.estoque).toBe(40);
    expect(caneta.busca).toContain('789001');
    const borracha = linhas.find(l => l.chave === 'PRODUTO:3')!;
    expect(borracha.quantidade).toBe(14);
    expect(borracha.total).toBe(12);
    const mochila = linhas.find(l => l.chave === 'PRODUTO:4')!;
    expect(mochila.estoque).toBeNull();
    expect(mochila.setorId).toBeNull();
    const conserto = linhas.find(l => l.chave === 'SERVICO:1')!;
    expect(conserto.tipo).toBe('SERVICO');
    expect(conserto.classe).toBe('A');                      // unico servico: 100% dos servicos
    expect(conserto.percentual).toBe(1);

    // Produtos: 300 + 90 + 60 + 12 + 0 = 462. Acumulado antes de cada um: caderno 0% e mochila 65% (A),
    // caneta 84% (B), borracha 97% (C); o lapis saiu de brinde (C)
    expect(linhas.find(l => l.chave === 'PRODUTO:2')!.classe).toBe('A');
    expect(mochila.classe).toBe('A');
    expect(caneta.classe).toBe('B');
    expect(borracha.classe).toBe('C');
    expect(linhas.find(l => l.chave === 'PRODUTO:5')!.classe).toBe('C');
    expect(linhas.find(l => l.chave === 'PRODUTO:2')!.percentual).toBeCloseTo(300 / 462, 6);
  });

  it('a posicao e a do ranking inteiro, antes da busca; setor, curva e top filtram', () => {
    const linhas = montarRanking(resumo, catalogo);
    const f = (over: Partial<FiltrosRanking>) => filtrarRanking(linhas, { ...FILTROS_PADRAO, ...over });

    const porQtd = f({});
    expect(porQtd.linhas.map(l => l.nome)).toEqual(['Caneta Azul', 'Borracha', 'Caderno', 'Lapis', 'Mochila (desativada)']);
    expect(porQtd.linhas.map(l => l.posicao)).toEqual([1, 2, 3, 4, 5]);

    const busca = f({ busca: 'cáDERNO' });
    expect(busca.linhas.map(l => [l.nome, l.posicao])).toEqual([['Caderno', 3]]);
    expect(busca.encontrados).toBe(1);

    const porValor = f({ ordem: 'faturamento', setorId: 10 });
    expect(porValor.linhas.map(l => [l.nome, l.posicao])).toEqual([['Caneta Azul', 3], ['Borracha', 4]]);
    expect(porValor.quantidade).toBe(44);
    expect(porValor.total).toBe(72);

    expect(f({ classe: 'A' }).linhas.map(l => l.nome)).toEqual(['Caderno', 'Mochila (desativada)']);
    const top2 = f({ limite: 2 });
    expect(top2.linhas.length).toBe(2);
    expect(top2.encontrados).toBe(5);
    expect(f({ tipo: 'SERVICO' }).linhas.map(l => l.nome)).toEqual(['Conserto']);
    expect(f({ tipo: 'TODOS', limite: null }).linhas.length).toBe(6);
  });

  it('resume a curva do tipo escolhido', () => {
    const linhas = montarRanking(resumo, catalogo);
    const [a, b, c] = resumirCurva(linhas, 'PRODUTO');

    expect([a.classe, a.itens, a.total]).toEqual(['A', 2, 390]);
    expect([b.classe, b.itens, b.total]).toEqual(['B', 1, 60]);
    expect([c.classe, c.itens, c.total]).toEqual(['C', 2, 12]);
    expect(a.percentual + b.percentual + c.percentual).toBeCloseTo(1, 9);
  });
});

describe('MaisVendidosPageComponent', () => {
  let c: MaisVendidosPageComponent;
  let pdv: jasmine.SpyObj<PdvService>;
  let produtos: jasmine.SpyObj<ProdutoService>;

  beforeEach(() => {
    try { localStorage.removeItem('maisVendidos.preferencias'); } catch { /* sem armazenamento */ }
    pdv = jasmine.createSpyObj<PdvService>('PdvService', ['listItemSummary']);
    produtos = jasmine.createSpyObj<ProdutoService>('ProdutoService', ['listarReposicao']);
    produtos.listarReposicao.and.returnValue(of({
      diasMinimo: 7, diasMeio: 14, diasMaximo: 28, diasVendaPerdida: 30, diasEncalhado: 60, diasTendencia: 14,
      itens: [produto({ id: 1, nome: 'Caneta', setorFilhoId: 10 }), produto({ id: 2, nome: 'Caderno', setorFilhoId: 20 })],
    }));
    const setores = jasmine.createSpyObj<SetorService>('SetorService', ['listar']);
    setores.listar.and.returnValue(of([
      { id: 10, nome: 'Papelaria', ativo: true },
      { id: 20, nome: 'Cadernos', ativo: true },
    ]));
    const usuarios = jasmine.createSpyObj<UsuarioService>('UsuarioService', ['loja']);
    usuarios.loja.and.returnValue(of({ id: 1, nome: 'Loja Centro' }));
    TestBed.configureTestingModule({
      imports: [MaisVendidosPageComponent],
      providers: [
        { provide: PdvService, useValue: pdv },
        { provide: ProdutoService, useValue: produtos },
        { provide: SetorService, useValue: setores },
        { provide: UsuarioService, useValue: usuarios },
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '1' }) } } },
      ],
    });
    c = TestBed.createComponent(MaisVendidosPageComponent).componentInstance;
  });

  afterEach(() => {
    c.ngOnDestroy();
    try { localStorage.removeItem('maisVendidos.preferencias'); } catch { /* idem */ }
  });

  it('carrega os ultimos 30 dias (vendas finalizadas e devolvidas) e so oferece setores com venda', () => {
    pdv.listItemSummary.and.returnValue(of([venda(1, 'Caneta', 10, 20)]));

    c.ngOnInit();

    const [inicio, fim, status] = pdv.listItemSummary.calls.mostRecent().args;
    expect(status).toEqual([2, 4]);
    expect(c.textoPeriodo).toContain(' a ');
    expect(inicio! < fim!).toBeTrue();
    expect(c.carregando).toBeFalse();
    expect(c.resultado.linhas.map(l => l.nome)).toEqual(['Caneta']);
    expect(c.opcoesSetor).toEqual([{ id: 10, nome: 'Papelaria', itens: 1 }]);
    expect(c.nomeSetor(10)).toBe('Papelaria');
  });

  it('busca filtra na memoria, sem pedir de novo ao servidor', () => {
    pdv.listItemSummary.and.returnValue(of([venda(1, 'Caneta', 10, 20), venda(2, 'Caderno', 3, 90)]));
    c.ngOnInit();

    c.mudar({ busca: 'cad' });

    expect(c.resultado.linhas.map(l => l.nome)).toEqual(['Caderno']);
    expect(pdv.listItemSummary).toHaveBeenCalledTimes(1);
  });

  it('trocar o periodo pede de novo, guarda a preferencia e a resposta antiga nao sobrescreve a nova', () => {
    const antiga = new Subject<SaleItemSummaryDto[]>();
    pdv.listItemSummary.and.returnValues(antiga, of([venda(2, 'Caderno', 3, 90)]));
    c.ngOnInit();

    c.escolherAtalho('mes-passado');
    antiga.next([venda(1, 'Caneta', 10, 20)]);

    expect(c.resultado.linhas.map(l => l.nome)).toEqual(['Caderno']);
    expect(JSON.parse(localStorage.getItem('maisVendidos.preferencias')!).atalho).toBe('mes-passado');
  });

  it('datas escolhidas: valida a ordem antes de buscar', () => {
    pdv.listItemSummary.and.returnValue(of([]));
    c.ngOnInit();
    c.abrirDatas();
    c.dataInicio = '2026-10-10';
    c.dataFim = '2026-10-01';

    c.aplicarDatas();
    expect(c.erroDatas).toContain('depois');
    expect(pdv.listItemSummary).toHaveBeenCalledTimes(1);

    c.dataFim = '2026-10-20';
    c.aplicarDatas();
    expect(pdv.listItemSummary.calls.mostRecent().args.slice(0, 2)).toEqual(['2026-10-10', '2026-10-20']);
  });

  it('erro do PDV vira mensagem, e tentar de novo busca outra vez', () => {
    pdv.listItemSummary.and.returnValues(new Subject<SaleItemSummaryDto[]>(), of([venda(1, 'Caneta', 1, 2)]));
    c.ngOnInit();
    pdv.listItemSummary.calls.reset();
    const falha = new Subject<SaleItemSummaryDto[]>();
    pdv.listItemSummary.and.returnValue(falha);

    c.carregar();
    falha.error({ status: 500 });

    expect(c.erro).toContain('Não foi possível');
    expect(c.carregando).toBeFalse();
  });

  it('mostra a tabela com posicao, curva e estoque', () => {
    pdv.listItemSummary.and.returnValue(of([venda(1, 'Caneta', 10, 20), venda(2, 'Caderno', 3, 90)]));
    const fixture = TestBed.createComponent(MaisVendidosPageComponent);
    fixture.detectChanges();

    const linhas = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(linhas.length).toBe(2);
    expect(linhas[0].textContent).toContain('Caneta');
    expect(linhas[0].querySelector('.abc')!.textContent!.trim()).toBe('B');
    expect((fixture.nativeElement as HTMLElement).querySelector('.rodape')!.textContent).toContain('Mostrando 2 de 2');
    fixture.destroy();
  });

  it('volta com as preferencias salvas', () => {
    localStorage.setItem('maisVendidos.preferencias', JSON.stringify({ atalho: '7d', tipo: 'TODOS', ordem: 'faturamento', limite: 100 }));
    pdv.listItemSummary.and.returnValue(of([]));

    c.ngOnInit();

    expect(c.atalho).toBe('7d');
    expect(c.filtros.tipo).toBe('TODOS');
    expect(c.filtros.ordem).toBe('faturamento');
    expect(c.filtros.limite).toBe(100);
  });
});
