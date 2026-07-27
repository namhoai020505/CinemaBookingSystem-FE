import axiosInstance from '../lib/api';

export interface CinemaResponse {
  cinemaId: string;
  cinemaName: string;
  address: string;
  city: string;
  phoneNumber?: string;
  cinemaStatus: string; // ACTIVE | INACTIVE | MAINTENANCE
}

export interface CreateCinemaPayload {
  cinemaName: string;
  address: string;
  city: string;
  phoneNumber?: string;
  cinemaStatus?: string;
}

export interface UpdateCinemaPayload {
  cinemaName: string;
  address: string;
  city: string;
  phoneNumber?: string;
  cinemaStatus?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

export const cinemaService = {
  /** GET /api/cinemas – Danh sách tất cả rạp */
  getCinemas: async (): Promise<CinemaResponse[]> => {
    const envelope = (await axiosInstance.get('/api/cinemas')) as unknown as ApiEnvelope<CinemaResponse[]>;
    return envelope?.data ?? [];
  },

  /** GET /api/cinemas/{id} – Chi tiết rạp */
  getCinemaById: async (cinemaId: string): Promise<CinemaResponse> => {
    const envelope = (await axiosInstance.get(`/api/cinemas/${cinemaId}`)) as unknown as ApiEnvelope<CinemaResponse>;
    return envelope.data;
  },

  /** POST /api/cinemas – Tạo rạp chiếu mới (Admin) */
  createCinema: async (payload: CreateCinemaPayload): Promise<CinemaResponse> => {
    const envelope = (await axiosInstance.post('/api/cinemas', payload)) as unknown as ApiEnvelope<CinemaResponse>;
    return envelope.data;
  },

  /** PUT /api/cinemas/{id} – Cập nhật rạp chiếu (Admin) */
  updateCinema: async (cinemaId: string, payload: UpdateCinemaPayload): Promise<CinemaResponse> => {
    const envelope = (await axiosInstance.put(`/api/cinemas/${cinemaId}`, payload)) as unknown as ApiEnvelope<CinemaResponse>;
    return envelope.data;
  },

  /** DELETE /api/cinemas/{id} – Xóa / Tạm dừng rạp chiếu (Admin) */
  deleteCinema: async (cinemaId: string): Promise<void> => {
    await axiosInstance.delete(`/api/cinemas/${cinemaId}`);
  },
};
