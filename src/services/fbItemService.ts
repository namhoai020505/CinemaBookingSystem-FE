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

export type CounterFbOrderItem = {
  fbItemId: string;
  quantity: number;
};

export type CreateCounterFbOrderPayload = {
  cinemaId: string;
  showtimeId?: string;
  customerProfileId?: string;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  items: CounterFbOrderItem[];
};

export type FbFulfillmentResponse = {
  bookingId: string;
  fbFulfillmentStatus: string;
  fbFulfilledAt?: string | null;
  staffProfileId?: string | null;
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
