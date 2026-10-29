// Estoque maximo (digitado ou automatico pelas vendas; minimo = 1/4 e meio = 1/2 dele): leitura do campo e textos
// da tabela de estoque e do quadro de reposicao.
import { ReposicaoItemDto } from '../../../core/services/produto.service';
import { formatDecimal } from '../../../shared/format';

export type MaximoLido = { ok: true; valor: number | null } | { ok: false; erro: string };

/**
 * Vazio = volta ao maximo automatico (null). Aceita "10", "2,5", "1.500" (milhar) e "2.5".
 * Negativo ou texto invalido devolve erro.
 */
export function parseQuantidadeMaxima(texto: string | null | undefined): MaximoLido {
  let s = String(texto ?? '').replace(/\s/g, '');
  if (!s) return { ok: true, valor: null };
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) {
    return { ok: false, erro: 'Informe um número (ou deixe vazio para usar o automático).' };
  }
  const valor = Math.round(Number(s) * 1000) / 1000;
  if (valor > 1_000_000) return { ok: false, erro: 'Máximo muito alto.' };
  return { ok: true, valor };
}

export function fmtQuantidade(v: number): string {
  return formatDecimal(v, 0, 3);
}

/** Ritmo de vendas na unidade que der numero de gente: por dia, por semana ou por mes. */
export function textoRitmo(porDia: number): string {
  if (porDia >= 1) return `~${formatDecimal(porDia, 0, 1)}/dia`;
  if (porDia * 7 >= 1) return `~${formatDecimal(porDia * 7, 0, 1)}/semana`;
  return `~${formatDecimal(porDia * 30, 0, 1)}/mês`;
}

/** Tempo arredondado para leitura rapida: "~10 dias", "~3 meses". */
export function textoDuracao(dias: number): string {
  if (dias < 1) return 'menos de 1 dia';
  if (dias < 1.5) return '~1 dia';
  if (dias < 60) return `~${Math.round(dias)} dias`;
  return `~${Math.round(dias / 30)} meses`;
}

/** De onde saiu a media de vendas, e os dias zerados que ficaram de fora. */
export function textoBaseGiro(item: ReposicaoItemDto): string {
  const base =
    item.baseGiro === 'TRIMESTRE' ? 'Média de vendas dos últimos 3 meses' :
    item.baseGiro === 'SEMESTRE' ? 'Média de 6 meses (poucas vendas nos últimos 3 meses)' :
    '';
  if (!base) return '';
  const zerado = item.diasSemEstoque > 0
    ? ` · sem contar ${item.diasSemEstoque} ${item.diasSemEstoque === 1 ? 'dia' : 'dias'} sem estoque`
    : '';
  return base + zerado;
}

/** O que aparece no campo Máx. quando ele esta vazio (o automatico). */
export function placeholderMaximo(item: ReposicaoItemDto | null | undefined): string {
  return item?.maximoAutomatico != null ? fmtQuantidade(item.maximoAutomatico) : '—';
}

/** Explica o campo Máx. de cada produto: automatico, fixado ou sem vendas para calcular. */
export function dicaMaximo(item: ReposicaoItemDto | null | undefined): string {
  if (!item) return 'Estoque máximo. Em branco = automático pelas vendas; 0 = não acompanhar.';
  const auto = item.maximoAutomatico;
  const niveis = item.minimo != null && item.meio != null
    ? ` Mínimo ${fmtQuantidade(item.minimo)}, meio ${fmtQuantidade(item.meio)}.`
    : '';
  if (item.estoqueMaximo === 0) return 'Não acompanhado (máximo 0). Apague para voltar ao automático.';
  if (item.estoqueMaximo != null) {
    const seria = auto != null ? ` Pelas vendas, o automático seria ${fmtQuantidade(auto)}.` : '';
    return `Máximo fixado por você.${niveis}${seria} Apague para voltar ao automático.`;
  }
  if (auto != null) {
    return `Automático: ${fmtQuantidade(auto)} (4 semanas de venda; vende ${textoRitmo(item.giroDiario ?? 0)}).${niveis} ` +
      'Digite outro valor para fixar; 0 = não acompanhar.';
  }
  return 'Sem vendas nos últimos 6 meses para calcular. Digite um máximo se quiser acompanhar este produto.';
}

/** "hoje", "ontem", "há 12 dias", "há 3 meses". */
export function textoHaQuanto(iso: string, agora = new Date()): string {
  const dias = Math.floor((agora.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 60) return `há ${dias} dias`;
  return `há ${Math.round(dias / 30)} meses`;
}
