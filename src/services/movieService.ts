import axiosInstance from '../lib/api'; // Sử dụng axiosInstance cấu hình sẵn của dự án

// Định nghĩa Interface cấu trúc dữ liệu Phim khớp chuẩn Contract Backend
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

export const movieService = {
  // Lấy danh sách phim cho người dùng (Movies đang hoạt động)
  getActiveMovies: async () => {
    const response = await axiosInstance.get('/api/movies', {
      params: { status: 'NOW_SHOWING' }
    });
    // axiosInstance đã có interceptor tự động trả về response.data
    return response; 
  },

  // 1. GET: Lấy danh sách phim có phân trang (Ứng với SCRUM-60/SCRUM-65)
  getMoviesWithPagination: async (page: number = 1, limit: number = 10) => {
    // Truyền query parameters dạng ?page=...&limit=...
    const response = await axiosInstance.get('/api/Movies', {
      params: { page, limit }
    });
    return response.data; // Trả về object chứa mảng data, totalCount...
  },

  // 2. POST: Thêm phim mới sử dụng multipart/form-data (Ứng với SCRUM-59)
  createMovie: async (movieData: MovieData) => {
    const formData = new FormData();
    Object.entries(movieData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString());
      }
    });

    const response = await axiosInstance.post('/api/movies', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // 3. PUT: Cập nhật thông tin phim theo ID (Ứng với SCRUM-59)
  updateMovie: async (id: number, movieData: MovieData) => {
    const formData = new FormData();
    Object.entries(movieData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString());
      }
    });

    const response = await axiosInstance.put(`/api/movies/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // 4. DELETE: Xóa phim khỏi hệ thống theo ID (Ứng với SCRUM-59)
  deleteMovie: async (id: number) => {
    const response = await axiosInstance.delete(`/api/Movies/${id}`);
    return response.data;
  }
};
