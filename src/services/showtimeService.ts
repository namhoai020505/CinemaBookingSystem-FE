import axiosInstance from '../lib/api';

export interface ShowtimeData {
  id?: string;
  movieId: string;
  roomId: string;
  startTime: string; // Định dạng ISO string hoặc "HH:mm" tùy BE
  endTime: string;
  showDate: string;
}

export const showtimeService = {
  // Lấy danh sách suất chiếu của một rạp theo ngày (Ứng với SCRUM-113)
  getShowtimesByDate: async (cinemaId: string, date: string) => {
    const response = await axiosInstance.get('/api/showtimes', {
      params: { cinemaId, date }
    });
    return response.data;
  },

  // Tạo suất chiếu mới khi Admin thả phim vào lịch (Ứng với SCRUM-66)
  createShowtime: async (data: ShowtimeData) => {
    const response = await axiosInstance.post('/api/showtimes', data);
    return response.data;
  }
};