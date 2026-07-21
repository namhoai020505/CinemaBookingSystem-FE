import api from '../lib/api';
import type { ApiResponse } from './bookingService';

export type FbItem = {
  fbItemId: string;
  itemName: string;
  price: number;
  itemStatus: string;
};

export type CinemaFbInventoryItem = {
  cinemaInventoryId: string;
  cinemaId: string;
  fbItemId: string;
  itemName: string;
  price: number;
  quantity: number;
};

export type FbItemOptionRequest = {
  optionId: string;
  optionName?: string | null;
  extraFee: number;
};

export type CounterFbOrderItem = {
  fbItemId: string;
  itemId?: string;
  quantity: number;
  unitPrice?: number;
  options?: FbItemOptionRequest[];
};

export type CreateCounterFbOrderPayload = {
  cinemaId: string;
  shiftId?: string | null;
  bookingId?: string | null;
  showtimeId?: string | null;
  customerProfileId?: string | null;
  customerId?: string | null;
  memberCardNumber?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  items: CounterFbOrderItem[];
  voucherCode?: string | null;
  discountAmount?: number;
  totalAmount?: number;
  paymentMethod?: string | null;
  receivedAmount?: number;
  changeAmount?: number;
};

export type FbFulfillmentResponse = {
  bookingId: string;
  cinemaId?: string | null;
  shiftId?: string | null;
  customerProfileId?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  grossAmount?: number;
  discountAmount?: number;
  voucherCode?: string | null;
  totalAmount?: number;
  paymentMethod?: string | null;
  receivedAmount?: number | null;
  changeAmount?: number | null;
  fbFulfillmentStatus: string;
  fbFulfilledAt?: string | null;
  staffProfileId?: string | null;
  items?: CounterFbOrderItem[];
  message: string;
};

export const fbItemService = {
  getActiveItems: async () => {
    const response = await api.get('/api/fb-items') as unknown as ApiResponse<FbItem[]>;
    return response;
  },

  getCinemaInventory: async (cinemaId: string) => {
    const response = await api.get(`/api/fb-items/cinemas/${cinemaId}/inventory`) as unknown as ApiResponse<CinemaFbInventoryItem[]>;
    return response;
  },

  createCounterOrder: async (payload: CreateCounterFbOrderPayload) => {
    const response = await api.post('/api/fb-items/counter-orders', payload) as unknown as ApiResponse<FbFulfillmentResponse>;
    return response;
  },
};
