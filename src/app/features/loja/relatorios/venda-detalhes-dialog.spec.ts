import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { VendaDetalhesDialogComponent } from './vendas-page.component';
import { PdvService, SaleDetailsDto } from '../../../core/services/pdv.service';
import { ProdutoService } from '../../../core/services/produto.service';
import { UsuarioService } from '../../../core/services/usuario.service';

// Tela de detalhes da venda: valor do reembolso/diferenca e envio da devolucao.
describe('VendaDetalhesDialogComponent (devolucao e troca)', () => {
  let c: VendaDetalhesDialogComponent;
  let pdv: jasmine.SpyObj<PdvService>;

  // Venda de R$ 30: 2x Camisa a R$ 10 + 1x Bone a R$ 10, com desconto informado
  const detalhes = (descontoPercent: number): SaleDetailsDto => ({
    id: 5, lojaId: 35, subtotal: 30, discountPercent: descontoPercent, discountValue: 0, total: 30,
    status: 'Completed', createdAt: '', returns: [], payments: [],
    items: [
      { id: 1, produtoId: 10, tipo: 'PRODUTO', nome: 'Camisa', unitPrice: 10, quantity: 2, returnedQuantity: 0 },
      { id: 2, produtoId: 11, tipo: 'PRODUTO', nome: 'Bone', unitPrice: 10, quantity: 1, returnedQuantity: 0 },
    ],
  });

  function criar(descontoPercent = 0) {
    pdv = jasmine.createSpyObj<PdvService>('PdvService', ['getDetails', 'returnSale']);
    pdv.getDetails.and.returnValue(of(detalhes(descontoPercent)));
    TestBed.configureTestingModule({
      imports: [VendaDetalhesDialogComponent],
      providers: [
        { provide: PdvService, useValue: pdv },
        { provide: ProdutoService, useValue: { listarPorLoja: () => of([]) } },
        { provide: UsuarioService, useValue: { loja: () => of(null) } },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: MAT_DIALOG_DATA, useValue: { saleId: 5, saleIds: [5], index: 0 } },
      ],
    });
    c = TestBed.createComponent(VendaDetalhesDialogComponent).componentInstance;
  }

  const devolverCamisas = (qtd: number) => { c.returnLines.find(l => l.nome === 'Camisa')!.returnQty = qtd; };

  it('reembolso considera o desconto da venda e usa Dinheiro por padrao', () => {
    criar(10);
    devolverCamisas(1);
    expect(c.settlementValue).toBe(-9);
    expect(c.settlementMethod).toBe(1);
  });

  it('acrescimo da venda aumenta o reembolso', () => {
    criar(-10);
    devolverCamisas(2);
    expect(c.settlementValue).toBe(-22);
  });

  it('troca: cliente paga a diferenca quando leva algo mais caro', () => {
    criar();
    c.returnOperation = 'Troca';
    devolverCamisas(1);
    c.exchangeItems = [{ produtoId: 20, nome: 'Calca', unitPrice: 25, quantity: 1 }];
    expect(c.settlementValue).toBe(15);
  });

  it('troca exige ao menos um item entregue', () => {
    criar();
    c.returnOperation = 'Troca';
    devolverCamisas(1);
    expect(c.canReturn()).toBeFalse();
    c.exchangeItems = [{ produtoId: 20, nome: 'Calca', unitPrice: 25, quantity: 1 }];
    expect(c.canReturn()).toBeTrue();
  });

  it('envia a forma escolhida e mostra o motivo quando o servidor recusa', () => {
    criar();
    devolverCamisas(1);
    c.settlementMethod = 2;
    spyOn(console, 'error');
    pdv.returnSale.and.returnValue(throwError(() => ({ error: { message: 'Estoque insuficiente para Calca.' } })));

    c.confirmReturn();

    const body = pdv.returnSale.calls.mostRecent().args[1];
    expect(body.settlementMethod).toBe(2);
    expect(body.items).toEqual([{ saleItemId: 1, quantity: 1 }]);
    expect(c.returnError).toBe('Estoque insuficiente para Calca.');
    expect(c.saving).toBeFalse();
  });
});
