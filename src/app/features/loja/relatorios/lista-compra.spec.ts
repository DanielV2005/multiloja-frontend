import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ListaCompraPageComponent } from './lista-compra-page.component';
import {
  agruparPorSetor,
  contarTendencias,
  filtrarCompra,
  filtrosCompraPadrao,
  quantidadeDe,
  textoListaCompra,
} from './lista-compra';
import { ProdutoService, ReposicaoItemDto } from '../../../core/services/produto.service';
import { SetorService } from '../../../core/services/setor.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { CurvaAbcService } from '../../../core/services/curva-abc.service';
import { ClasseAbc } from '../../../shared/curva-abc';

const item = (over: Partial<ReposicaoItemDto>): ReposicaoItemDto => ({
  id: 1, nome: 'Produto', codigoBarra: null, setorFilhoId: 1, quantidade: 0, estoqueMaximo: null, maximoAutomatico: null,
  minimo: null, meio: null, maximo: null, precoCusto: 10, precoVenda: 20, margemLucro: 100,
  giroDiario: null, baseGiro: null, diasSemEstoque: 0, diasDeEstoque: null, diasAteMinimo: null,
  sugestaoCompra: 0, excedente: 0, coluna: 'OK', prioridade: 0,
  ultimaMovimentacao: null, ultimaCompra: null, ultimaVenda: null, diasSemVender: null, encalhado: false,
  diasZeradoRecente: 0, vendaPerdida: 0, valorVendaPerdida: 0,
  vendidoRecente: 0, diasComEstoqueRecente: 14, giroRecente: 0, giroAnterior: null, tendencia: null, ...over,
});

// Na ordem do servidor (prioridade)
const itens = [
  item({ id: 1, nome: 'Camiseta', coluna: 'SEM_ESTOQUE', sugestaoCompra: 28, precoCusto: 15, setorFilhoId: 2, codigoBarra: '7891' }),
  item({ id: 2, nome: 'Meia', coluna: 'REPOR', sugestaoCompra: 10, precoCusto: 3, setorFilhoId: 2 }),
  item({ id: 3, nome: 'Bone', coluna: 'ATENCAO', sugestaoCompra: 4, precoCusto: 20, setorFilhoId: 1 }),
  item({ id: 4, nome: 'Cinto', coluna: 'OK', sugestaoCompra: 0, setorFilhoId: 1 }),
  item({ id: 5, nome: 'Bolsa', coluna: 'EXCESSO', setorFilhoId: 1 }),
  item({ id: 6, nome: 'Óculos', coluna: 'SEM_HISTORICO', setorFilhoId: 1 }),
];
const setores: Record<number, string> = { 1: 'Acessórios', 2: 'Roupas' };
const nomeSetor = (id: number) => setores[id] ?? '—';
const curva = new Map<number, ClasseAbc>([[1, 'A'], [2, 'C'], [3, 'B']]);

