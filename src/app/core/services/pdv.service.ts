// src/app/core/services/pdv.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  private readonly api = '/api/Sales';

  constructor(private http: HttpClient) {}

  start(startNew: boolean): Observable<SaleSummaryDto> {
    return this.http.post<SaleSummaryDto>(`${this.api}/start`, { startNew });
  }

  listOpen(): Observable<SaleSummaryDto[]> {
    return this.http.get<SaleSummaryDto[]>(`${this.api}/open`);
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
