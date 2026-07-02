import axiosInstance from '../lib/api';

// Kiểu dữ liệu phim dùng cho form quản lý phim ở admin.
export interface MovieData {
  id?: number;
  movieNameVn: string;
  movieNameEng: string;
  director: string;
  actor: string;
  duration: number;
  fromDate: string;
  toDate: string;
  content: string;
  trailerUrl?: string;
  imagePoster?: string;
}

// Gom các API liên quan tới phim để component không gọi axios trực tiếp.
export const movieService = {
  // GET /api/movies?status=NOW_SHOWING: lấy phim đang chiếu cho trang user.
  getActiveMovies: async () => {
    const response = await axiosInstance.get('/api/movies', {
      params: { status: 'NOW_SHOWING' },
    });
    return response;
  },

  // GET /api/Movies?page=&limit=: lấy danh sách phim có phân trang cho admin.
  getMoviesWithPagination: async (page: number = 1, limit: number = 10) => {
    const response = await axiosInstance.get('/api/Movies', {
      params: { page, limit },
    });
    return response.data;
  },

  // POST /api/movies: thêm phim mới bằng multipart/form-data để hỗ trợ poster/trailer.
  createMovie: async (movieData: MovieData) => {
    const formData = new FormData();
    Object.entries(movieData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString());
      }
    });

    const response = await axiosInstance.post('/api/movies', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // PUT /api/movies/{id}: cập nhật thông tin phim theo id.
  updateMovie: async (id: number, movieData: MovieData) => {
    const formData = new FormData();
    Object.entries(movieData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString());
      }
    });

    const response = await axiosInstance.put(`/api/movies/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // DELETE /api/Movies/{id}: xóa hoặc vô hiệu hóa phim khỏi hệ thống.
  deleteMovie: async (id: number) => {
    const response = await axiosInstance.delete(`/api/Movies/${id}`);
    return response.data;
  },
};
