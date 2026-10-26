// Formatadores pt-BR reaproveitados. toLocaleString com opcoes cria um Intl.NumberFormat novo
// a cada chamada (~60x mais lento) e os templates formatam valores a cada atualizacao da tela.
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', options);
    formatters.set(key, f);
  }
  return f;
}

/** R$ 1.234,50 */
export function formatBRL(value: number): string {
  return formatter('brl', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

/** 1.234,5 (casas decimais entre min e max) */
export function formatDecimal(value: number, minFractionDigits: number, maxFractionDigits: number): string {
  return formatter(`dec:${minFractionDigits}:${maxFractionDigits}`, {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}
