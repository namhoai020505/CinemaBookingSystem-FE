import axiosInstance from '../lib/api';
import type { ApiResponse } from './bookingService';

export const PAYMENT_PROVIDER_IDS = {
  SEPAY: 'PP_SEPAY',
  VNPAY: 'PP_VNPAY',
} as const;

export type PaymentProviderId =
  (typeof PAYMENT_PROVIDER_IDS)[keyof typeof PAYMENT_PROVIDER_IDS];

export type CreateSepayPaymentPayload = {
  bookingId: string;
  paymentProviderId: typeof PAYMENT_PROVIDER_IDS.SEPAY;
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
  checkoutUrl?: string | null;
  paymentProviderName?: string | null;
  expiresAt?: string | null;
};

export type CreateVnpayUrlPayload = {
  bookingId: string;
  paymentProviderId: typeof PAYMENT_PROVIDER_IDS.VNPAY;
};

export type CreateVnpayUrlResponse = {
  paymentUrl?: string | null;
  checkoutUrl?: string | null;
  url?: string | null;
  paymentId?: string | null;
  transactionCode?: string | null;
  amount?: number | null;
  expiresAt?: string | null;
};

export const getValidVnpayCheckoutUrl = (value?: string | null) => {
  const checkoutUrl = value?.trim();

  if (!checkoutUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(checkoutUrl);
    return parsedUrl.protocol === 'https:' ? parsedUrl.toString() : null;
  } catch {
    return null;
  }
};

export const getVnpayCheckoutUrl = (data?: CreateVnpayUrlResponse | null) =>
  getValidVnpayCheckoutUrl(
    data?.paymentUrl || data?.checkoutUrl || data?.url,
  );

const toVnpayUrlData = (value: unknown): CreateVnpayUrlResponse => {
  if (typeof value === 'string') {
    return { paymentUrl: value };
  }

  if (typeof value === 'object' && value) {
    return value as CreateVnpayUrlResponse;
  }

  return {};
};

const normalizeVnpayCreateResponse = (
  value: unknown,
): ApiResponse<CreateVnpayUrlResponse> => {
  if (
    typeof value === 'object'
    && value
    && 'success' in value
  ) {
    const response = value as {
      success: boolean;
      message?: string;
      errorCode?: string;
      errors?: Record<string, string[]>;
      data?: unknown;
    };

    return {
      success: response.success,
      message: response.message,
      errorCode: response.errorCode,
      errors: response.errors,
      data: toVnpayUrlData(response.data ?? value),
    };
  }

  return {
    success: true,
    data: toVnpayUrlData(value),
  };
};

const getVnpayCreateUrlEndpoint = () => {
  const endpoint = import.meta.env.VITE_VNPAY_CREATE_URL_ENDPOINT?.trim();

  if (!endpoint || endpoint.includes('replace-with')) {
    throw new Error(
      'Chưa cấu hình VITE_VNPAY_CREATE_URL_ENDPOINT cho API tạo URL VNPAY.',
    );
  }

  return endpoint;
};

export const paymentService = {
  createSepayPayment: async (payload: CreateSepayPaymentPayload) => {
    const response = await axiosInstance.post('/api/payment', payload) as unknown as ApiResponse<CreatePaymentResponse>;
    return response;
  },

  createVnpayPaymentUrl: async (payload: CreateVnpayUrlPayload) => {
    const response = await axiosInstance.post(
      getVnpayCreateUrlEndpoint(),
      payload,
    ) as unknown;

    return normalizeVnpayCreateResponse(response);
  },

  verifyVnpayReturn: async (queryString: string) => {
    const response = await axiosInstance.get(`/api/payment/vnpay-return${queryString}`) as unknown as ApiResponse<{
      transactionCode: string;
      responseCode: string;
      transactionStatus: string;
    }>;
    return response;
  },
};
