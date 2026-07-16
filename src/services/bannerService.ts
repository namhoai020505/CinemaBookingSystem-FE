import axiosInstance from '../lib/api';

export interface BannerResponse {
  bannerId: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  bannerType: string; // MOVIE | PROMOTION | FOOD_BEVERAGE | SYSTEM
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

export const bannerService = {
  getActiveBanners: async (): Promise<BannerResponse[]> => {
    const envelope = await axiosInstance.get('/api/banners') as unknown as ApiEnvelope<BannerResponse[]>;
    return envelope.data;
  },

  getAllBanners: async (): Promise<BannerResponse[]> => {
    const envelope = await axiosInstance.get('/api/banners/all') as unknown as ApiEnvelope<BannerResponse[]>;
    return envelope.data;
  },

  getBannerById: async (bannerId: string): Promise<BannerResponse> => {
    const envelope = await axiosInstance.get(`/api/banners/${bannerId}`) as unknown as ApiEnvelope<BannerResponse>;
    return envelope.data;
  },

  createBanner: async (formData: FormData): Promise<BannerResponse> => {
    const envelope = await axiosInstance.post('/api/banners', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }) as unknown as ApiEnvelope<BannerResponse>;
    return envelope.data;
  },

  updateBanner: async (bannerId: string, formData: FormData): Promise<BannerResponse> => {
    const envelope = await axiosInstance.put(`/api/banners/${bannerId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }) as unknown as ApiEnvelope<BannerResponse>;
    return envelope.data;
  },

  deleteBanner: async (bannerId: string): Promise<void> => {
    await axiosInstance.delete(`/api/banners/${bannerId}`);
  }
};
