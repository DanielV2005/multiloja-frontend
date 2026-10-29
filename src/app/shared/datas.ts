// Datas como os relatorios do PDV recebem: yyyy-mm-dd do dia local (o servidor converte para o fuso da loja).

export function isoLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Os ultimos `dias` dias, contando hoje: 30 = de 29 dias atras ate hoje. */
export function ultimosDias(dias: number, hoje = new Date()): { inicio: string; fim: string } {
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (dias - 1));
  return { inicio: isoLocal(inicio), fim: isoLocal(hoje) };
}

/** Data sem hora: "2026-10-29" -> "29/10/2026"; vazio fica vazio. */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return '';
  const [yyyy, mm, dd] = iso.slice(0, 10).split('-');
  return dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : iso;
}
