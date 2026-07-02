import api from '../lib/api';

export type ApiResponse<T = unknown> = {
  success: boolean;
  message?: string;
  errorCode?: string;
  errors?: Record<string, string[]>;
  data?: T | null;
  statusCode?: number;
};

export type ReviewQueueItem = {
  reviewId: string;
  customerProfileId: string;
  customerName?: string | null;
  movieId: string;
  movieTitle?: string | null;
  bookingId?: string | null;
  rating: number;
  comment?: string | null;
  createdAt: string;
  status: string;
  rejectedReason?: string | null;
  moderatedBy?: string | null;
};

export type ReviewItem = ReviewQueueItem;

export type CreateReviewPayload = {
  movieId: string;
  bookingId?: string;
  rating: number;
  comment?: string;
};

type ApiErrorLike = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      errorCode?: string;
      errors?: Record<string, string[]>;
      title?: string;
      detail?: string;
    };
  };
  message?: string;
};

// Chuyen Axios/backend error thanh envelope thong nhat de UI khong bi promise rejection tho.
const toFailedResponse = <T>(error: unknown, fallback: string): ApiResponse<T> => {
  const apiError = error as ApiErrorLike;
  const responseData = apiError.response?.data;

  return {
    success: false,
    message:
      responseData?.message ||
      responseData?.detail ||
      responseData?.title ||
      apiError.message ||
      fallback,
    errorCode: responseData?.errorCode,
    errors: responseData?.errors,
    data: null,
    statusCode: apiError.response?.status,
  };
};

// Gom API review de cac page user/admin khong phai biet chi tiet URL backend.
export const reviewService = {
  getMovieReviews: async (movieId: string) => {
    try {
      const response = (await api.get(
        `/api/reviews/movies/${movieId}`,
      )) as unknown as ApiResponse<ReviewItem[]>;
      return response;
    } catch (error) {
      return toFailedResponse<ReviewItem[]>(error, 'Khong tai duoc danh sach danh gia phim.');
    }
  },

  createReview: async (payload: CreateReviewPayload) => {
    try {
      const response = (await api.post(
        '/api/reviews',
        payload,
      )) as unknown as ApiResponse<ReviewItem>;
      return response;
    } catch (error) {
      return toFailedResponse<ReviewItem>(error, 'Khong gui duoc danh gia.');
    }
  },

  getModerationQueue: async () => {
    try {
      const response = (await api.get(
        '/api/reviews/admin/moderation-queue',
      )) as unknown as ApiResponse<ReviewQueueItem[]>;
      return response;
    } catch (error) {
      return toFailedResponse<ReviewQueueItem[]>(error, 'Khong tai duoc hang doi kiem duyet.');
    }
  },

  approveReview: async (reviewId: string) => {
    try {
      const response = (await api.put(
        `/api/reviews/admin/${reviewId}/approve`,
      )) as unknown as ApiResponse<boolean>;
      return response;
    } catch (error) {
      return toFailedResponse<boolean>(error, 'Khong duyet duoc danh gia.');
    }
  },

  rejectReview: async (reviewId: string) => {
    try {
      const response = (await api.put(
        `/api/reviews/admin/${reviewId}/reject`,
      )) as unknown as ApiResponse<boolean>;
      return response;
    } catch (error) {
      return toFailedResponse<boolean>(error, 'Khong tu choi duoc danh gia.');
    }
  },
};
