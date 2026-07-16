import api from '../lib/api';
import type { ApiResponse } from './bookingService';

export type FbItem = {
  fbItemId: string;
  itemName: string;
  price: number;
  itemStatus: string;
};

export const fbItemService = {
  getActiveItems: async () => {
    const response = await api.get('/api/fb-items') as unknown as ApiResponse<FbItem[]>;
    return response;
  },
};
