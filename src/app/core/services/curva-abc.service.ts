// src/app/core/services/curva-abc.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

import { AuthStorageService } from './auth-storage.service';
import { PdvService, SaleItemSummaryDto } from './pdv.service';
import { ClasseAbc, classificarAbc } from '../../shared/curva-abc';
import { ultimosDias } from '../../shared/datas';

/** Vendas que contam nos relatorios: finalizadas e devolvidas (a troca entregue numa devolucao tambem saiu vendida). */
export const STATUS_VENDIDAS = [2, 4];

/** Item do resumo do PDV que e produto (o resto e servico, com ids de outra tabela). */
export function ehProduto(item: Pick<SaleItemSummaryDto, 'tipo'>): boolean {
  const tipo = String(item.tipo ?? '').trim().toLowerCase();
  return tipo === 'produto' || tipo === 'product';
}

const DIAS_CURVA = 90;
const GUARDA_MS = 5 * 60 * 1000;

/**
 * Curva ABC dos produtos pelo faturamento dos ultimos 90 dias, para o quadro de reposicao e a lista de compra.
 * Guarda o resultado por 5 minutos (por loja): abrir o quadro de novo nao pede o resumo ao PDV outra vez.
 */
@Injectable({ providedIn: 'root' })
export class CurvaAbcService {
  private pdv = inject(PdvService);
  private auth = inject(AuthStorageService);
  private guardado: { loja: number | null; em: number; curva$: Observable<Map<number, ClasseAbc>> } | null = null;

  readonly dias = DIAS_CURVA;

  ultimos90Dias(): Observable<Map<number, ClasseAbc>> {
    const loja = this.auth.lojaId;
    const agora = Date.now();
    if (this.guardado && this.guardado.loja === loja && agora - this.guardado.em < GUARDA_MS) {
      return this.guardado.curva$;
    }
    const { inicio, fim } = ultimosDias(DIAS_CURVA);
    const curva$ = this.pdv.listItemSummary(inicio, fim, STATUS_VENDIDAS).pipe(
      map(itens => classificarAbc(itens.filter(ehProduto).map(i => ({ produtoId: i.produtoId, total: Number(i.total) || 0 })))),
      // Erro nao fica guardado: a proxima tela tenta de novo
      catchError(err => {
        this.guardado = null;
        return throwError(() => err);
      }),
      shareReplay(1)
    );
    this.guardado = { loja, em: agora, curva$ };
    return curva$;
  }
}
