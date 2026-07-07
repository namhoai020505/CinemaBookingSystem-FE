import axiosInstance from '../lib/api';

// Kiểu dữ liệu phòng chiếu trả về từ backend.
export interface RoomResponse {
  roomId: string;
  cinemaId: string;
  cinemaName: string;
  roomName: string;
  capacity: number;
  roomStatus: string;
  seatCount: number;
}

// Payload tạo phòng mới trong một rạp.
export interface CreateRoomPayload {
  roomName: string;
  capacity: number;
  roomStatus: string;
}

// Payload cập nhật thông tin phòng.
export interface UpdateRoomPayload {
  roomName: string;
  capacity: number;
  roomStatus: string;
}

// Payload sinh ghế tự động theo số hàng/cột và loại ghế.
export interface GenerateSeatsPayload {
  rows: number;
  columns: number;
  seatTypeId: string;
}

// Kiểu dữ liệu ghế trong sơ đồ phòng.
export interface SeatResponse {
  seatId: string;
  roomId: string;
  rowLabel: string;
  seatNumber: number;
  seatCode: string;
  seatTypeId: string;
  isActive: boolean;
}

// Payload tạo ghế lẻ.
export interface CreateSeatPayload {
  roomId: string;
  rowLabel: string;
  seatNumber: number;
  seatTypeId: string;
}

// Payload cập nhật ghế lẻ.
export interface UpdateSeatPayload {
  rowLabel: string;
  seatNumber: number;
  seatTypeId: string;
  isActive?: boolean;
}

// Kiểu dữ liệu rạp dùng khi tạo phòng.
export interface CinemaResponse {
  cinemaId: string;
  cinemaName: string;
  address: string;
  city: string;
  phoneNumber?: string;
  cinemaStatus: string;
}

// Wrapper ApiResponse chuẩn backend; interceptor đã unwrap response.data một lớp.
interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

// Gom API quản lý phòng và layout ghế cho admin.
export const roomService = {
  // GET /api/rooms/rooms: lấy toàn bộ danh sách phòng (bao gồm cả phòng ngưng hoạt động).
  getRooms: async (includeInactive = true): Promise<RoomResponse[]> => {
    const envelope = await axiosInstance.get('/api/rooms/rooms', {
      params: { includeInactive }
    }) as unknown as ApiEnvelope<RoomResponse[]>;
    return envelope?.data ?? [];
  },

  // GET /api/rooms/rooms/{roomId}: lấy chi tiết phòng.
  getRoomById: async (roomId: string): Promise<RoomResponse> => {
    const envelope = await axiosInstance.get(`/api/rooms/rooms/${roomId}`) as unknown as ApiEnvelope<RoomResponse>;
    return envelope.data;
  },

  // POST /api/rooms/cinemas/{cinemaId}/rooms: tạo phòng mới trong rạp.
  createRoom: async (cinemaId: string, payload: CreateRoomPayload): Promise<RoomResponse> => {
    const envelope = await axiosInstance.post(`/api/rooms/cinemas/${cinemaId}/rooms`, payload) as unknown as ApiEnvelope<RoomResponse>;
    return envelope.data;
  },

  // PUT /api/rooms/rooms/{roomId}: cập nhật thông tin phòng.
  updateRoom: async (roomId: string, payload: UpdateRoomPayload): Promise<RoomResponse> => {
    const envelope = await axiosInstance.put(`/api/rooms/rooms/${roomId}`, payload) as unknown as ApiEnvelope<RoomResponse>;
    return envelope.data;
  },

  // DELETE /api/rooms/rooms/{roomId}: xóa hoặc vô hiệu hóa phòng.
  deleteRoom: async (roomId: string): Promise<void> => {
    await axiosInstance.delete(`/api/rooms/rooms/${roomId}`);
  },

  // POST /api/rooms/{roomId}/generate-seats: sinh sơ đồ ghế tự động.
  generateSeats: async (roomId: string, payload: GenerateSeatsPayload): Promise<void> => {
    await axiosInstance.post(`/api/rooms/${roomId}/generate-seats`, payload);
  },

  // GET /api/seats/room/{roomId}: lấy toàn bộ ghế trong một phòng.
  getSeatMap: async (roomId: string): Promise<SeatResponse[]> => {
    const envelope = await axiosInstance.get(`/api/seats/room/${roomId}`) as unknown as ApiEnvelope<SeatResponse[]>;
    return envelope?.data ?? [];
  },

  // POST /api/seats: tạo một ghế lẻ.
  createSeat: async (payload: CreateSeatPayload): Promise<SeatResponse> => {
    const envelope = await axiosInstance.post('/api/seats', payload) as unknown as ApiEnvelope<SeatResponse>;
    return envelope.data;
  },

  // PUT /api/seats/{seatId}: cập nhật thông tin một ghế.
  updateSeat: async (seatId: string, payload: UpdateSeatPayload): Promise<SeatResponse> => {
    const envelope = await axiosInstance.put(`/api/seats/${seatId}`, { seatId, ...payload }) as unknown as ApiEnvelope<SeatResponse>;
    return envelope.data;
  },

  // DELETE /api/seats/{seatId}: xóa một ghế khỏi phòng.
  deleteSeat: async (seatId: string): Promise<void> => {
    await axiosInstance.delete(`/api/seats/${seatId}`);
  },

  // GET /api/cinemas: lấy danh sách rạp để admin chọn rạp khi tạo phòng.
  getCinemas: async (): Promise<CinemaResponse[]> => {
    const envelope = await axiosInstance.get('/api/cinemas') as unknown as ApiEnvelope<CinemaResponse[]>;
    return envelope?.data ?? [];
  },
};
