// Leitura do estoque minimo digitado na tabela de estoque e no quadro de reposicao.

export type MinimoLido = { ok: true; valor: number | null } | { ok: false; erro: string };

/**
 * Vazio = volta ao minimo padrao (null). Aceita "10", "2,5", "1.500" (milhar) e "2.5".
 * Negativo ou texto invalido devolve erro.
 */
export function parseQuantidadeMinima(texto: string | null | undefined): MinimoLido {
  let s = String(texto ?? '').replace(/\s/g, '');
  if (!s) return { ok: true, valor: null };
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) {
    return { ok: false, erro: 'Informe um número (ou deixe vazio para usar o padrão).' };
  }
  const valor = Math.round(Number(s) * 1000) / 1000;
  if (valor > 1_000_000) return { ok: false, erro: 'Mínimo muito alto.' };
  return { ok: true, valor };
}
