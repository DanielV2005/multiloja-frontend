import { formatBRL, formatDecimal } from './format';

describe('format', () => {
  it('formata moeda igual ao toLocaleString pt-BR', () => {
    for (const v of [0, 1.5, 22, 1234.5, -40, 1999999.99]) {
      expect(formatBRL(v)).toBe(v.toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
      }));
    }
  });

  it('formata decimais com casas diferentes sem misturar os formatadores', () => {
    expect(formatDecimal(1234.5, 2, 2)).toBe('1.234,50');
    expect(formatDecimal(1234.5, 0, 2)).toBe('1.234,5');
    expect(formatDecimal(0.12345, 4, 4)).toBe('0,1235');
    expect(formatDecimal(1234.5, 2, 2)).toBe('1.234,50');
  });
});
