// src/app/core/services/pdv.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type SaleStatus = 'Open' | 'Completed' | 'Cancelled';

export interface SaleSummaryDto {
  id: number;
  lojaId: number;
  subtotal: number;
  discountPercent: number;
  discountValue: number;
  total: number;
  paid: boolean;
  status: SaleStatus | string;
  createdAt: string;
}

export interface SaleListItemDto {
  id: number;
  lojaId: number;
  operadorId?: number | null;
  operadorNome?: string | null;
  subtotal: number;
  discountPercent: number;
  discountValue: number;
  total: number;
  status: SaleStatus | string;
  createdAt: string;
}

export interface SaleItemSummaryDto {
  produtoId: number;
  tipo: string;
  nome: string;
  quantidade: number;
  total: number;
}

export interface StartSaleRequest {
  startNew?: boolean;
}

export interface AddItemRequest {
  saleId: number;
  produtoId: number;
  tipo: string;
  nome: string;
  codigoBarra?: string | null;
  unitPrice: number;
  quantity: number;
}

export interface SetDiscountRequest {
  saleId: number;
  percent: number;
}

export interface AddPaymentRequest {
  saleId: number;
  method: number;
  amount: number;
  refCode?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PdvService {
  private readonly api = `${environment.apiBase.pdv}/api/Sales`;

  constructor(private http: HttpClient) {}

  start(startNew: boolean): Observable<SaleSummaryDto> {
    return this.http.post<SaleSummaryDto>(`${this.api}/start`, { startNew });
  }

  listOpen(): Observable<SaleSummaryDto[]> {
    return this.http.get<SaleSummaryDto[]>(`${this.api}/open`);
  }

  list(
    dataInicio?: string,
    dataFim?: string,
    status?: Array<string | number>,
    skip = 0,
    take = 100
  ): Observable<SaleListItemDto[]> {
    const params: any = { skip, take };
    if (dataInicio) params.dataInicio = dataInicio;
    if (dataFim) params.dataFim = dataFim;
    if (status && status.length) params.status = status.join(',');
    return this.http.get<SaleListItemDto[]>(`${this.api}`, { params });
  }

  listItemSummary(
    dataInicio?: string,
    dataFim?: string,
    status?: Array<string | number>
  ): Observable<SaleItemSummaryDto[]> {
    const params: any = {};
    if (dataInicio) params.dataInicio = dataInicio;
    if (dataFim) params.dataFim = dataFim;
    if (status && status.length) params.status = status.join(',');
    return this.http.get<SaleItemSummaryDto[]>(`${this.api}/items/summary`, { params });
  }

  get(saleId: number): Observable<SaleSummaryDto> {
    return this.http.get<SaleSummaryDto>(`${this.api}/${saleId}`);
  }

  addItem(saleId: number, body: AddItemRequest): Observable<SaleSummaryDto> {
    return this.http.post<SaleSummaryDto>(`${this.api}/${saleId}/items`, body);
  }

  removeItem(saleId: number, itemId: number): Observable<SaleSummaryDto> {
    return this.http.delete<SaleSummaryDto>(`${this.api}/${saleId}/items/${itemId}`);
  }

  setDiscount(saleId: number, percent: number): Observable<SaleSummaryDto> {
    return this.http.post<SaleSummaryDto>(`${this.api}/${saleId}/discount`, { saleId, percent });
  }

  addPayment(saleId: number, body: AddPaymentRequest): Observable<SaleSummaryDto> {
    return this.http.post<SaleSummaryDto>(`${this.api}/${saleId}/payments`, body);
  }

  checkout(saleId: number): Observable<SaleSummaryDto> {
    return this.http.post<SaleSummaryDto>(`${this.api}/${saleId}/checkout`, {});
  }

  cancel(saleId: number): Observable<void> {
    return this.http.post<void>(`${this.api}/${saleId}/cancel`, {});
  }
}