describe('filtros da lista de compra', () => {
  it('por padrao: sem estoque, repor e atencao, na ordem do servidor', () => {
    const r = filtrarCompra(itens, filtrosCompraPadrao(), curva, new Map(), nomeSetor);
    expect(r.map(i => i.nome)).toEqual(['Camiseta', 'Meia', 'Bone']);
  });

  it('situacao, curva (incluindo "nao vendeu"), setor e busca sem acento', () => {
    const f = filtrosCompraPadrao();
    const com = (over: Partial<typeof f>) => filtrarCompra(itens, { ...f, ...over }, curva, new Map(), nomeSetor).map(i => i.nome);

    expect(com({ situacoes: new Set(['OK', 'SEM_HISTORICO']) })).toEqual(['Cinto', 'Óculos']);
    expect(com({ curvas: new Set(['A', 'B']) })).toEqual(['Camiseta', 'Bone']);
    expect(com({ situacoes: new Set(['OK', 'SEM_HISTORICO', 'REPOR']), curvas: new Set(['SEM_VENDA']) })).toEqual(['Cinto', 'Óculos']);
    expect(com({ setorId: 2 })).toEqual(['Camiseta', 'Meia']);
    expect(com({ situacoes: new Set(['SEM_HISTORICO']), busca: 'oculos' })).toEqual(['Óculos']);
    expect(com({ busca: '7891' })).toEqual(['Camiseta']);
    // Sem a curva (PDV fora do ar), o filtro de curva nao esconde nada
    expect(filtrarCompra(itens, { ...f, curvas: new Set(['A']) }, null, new Map(), nomeSetor).length).toBe(3);
  });

  it('vendas em alta ou em queda: filtra e conta so o que os outros filtros deixam ver', () => {
    const lista = [
      ...itens,
      item({ id: 7, nome: 'Pistola', coluna: 'ATENCAO', tendencia: 'ALTA', setorFilhoId: 1 }),
      item({ id: 8, nome: 'Bermuda', coluna: 'OK', tendencia: 'ALTA', setorFilhoId: 2 }),
      item({ id: 9, nome: 'Chiclets', coluna: 'REPOR', tendencia: 'QUEDA', setorFilhoId: 1 }),
    ];
    const f = filtrosCompraPadrao();
    const com = (over: Partial<typeof f>) => filtrarCompra(lista, { ...f, ...over }, curva, new Map(), nomeSetor).map(i => i.nome);
    const conta = (over: Partial<typeof f>) => Object.fromEntries(contarTendencias(lista, { ...f, ...over }, curva, nomeSetor));

    expect(com({ tendencias: new Set(['ALTA']) })).toEqual(['Pistola']);   // a bermuda esta em dia
    expect(com({ tendencias: new Set(['ALTA']), situacoes: new Set(['ATENCAO', 'OK']) })).toEqual(['Pistola', 'Bermuda']);
    expect(com({ tendencias: new Set(['ALTA', 'QUEDA']) })).toEqual(['Pistola', 'Chiclets']);

    expect(conta({})).toEqual({ ALTA: 1, QUEDA: 1 });
    expect(conta({ situacoes: new Set(['ATENCAO', 'OK']) })).toEqual({ ALTA: 2 });
    expect(conta({ setorId: 2 })).toEqual({});
    // Marcar um dos botoes nao muda o numero deles
    expect(conta({ tendencias: new Set(['QUEDA']) })).toEqual({ ALTA: 1, QUEDA: 1 });
  });

  it('ordena por nome, setor ou valor da compra (com a quantidade digitada)', () => {
    const f = filtrosCompraPadrao();
    const digitadas = new Map([[2, 100]]);   // 100 meias x R$ 3 = R$ 300
    const ordem = (o: 'nome' | 'setor' | 'valor') =>
      filtrarCompra(itens, { ...f, ordem: o }, curva, digitadas, nomeSetor).map(i => i.nome);

    expect(ordem('nome')).toEqual(['Bone', 'Camiseta', 'Meia']);
    expect(ordem('setor')).toEqual(['Bone', 'Camiseta', 'Meia']);
    expect(ordem('valor')).toEqual(['Camiseta', 'Meia', 'Bone']);   // 420, 300, 80
    expect(quantidadeDe(itens[1], digitadas)).toBe(100);
    expect(quantidadeDe(itens[0], digitadas)).toBe(28);
  });

  it('texto para o fornecedor: quantidade e produto por setor, sem custo', () => {
    const lista = [
      { nome: 'Meia', codigoBarra: null, setor: 'Roupas', quantidade: 10, custo: 3 },
      { nome: 'Bone', codigoBarra: null, setor: 'Acessórios', quantidade: 4, custo: 20 },
      { nome: 'Camiseta', codigoBarra: '7891', setor: 'Roupas', quantidade: 28, custo: 15 },
    ];

    expect(textoListaCompra(lista, 'Loja Centro', '29/10/2026')).toBe([
      'Lista de compra — Loja Centro — 29/10/2026',
      '',
      '*Acessórios*',
      '4 un — Bone',
      '',
      '*Roupas*',
      '28 un — Camiseta (cód. 7891)',
      '10 un — Meia',
      '',
      'Total: 3 produtos, 42 unidades',
    ].join('\n'));
    expect(textoListaCompra([lista[0]], '', '29/10/2026')).toBe('Lista de compra — 29/10/2026\n\n10 un — Meia\n\nTotal: 1 produto, 10 unidades');

    const grupos = agruparPorSetor(lista);
    expect(grupos.map(g => [g.setor, g.total])).toEqual([['Acessórios', 80], ['Roupas', 450]]);
  });
});

