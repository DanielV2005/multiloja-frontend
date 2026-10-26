import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { PdvComponent } from './pdv.component';
import { PdvService, SaleSummaryDto } from '../../core/services/pdv.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { ItensVendaveisService, ItemVendavelDto } from '../../core/services/itens-vendaveis.service';
import { AuthStorageService } from '../../core/services/auth-storage.service';
import { VendaDetalhesDialogComponent } from '../loja/relatorios/vendas-page.component';

// Testes das regras da tela do caixa. O componente e criado sem renderizar (ngOnInit nao roda),
// e o estado de cada cenario e montado direto; o backend e substituido por espioes.
describe('PdvComponent', () => {
  let c: PdvComponent;
  let pdv: jasmine.SpyObj<PdvService>;
  let dialog: { open: jasmine.Spy };
  let alertSpy: jasmine.Spy;
  const auth = { name: 'Ana', userId: 'u1', email: 'ana@x', token: 'jwt', clear: () => undefined };

  const venda = (over: Partial<SaleSummaryDto> = {}): SaleSummaryDto => ({
    id: 1, lojaId: 35, subtotal: 0, discountPercent: 0, discountValue: 0, total: 0,
    paid: false, status: 'Open', createdAt: new Date().toISOString(), ...over,
  });
  const produto = (over: Partial<ItemVendavelDto> = {}): ItemVendavelDto =>
    ({ id: 10, tipo: 'PRODUTO', nome: 'Camisa', precoVenda: 10, estoque: null, ...over });
  const priv = () => c as any;

  beforeEach(() => {
    localStorage.clear();
    pdv = jasmine.createSpyObj<PdvService>('PdvService',
      ['start', 'listOpen', 'list', 'get', 'getDetails', 'addItem', 'setDiscount', 'checkout', 'cancel']);
    pdv.cancel.and.returnValue(of(undefined));
    pdv.listOpen.and.returnValue(of([]));
    dialog = { open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(undefined) }) };
    alertSpy = spyOn(window, 'alert');

    TestBed.configureTestingModule({
      imports: [PdvComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '35' }) } } },
        { provide: PdvService, useValue: pdv },
        { provide: UsuarioService, useValue: { loja: () => of(null) } },
        { provide: ItensVendaveisService, useValue: { listar: () => of({ items: [] }) } },
        { provide: AuthStorageService, useValue: auth },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: dialog });
    c = TestBed.createComponent(PdvComponent).componentInstance;
    c.lojaId = 35;
  });

  afterEach(() => localStorage.clear());

  /** Abre uma venda com um item no carrinho. */
  function vendaComItem(quantidade = 1, total = 10) {
    const sale = venda({ subtotal: total, total });
    c.currentSale = sale;
    c.openSales = [sale];
    const item = { key: 'PRODUTO:10', produtoId: 10, tipo: 'PRODUTO' as const, nome: 'Camisa', unitPrice: 10, quantity: quantidade, estoque: null };
    priv().cartBySale.set(sale.id, [item]);
    priv().paymentsBySale.set(sale.id, []);
    return { sale, item };
  }

  describe('bug 2: cliques rapidos em "+"', () => {
    it('envia uma alteracao por vez e nao soma a diferenca duas vezes', () => {
      const { item } = vendaComItem(1);
      const respostas: Subject<SaleSummaryDto>[] = [];
      pdv.addItem.and.callFake(() => { const s = new Subject<SaleSummaryDto>(); respostas.push(s); return s; });

      c.alterarQuantidade(item, 1); // 1 -> 2
      c.alterarQuantidade(item, 1); // 2 -> 3, com o primeiro envio ainda em andamento
      expect(pdv.addItem).toHaveBeenCalledTimes(1);

      respostas[0].next(venda({ subtotal: 20, total: 20 }));
      expect(pdv.addItem).toHaveBeenCalledTimes(2);
      respostas[1].next(venda({ subtotal: 30, total: 30 }));

      const deltas = pdv.addItem.calls.allArgs().map(a => a[1].quantity);
      expect(deltas).toEqual([1, 1]);           // o servidor recebe +1 e +1 = 3 no total
      expect(item.quantity).toBe(3);            // e a tela mostra 3
    });

    it('bloqueia finalizar enquanto uma quantidade esta sendo enviada', async () => {
      const { item } = vendaComItem(1);
      pdv.addItem.and.returnValue(new Subject<SaleSummaryDto>());
      c.alterarQuantidade(item, 1);

      await c.finalizarVenda();

      expect(alertSpy).toHaveBeenCalledWith(jasmine.stringMatching('Aguarde'));
      expect(pdv.checkout).not.toHaveBeenCalled();
    });
  });

  describe('bug 1: falta de estoque ao adicionar item', () => {
    it('mostra o alerta com a mensagem do servidor em vez de ignorar', () => {
      vendaComItem();
      pdv.addItem.and.returnValue(throwError(() => ({ error: { message: 'Não foi possível reservar estoque para o produto.' } })));

      c.adicionarItem(produto({ id: 11, estoque: 5 }));

      expect(dialog.open).toHaveBeenCalled();
      expect(dialog.open.calls.mostRecent().args[1].data.message).toContain('reservar estoque');
      expect(alertSpy).not.toHaveBeenCalled();
      expect(c.addItemBusy).toBeFalse();
    });
  });

  describe('bug 4 e pagamentos na finalizacao', () => {
    it('recusa finalizar quando os pagamentos passam do total', async () => {
      const { sale } = vendaComItem(1, 50);
      priv().paymentsBySale.set(sale.id, [{ id: 'p1', method: 2, amount: 100 }]);

      await c.finalizarVenda();

      expect(alertSpy).toHaveBeenCalledWith(jasmine.stringMatching('passam do total'));
      expect(pdv.checkout).not.toHaveBeenCalled();
    });

    it('envia a lista completa uma vez, com o restante em dinheiro arredondado em centavos', async () => {
      const { sale } = vendaComItem(1, 30.3);
      priv().paymentsBySale.set(sale.id, [{ id: 'p1', method: 2, amount: 10.1 }]);
      pdv.checkout.and.returnValue(of(venda({ status: 'Completed' })));

      await c.finalizarVenda();

      expect(pdv.checkout).toHaveBeenCalledOnceWith(sale.id, [
        { method: 2, amount: 10.1, refCode: null },
        { method: 1, amount: 20.2, refCode: null },
      ]);
    });

    it('trata como sucesso quando a resposta se perdeu mas a venda ja foi finalizada', async () => {
      vendaComItem(1, 10);
      pdv.checkout.and.returnValue(throwError(() => ({ status: 0 })));
      pdv.get.and.returnValue(of(venda({ status: 2 as any })));

      await c.finalizarVenda();
      await Promise.resolve();
      await Promise.resolve();

      expect(alertSpy).not.toHaveBeenCalled();
      expect(c.openSales.length).toBe(0);
    });
  });

  describe('bug 8: rascunho antes do primeiro item', () => {
    it('leva o desconto e os pagamentos do rascunho para a venda criada', () => {
      const draftId = 'draft-1';
      c.draftSales = [{ id: draftId, createdAt: new Date() }];
      c.currentDraftId = draftId;
      priv().setDraftDiscount(draftId, 10);
      priv().paymentsBySale.set(priv().toDraftKey(draftId), [{ id: 'p1', method: 2, amount: 5 }]);

      pdv.start.and.returnValue(of(venda({ id: 7 })));
      pdv.setDiscount.and.returnValue(of(venda({ id: 7, discountPercent: 10 })));
      pdv.addItem.and.returnValue(of(venda({ id: 7, discountPercent: 10, subtotal: 10, total: 9 })));

      c.adicionarItem(produto());

      expect(pdv.setDiscount).toHaveBeenCalledWith(7, 10);
      expect(pdv.addItem).toHaveBeenCalled();
      expect(priv().paymentsBySale.get(7)).toEqual([jasmine.objectContaining({ method: 2, amount: 5 })]);
      expect(c.discountPercent).toBe(10);
    });
  });

  describe('bug 11: carrinho perdido no navegador', () => {
    it('recarrega os itens do servidor ao abrir uma venda com valor e carrinho vazio', () => {
      pdv.getDetails.and.returnValue(of({
        id: 3, lojaId: 35, subtotal: 25, discountPercent: 0, discountValue: 0, total: 25, status: 'Open',
        createdAt: '', returns: [], payments: [],
        items: [
          { id: 1, produtoId: 10, tipo: 'PRODUTO', nome: 'Camisa', unitPrice: 10, quantity: 2, returnedQuantity: 0 },
          { id: 2, produtoId: 5, tipo: 'SERVICO', nome: 'Ajuste', unitPrice: 5, quantity: 1, returnedQuantity: 0 },
        ],
      } as any));

      c.selectSale(venda({ id: 3, subtotal: 25, total: 25 }));

      expect(pdv.getDetails).toHaveBeenCalledOnceWith(3);
      expect(c.currentItems.map(i => [i.key, i.quantity])).toEqual([['PRODUTO:10', 2], ['SERVICO:5', 1]]);
    });

    it('nao consulta o servidor quando o carrinho local existe', () => {
      vendaComItem();
      c.selectSale(venda({ subtotal: 10, total: 10 }));
      expect(pdv.getDetails).not.toHaveBeenCalled();
    });
  });

  describe('bug 12: Alt+V (ultima venda)', () => {
    it('abre so as vendas do operador com o nome exato', () => {
      pdv.list.and.returnValue(of([
        { id: 1, lojaId: 35, operadorNome: 'Ana', subtotal: 1, discountPercent: 0, discountValue: 0, total: 1, status: 2, createdAt: '2026-10-26T10:00:00Z' },
        { id: 2, lojaId: 35, operadorNome: 'Mariana', subtotal: 1, discountPercent: 0, discountValue: 0, total: 1, status: 2, createdAt: '2026-10-26T11:00:00Z' },
      ] as any));

      priv().abrirUltimaVenda();

      const [componente, config] = dialog.open.calls.mostRecent().args;
      expect(componente).toBe(VendaDetalhesDialogComponent);
      expect(config.data.saleIds).toEqual([1]);
    });
  });

  describe('fila de vendas (otimizacao)', () => {
    it('reaproveita a fila enquanto nada muda e numera pela ordem de abertura', () => {
      c.openSales = [venda({ id: 2, createdAt: '2026-10-26T10:00:00Z' }), venda({ id: 1, createdAt: '2026-10-26T09:00:00Z' })];
      const primeira = c.queueEntries;

      expect(c.queueEntries).toBe(primeira);
      expect(c.queueIndex(1)).toBe(1);
      expect(c.queueIndex(2)).toBe(2);

      c.openSales = [...c.openSales, venda({ id: 3, createdAt: '2026-10-26T11:00:00Z' })];
      expect(c.queueEntries).not.toBe(primeira);
      expect(c.queueIndex(3)).toBe(3);
    });
  });
});
