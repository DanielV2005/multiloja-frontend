import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { EstoqueMovimentoDialogComponent, modoDoMotivo } from './estoque-movimento.dialog';
import {
  EstoqueMovimentoMotivo,
  EstoqueMovimentoTipo,
  ProdutoService,
} from '../../../core/services/produto.service';

describe('EstoqueMovimentoDialogComponent', () => {
  let c: EstoqueMovimentoDialogComponent;
  let produtos: jasmine.SpyObj<ProdutoService>;
  let ref: { close: jasmine.Spy };

  function abrir(quantidade: number) {
    produtos = jasmine.createSpyObj<ProdutoService>('ProdutoService', ['movimentarEstoque']);
    produtos.movimentarEstoque.and.returnValue(of({} as any));
    ref = { close: jasmine.createSpy('close') };
    TestBed.configureTestingModule({
      imports: [EstoqueMovimentoDialogComponent],
      providers: [
        { provide: ProdutoService, useValue: produtos },
        { provide: MatDialogRef, useValue: ref },
        { provide: MAT_DIALOG_DATA, useValue: { produto: { id: 7, nome: 'Camiseta', quantidade } } },
      ],
    });
    c = TestBed.createComponent(EstoqueMovimentoDialogComponent).componentInstance;
  }

  const escolher = (motivo: EstoqueMovimentoMotivo) => c.form.get('motivo')!.setValue(motivo);
  const digitar = (texto: string) => c.form.get('quantidade')!.setValue(texto);

  it('cada motivo diz o que o numero digitado significa', () => {
    expect(modoDoMotivo(EstoqueMovimentoMotivo.Compra)).toBe('entrada');
    expect(modoDoMotivo(EstoqueMovimentoMotivo.Vencimento)).toBe('saida');
    expect(modoDoMotivo(EstoqueMovimentoMotivo.ConsumoInterno)).toBe('saida');
    expect(modoDoMotivo(EstoqueMovimentoMotivo.Ajuste)).toBe('ajuste');
  });

  it('compra: digita o que chegou e soma ao estoque', () => {
    abrir(5);
    escolher(EstoqueMovimentoMotivo.Compra);
    expect(c.form.get('quantidade')!.value).toBe('');   // recomeca: o 5 do ajuste nao e o que chegou
    expect(c.rotuloQuantidade).toBe('Quantidade que chegou');

    digitar('24');
    expect(c.novaQuantidade).toBe(29);
    c.salvar();

    expect(produtos.movimentarEstoque).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      produtoId: 7,
      tipo: EstoqueMovimentoTipo.Entrada,
      motivo: EstoqueMovimentoMotivo.Compra,
      quantidade: 24,
    }));
    expect(ref.close).toHaveBeenCalledWith({ novaQuantidade: 29 });
  });

  it('perda: digita o que saiu e nao deixa tirar mais do que ha', () => {
    abrir(5);
    escolher(EstoqueMovimentoMotivo.Perda);

    digitar('8');
    c.salvar();
    expect(c.erroQuantidade).toBe('Só há 5 em estoque.');
    expect(produtos.movimentarEstoque).not.toHaveBeenCalled();

    digitar('2,5');
    c.salvar();
    expect(produtos.movimentarEstoque).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      tipo: EstoqueMovimentoTipo.Saida,
      motivo: EstoqueMovimentoMotivo.Perda,
      quantidade: 2.5,
    }));
    expect(ref.close).toHaveBeenCalledWith({ novaQuantidade: 2.5 });
  });

  it('ajuste (padrao): digita a contagem nova, como antes', () => {
    abrir(5);
    expect(c.form.get('quantidade')!.value).toBe('5');

    c.salvar();
    expect(c.errorMessage).toContain('igual à atual');

    digitar('2');
    c.salvar();
    expect(produtos.movimentarEstoque).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      tipo: EstoqueMovimentoTipo.Saida,
      motivo: EstoqueMovimentoMotivo.Ajuste,
      quantidade: 3,
    }));
  });

  it('trocar entre motivos de saida mantem o numero; trocar de modo recomeca', () => {
    abrir(5);
    escolher(EstoqueMovimentoMotivo.Avaria);
    digitar('1');
    escolher(EstoqueMovimentoMotivo.Defeito);
    expect(c.form.get('quantidade')!.value).toBe('1');

    escolher(EstoqueMovimentoMotivo.Ajuste);
    expect(c.form.get('quantidade')!.value).toBe('5');
  });

  it('quantidade vazia ou zero nao salva; erro do servidor aparece na tela', () => {
    spyOn(console, 'error');
    abrir(5);
    escolher(EstoqueMovimentoMotivo.Compra);
    c.salvar();
    expect(c.erroQuantidade).toBe('Informe uma quantidade válida.');
    digitar('0');
    expect(c.erroQuantidade).toBe('Informe uma quantidade maior que zero.');
    expect(produtos.movimentarEstoque).not.toHaveBeenCalled();

    produtos.movimentarEstoque.and.returnValue(throwError(() => ({ error: { error: 'Esse motivo é de entrada de estoque.' } })));
    digitar('3');
    c.salvar();
    expect(c.errorMessage).toBe('Esse motivo é de entrada de estoque.');
    expect(ref.close).not.toHaveBeenCalled();
  });
});