describe('ListaCompraPageComponent', () => {
  let c: ListaCompraPageComponent;
  let produtos: jasmine.SpyObj<ProdutoService>;
  let curvaAbc: { dias: number; ultimos90Dias: jasmine.Spy };

  function criar(): ListaCompraPageComponent {
    const comp = TestBed.createComponent(ListaCompraPageComponent).componentInstance;
    comp.ngOnInit();
    return comp;
  }

  function digitar(alvo: ReposicaoItemDto, texto: string) {
    const input = document.createElement('input');
    input.value = texto;
    c.digitarQuantidade(alvo, input);
  }

  beforeEach(() => {
    try { sessionStorage.removeItem('listaCompra.1'); } catch { /* sem armazenamento */ }
    produtos = jasmine.createSpyObj<ProdutoService>('ProdutoService', ['listarReposicao']);
    produtos.listarReposicao.and.returnValue(of({
      diasMinimo: 7, diasMeio: 14, diasMaximo: 28, diasVendaPerdida: 30, diasEncalhado: 60, diasTendencia: 14, itens,
    }));
    curvaAbc = { dias: 90, ultimos90Dias: jasmine.createSpy('ultimos90Dias').and.returnValue(of(curva)) };
    const setorService = jasmine.createSpyObj<SetorService>('SetorService', ['listar']);
    setorService.listar.and.returnValue(of([{ id: 1, nome: 'Acessórios', ativo: true }, { id: 2, nome: 'Roupas', ativo: true }]));
    const usuarios = jasmine.createSpyObj<UsuarioService>('UsuarioService', ['loja']);
    usuarios.loja.and.returnValue(of({ id: 1, nome: 'Loja Centro' }));
    TestBed.configureTestingModule({
      imports: [ListaCompraPageComponent],
      providers: [
        { provide: ProdutoService, useValue: produtos },
        { provide: CurvaAbcService, useValue: curvaAbc },
        { provide: SetorService, useValue: setorService },
        { provide: UsuarioService, useValue: usuarios },
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '1' }) } } },
      ],
    });
    c = criar();
  });

  afterEach(() => {
    c.ngOnDestroy();
    try { sessionStorage.removeItem('listaCompra.1'); } catch { /* idem */ }
  });

  it('mostra o que comprar agora, com contagem por situacao e curva de cada produto', () => {
    expect(c.carregando).toBeFalse();
    expect(c.visiveis.map(i => i.nome)).toEqual(['Camiseta', 'Meia', 'Bone']);
    expect(c.contagem.get('SEM_ESTOQUE')).toBe(1);
    expect(c.contagem.get('OK')).toBe(1);
    expect(c.classe(itens[0])).toBe('A');
    expect(c.classe(itens[3])).toBeNull();
    expect(c.opcoesSetor.map(s => s.nome)).toEqual(['Acessórios', 'Roupas']);
  });

  it('marcar todos pega so os da tela com quantidade; de novo, desmarca', () => {
    c.alternarSituacao('OK');   // Cinto aparece, mas sem sugestao de compra
    c.alternarTodos();

    expect([...c.selecionados].sort()).toEqual([1, 2, 3]);
    expect(c.todosMarcados).toBeTrue();
    expect(c.resumo).toEqual({ produtos: 3, unidades: 42, valor: 28 * 15 + 10 * 3 + 4 * 20 });

    c.alternarTodos();
    expect(c.selecionados.size).toBe(0);
  });

  it('digitar quantidade marca; 0 desmarca; vazio volta para a sugestao; texto invalido avisa', () => {
    const cinto = itens[3];
    digitar(cinto, '5');
    expect(c.selecionados.has(4)).toBeTrue();
    expect(c.quantidade(cinto)).toBe(5);

    digitar(cinto, '0');
    expect(c.selecionados.has(4)).toBeFalse();

    digitar(itens[0], '');
    expect(c.quantidade(itens[0])).toBe(28);

    digitar(itens[0], 'abc');
    expect(c.errosQtd.get(1)).toBe('Número inválido');
    expect(c.quantidade(itens[0])).toBe(28);
  });

  it('copia a lista para o fornecedor e imprime com custo, so com os marcados', async () => {
    c.alternar(itens[1]);
    digitar(itens[2], '6');
    const area = spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
    const imprimir = spyOn(window, 'print');

    await c.copiar();
    c.imprimir();

    const texto = area.calls.mostRecent().args[0] as string;
    expect(texto).toContain('Loja Centro');
    expect(texto).toContain('10 un — Meia');
    expect(texto).toContain('6 un — Bone');
    expect(texto).not.toContain('R$');
    expect(c.aviso).toContain('copiada');
    expect(imprimir).toHaveBeenCalled();
    expect(c.impressao!.produtos).toBe(2);
    expect(c.impressao!.unidades).toBe(16);
    expect(c.impressao!.valor).toBe(10 * 3 + 6 * 20);
    expect(c.impressao!.grupos.map(g => g.setor)).toEqual(['Acessórios', 'Roupas']);
  });

  it('a selecao continua ao voltar para a tela (mesma aba)', () => {
    c.alternar(itens[0]);
    digitar(itens[1], '12');
    c.ngOnDestroy();

    c = criar();

    expect([...c.selecionados].sort()).toEqual([1, 2]);
    expect(c.quantidade(itens[1])).toBe(12);
    expect(c.resumo.unidades).toBe(40);
  });

  it('sem a curva ABC (PDV fora do ar) a lista funciona e avisa', () => {
    curvaAbc.ultimos90Dias.and.returnValue(throwError(() => ({ status: 500 })));
    c.ngOnDestroy();
    c = criar();

    expect(c.curva).toBeNull();
    expect(c.carregandoCurva).toBeFalse();
    expect(c.visiveis.length).toBe(3);
  });

  it('tela: marca tudo pelo cabecalho e mostra a barra com o total', () => {
    c.ngOnDestroy();
    const fixture = TestBed.createComponent(ListaCompraPageComponent);
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;

    expect(tela.querySelectorAll('tbody tr').length).toBe(3);
    expect(tela.querySelector('.barra-selecao')).toBeNull();

    (tela.querySelector('thead input[type="checkbox"]') as HTMLInputElement).click();
    fixture.detectChanges();

    expect(tela.querySelector('.barra-selecao')!.textContent).toContain('3 produtos marcados');
    expect(tela.querySelectorAll('tr.marcado').length).toBe(3);
    fixture.destroy();
  });

  it('tela: botoes de vendas em alta/queda com contagem, filtro e o aviso na linha do produto', () => {
    produtos.listarReposicao.and.returnValue(of({
      diasMinimo: 7, diasMeio: 14, diasMaximo: 28, diasVendaPerdida: 30, diasEncalhado: 60, diasTendencia: 14,
      itens: [
        ...itens,
        item({ id: 7, nome: 'Pistola', coluna: 'ATENCAO', tendencia: 'ALTA', quantidade: 1, vendidoRecente: 7, giroRecente: 0.5, giroAnterior: 0.033 }),
      ],
    }));
    c.ngOnDestroy();
    const fixture = TestBed.createComponent(ListaCompraPageComponent);
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;
    const pagina = fixture.componentInstance;

    const botoes = [...tela.querySelectorAll('[aria-label="Vendas nas últimas semanas"] .chip')]
      .map(b => b.textContent!.replace(/\s+/g, ' ').trim());
    expect(botoes).toEqual(['↑ Em alta (1)', '↓ Em queda (0)']);
    const linha = [...tela.querySelectorAll('tbody tr')].find(tr => tr.textContent!.includes('Pistola'))!;
    expect(linha.querySelector('.tendencia')!.textContent!.trim()).toBe('↑ em alta: 7 em 14 dias');
    expect(linha.querySelector('.tendencia')!.getAttribute('title')).toContain('acaba em ~2 dias nesse ritmo');

    pagina.alternarTendencia('ALTA');
    fixture.detectChanges();
    expect(pagina.visiveis.map(i => i.nome)).toEqual(['Pistola']);
    expect(tela.querySelectorAll('tbody tr').length).toBe(1);
    fixture.destroy();
  });

  it('erro ao carregar o quadro mostra mensagem', () => {
    produtos.listarReposicao.and.returnValue(throwError(() => ({ status: 500 })));
    c.ngOnDestroy();
    c = criar();

    expect(c.erro).toContain('Não foi possível');
    expect(c.carregando).toBeFalse();
  });
});
