import api from '../lib/api';

export interface CompensationTicket {
  compensationTicketId: number;
  voucherCode: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
}

export interface CompensationCombo {
  compensationComboId: number;
  voucherCode: string;
  displayName: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
}

export interface Compensation {
  compensationId: number;
  sourceBookingId: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
  issuedAt: string;
  expiresAt: string;
  tickets: CompensationTicket[];
  combo?: CompensationCombo | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
}

export const compensationService = {
  /**
   * GET /api/customer/compensations
   * Fetch incident compensations owned by the authenticated customer
   */
  getCustomerCompensations: async () =>
    api.get<unknown, ApiResponse<Compensation[]>>('/api/customer/compensations'),

  /**
   * POST /api/staff/compensations/combos/redeem
   * Redeem a compensation combo at the counter (for staff/managers)
   */
  redeemCompensationCombo: async (voucherCode: string) =>
    api.post<unknown, ApiResponse<unknown>>('/api/staff/compensations/combos/redeem', {
      voucherCode,
    }),
};
