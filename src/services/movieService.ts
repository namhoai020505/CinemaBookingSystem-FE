import axiosInstance from '../lib/api';

// Định nghĩa Interface cấu trúc dữ liệu Phim khớp chuẩn Contract Backend
export interface MovieData {
  movieId?: string;
  title: string;
  durationMinutes: number;
  genre?: string;
  language?: string;
  director?: string;
  releaseDate?: string; // yyyy-MM-dd
  avgRating?: number;
  description?: string;
  posterUrl?: string;
  trailerUrl?: string;
  highlight?: string;
  movieStatus?: string; // NOW_SHOWING | COMING_SOON | ENDED | INACTIVE | ARCHIVED
}

// Khớp CinemaSystem.Contracts.Movies.MovieResponse
export interface MovieResponse {
  id: string;
  movieNameVn: string;
  genres?: string[];
  duration: number;
  imagePoster?: string;
  avgRating: number;
  highlight?: string;
  viewCount: number;
  ageRating?: string;
  movieStatus?: string;
  director?: string;
}

export interface GenreResponse {
  genreId: number;
  name: string;
}

// Khớp CinemaSystem.Contracts.Movies.MovieDetailResponse
export interface MovieDetailResponse {
  movieId: string;
  title: string;
  durationMinutes: number;
  genre?: string;
  genres?: string[];
  language?: string;
  director?: string;
  releaseDate?: string; // yyyy-MM-dd
  avgRating: number;
  description?: string;
  posterUrl?: string;
  trailerUrl?: string;
  movieStatus: string;
  viewCount: number;
  ageRating?: string;
  highlight?: string;
}

// Khớp cấu trúc PagedList từ backend
export interface PagedList<T> {
  items: T[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

export const movieService = {
  // Lấy danh sách phim cho người dùng (Đang chiếu + Sắp chiếu)
  getActiveMovies: async (): Promise<MovieResponse[]> => {
    const results = await Promise.all([
      axiosInstance.get('/api/movies', { params: { status: 'NOW_SHOWING', pageSize: 200 } }) as unknown as ApiEnvelope<PagedList<MovieResponse>>,
      axiosInstance.get('/api/movies', { params: { status: 'COMING_SOON', pageSize: 200 } }) as unknown as ApiEnvelope<PagedList<MovieResponse>>,
    ]);
    return [
      ...(results[0]?.data?.items ?? []),
      ...(results[1]?.data?.items ?? []),
    ];
  },

  // 1. GET: Lấy danh sách phim có phân trang (Ứng với backend mới)
  getMoviesWithPagination: async (pageIndex: number = 1, pageSize: number = 10, status?: string): Promise<PagedList<MovieResponse>> => {
    const envelope = await axiosInstance.get('/api/movies', {
      params: { pageIndex, pageSize, status }
    }) as unknown as ApiEnvelope<PagedList<MovieResponse>>;
    return envelope.data;
  },

  // GET: Lấy chi tiết 1 phim theo ID
  getMovieById: async (movieId: string): Promise<MovieDetailResponse> => {
    const envelope = await axiosInstance.get(`/api/movies/${movieId}`) as unknown as ApiEnvelope<MovieDetailResponse>;
    return envelope.data;
  },

  // 2. POST: Thêm phim mới sử dụng multipart/form-data
  createMovie: async (formData: FormData): Promise<MovieDetailResponse> => {
    const envelope = await axiosInstance.post('/api/movies', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }) as unknown as ApiEnvelope<MovieDetailResponse>;
    return envelope.data;
  },

  // 3. PUT: Cập nhật thông tin phim theo ID
  updateMovie: async (movieId: string, formData: FormData): Promise<MovieDetailResponse> => {
    const envelope = await axiosInstance.put(`/api/movies/${movieId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }) as unknown as ApiEnvelope<MovieDetailResponse>;
    return envelope.data;
  },

  // 4. DELETE: Xóa phim khỏi hệ thống theo ID
  deleteMovie: async (movieId: string): Promise<void> => {
    await axiosInstance.delete(`/api/movies/${movieId}`);
  },

  // 6. POST: Tăng lượt xem phim theo ID
  incrementMovieView: async (movieId: string): Promise<unknown> => {
    const envelope = await axiosInstance.post(`/api/movies/${movieId}/view`) as unknown as ApiEnvelope<unknown>;
    return envelope.data;
  },

  // 5. GET: Lấy danh sách thể loại từ DB
  getGenres: async (): Promise<GenreResponse[]> => {
    const envelope = await axiosInstance.get('/api/genres') as unknown as ApiEnvelope<GenreResponse[]>;
    return envelope.data;
  }
};
