import axiosInstance from '../lib/api';
import type { ApiResponse } from './bookingService';

export type CreatePaymentPayload = {
  bookingId: string;
  paymentProviderId: string;
};

export type CreatePaymentResponse = {
  paymentId: string;
  amount: number;
  transactionCode: string;
  bankName: string;
  bankAccount: string;
  accountName?: string | null;
  qrCode?: string | null;
  qrUrl?: string | null;
  expiresAt?: string | null;
};

export const paymentService = {
  createPayment: async (payload: CreatePaymentPayload) => {
    const response = await axiosInstance.post('/api/payment', payload) as unknown as ApiResponse<CreatePaymentResponse>;
    return response;
  },
};
