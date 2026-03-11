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

export interface SaleItemDto {
  id: number;
  produtoId: number;
  tipo: string;
  nome: string;
  codigoBarra?: string | null;
  unitPrice: number;
  quantity: number;
  returnedQuantity: number;
}

export interface SaleReturnItemDto {
  id: number;
  saleItemId: number;
  produtoId: number;
  quantity: number;
  unitPrice: number;
}

export interface SaleReturnExchangeItemDto {
  id: number;
  produtoId: number;
  tipo: string;
  nome: string;
  codigoBarra?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface PaymentDto {
  id: number;
  method: number;
  amount: number;
  paidAt: string;
  refCode?: string | null;
}

export interface PaymentMethodTotalDto {
  method: number;
  total: number;
}

export interface SaleReturnDto {
  id: number;
  operadorId?: number | null;
  reason?: string | null;
  operation: number;
  returnType: number;
  createdAt: string;
  items: SaleReturnItemDto[];
  exchangeItems: SaleReturnExchangeItemDto[];
}

export interface SaleDetailsDto {
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
  items: SaleItemDto[];
  returns: SaleReturnDto[];
  payments: PaymentDto[];
}

export interface SaleItemSummaryDto {
  produtoId: number;
  tipo: string;
  nome: string;
  quantidade: number;
  total: number;
}

export interface SalesSeriesPointDto {
  date: string;
  productTotal: number;
  serviceTotal: number;
  profitTotal: number;
  total: number;
  count: number;
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

export interface ReturnSaleItemRequest {
  saleItemId: number;
  quantity: number;
}

export interface ExchangeSaleItemRequest {
  produtoId: number;
  tipo: string;
  nome: string;
  codigoBarra?: string | null;
  unitPrice: number;
  quantity: number;
}

export interface ReturnSaleRequest {
  saleId: number;
  reason?: string | null;
  operation: number;
  returnType: number;
  items: ReturnSaleItemRequest[];
  exchangeItems?: ExchangeSaleItemRequest[] | null;
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
    take = 100,
    operadorNome?: string
  ): Observable<SaleListItemDto[]> {
    const params: any = { skip, take };
    if (dataInicio) params.dataInicio = dataInicio;
    if (dataFim) params.dataFim = dataFim;
    if (status && status.length) params.status = status.join(',');
    if (operadorNome) params.operadorNome = operadorNome;
    return this.http.get<SaleListItemDto[]>(`${this.api}`, { params });
  }

  listPaymentsTotal(
    dataInicio: string,
    dataFim: string,
    operadorNome: string,
    status?: Array<string | number>
  ): Observable<PaymentMethodTotalDto[]> {
    const params: any = { dataInicio, dataFim, operadorNome };
    if (status && status.length) params.status = status.join(',');
    return this.http.get<PaymentMethodTotalDto[]>(`${this.api}/payments/total`, { params });
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

  listSalesSeries(
    dataInicio?: string,
    dataFim?: string,
    status?: Array<string | number>
  ): Observable<SalesSeriesPointDto[]> {
    const params: any = {};
    if (dataInicio) params.dataInicio = dataInicio;
    if (dataFim) params.dataFim = dataFim;
    if (status && status.length) params.status = status.join(',');
    return this.http.get<SalesSeriesPointDto[]>(`${this.api}/series`, { params });
  }

  get(saleId: number): Observable<SaleSummaryDto> {
    return this.http.get<SaleSummaryDto>(`${this.api}/${saleId}`);
  }

  getDetails(saleId: number): Observable<SaleDetailsDto> {
    return this.http.get<SaleDetailsDto>(`${this.api}/${saleId}/details`);
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

  returnSale(saleId: number, body: ReturnSaleRequest): Observable<SaleDetailsDto> {
    return this.http.post<SaleDetailsDto>(`${this.api}/${saleId}/return`, { ...body, saleId });
  }
}
