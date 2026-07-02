import axiosInstance from '../lib/api';

// ============================================================
// Types khớp chuẩn Backend Contracts — Rooms & Seats
// ============================================================

/** Khớp CinemaSystem.Contracts.Rooms.RoomResponse */
export interface RoomResponse {
  roomId: string;
  cinemaId: string;
  cinemaName: string;
  roomName: string;
  capacity: number;
  roomStatus: string;   // ACTIVE | INACTIVE | MAINTENANCE
  seatCount: number;
}

/** Khớp CinemaSystem.Contracts.Rooms.CreateRoomRequest */
export interface CreateRoomPayload {
  roomName: string;
  capacity: number;
  roomStatus: string;
}

/** Khớp CinemaSystem.Contracts.Rooms.UpdateRoomRequest */
export interface UpdateRoomPayload {
  roomName: string;
  capacity: number;
  roomStatus: string;
}

/** Khớp CinemaSystem.Contracts.Rooms.GenerateSeatsRequest */
export interface GenerateSeatsPayload {
  rows: number;
  columns: number;
  seatTypeId: string;
}

/** Khớp CinemaSystem.Contracts.Seats.SeatResponse */
export interface SeatResponse {
  seatId: string;
  roomId: string;
  rowLabel: string;
  seatNumber: number;
  seatCode: string;
  seatTypeId: string;   // SEAT_TYPE_NORMAL | SEAT_TYPE_VIP | SEAT_TYPE_SWEETBOX
  isActive: boolean;
}

/** Khớp CinemaSystem.Contracts.Seats.CreateSeatRequest */
export interface CreateSeatPayload {
  roomId: string;
  rowLabel: string;
  seatNumber: number;
  seatTypeId: string;
}

/** Khớp CinemaSystem.Contracts.Seats.UpdateSeatRequest */
export interface UpdateSeatPayload {
  rowLabel: string;
  seatNumber: number;
  seatTypeId: string;
  isActive?: boolean;
}

/** Khớp CinemaSystem.Contracts.Cinemas.CinemaResponse */
export interface CinemaResponse {
  cinemaId: string;
  cinemaName: string;
  address: string;
  city: string;
  phoneNumber?: string;
  cinemaStatus: string;
}

// ============================================================
// Wrapper giải nén ApiResponse<T> chuẩn BE
// (api interceptor đã trả response.data nên ta nhận ApiResponse)
// ============================================================
interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

// ============================================================
// Service methods
// ============================================================
export const roomService = {
  // GET /api/rooms/rooms: lấy toàn bộ danh sách phòng.
  getRooms: async (): Promise<RoomResponse[]> => {
    const envelope = await axiosInstance.get('/api/rooms/rooms') as unknown as ApiEnvelope<RoomResponse[]>;
    return envelope?.data ?? [];
  },

  /** GET /api/rooms/rooms/{roomId} – Chi tiết phòng */
  getRoomById: async (roomId: string): Promise<RoomResponse> => {
    const envelope = await axiosInstance.get(`/api/rooms/rooms/${roomId}`) as unknown as ApiEnvelope<RoomResponse>;
    return envelope.data;
  },

  /** POST /api/rooms/cinemas/{cinemaId}/rooms – Tạo phòng mới */
  createRoom: async (cinemaId: string, payload: CreateRoomPayload): Promise<RoomResponse> => {
    const envelope = await axiosInstance.post(`/api/rooms/cinemas/${cinemaId}/rooms`, payload) as unknown as ApiEnvelope<RoomResponse>;
    return envelope.data;
  },

  /** PUT /api/rooms/rooms/{roomId} – Cập nhật phòng */
  updateRoom: async (roomId: string, payload: UpdateRoomPayload): Promise<RoomResponse> => {
    const envelope = await axiosInstance.put(`/api/rooms/rooms/${roomId}`, payload) as unknown as ApiEnvelope<RoomResponse>;
    return envelope.data;
  },

  /** DELETE /api/rooms/rooms/{roomId} – Xóa phòng */
  deleteRoom: async (roomId: string): Promise<void> => {
    await axiosInstance.delete(`/api/rooms/rooms/${roomId}`);
  },

  /** POST /api/rooms/{roomId}/generate-seats – Sinh ghế tự động */
  generateSeats: async (roomId: string, payload: GenerateSeatsPayload): Promise<void> => {
    await axiosInstance.post(`/api/rooms/${roomId}/generate-seats`, payload);
  },

  // ---------- Seats ----------

  /** GET /api/seats/room/{roomId} – Lấy sơ đồ ghế */
  getSeatMap: async (roomId: string): Promise<SeatResponse[]> => {
    const envelope = await axiosInstance.get(`/api/seats/room/${roomId}`) as unknown as ApiEnvelope<SeatResponse[]>;
    return envelope?.data ?? [];
  },

  /** POST /api/seats – Tạo ghế đơn */
  createSeat: async (payload: CreateSeatPayload): Promise<SeatResponse> => {
    const envelope = await axiosInstance.post('/api/seats', payload) as unknown as ApiEnvelope<SeatResponse>;
    return envelope.data;
  },

  /** PUT /api/seats/{seatId} – Cập nhật ghế */
  updateSeat: async (seatId: string, payload: UpdateSeatPayload): Promise<SeatResponse> => {
    const envelope = await axiosInstance.put(`/api/seats/${seatId}`, { seatId, ...payload }) as unknown as ApiEnvelope<SeatResponse>;
    return envelope.data;
  },

  /** DELETE /api/seats/{seatId} – Xóa ghế */
  deleteSeat: async (seatId: string): Promise<void> => {
    await axiosInstance.delete(`/api/seats/${seatId}`);
  },

  // ---------- Helpers ----------

  /** GET /api/cinemas – Danh sách rạp chiếu */
  getCinemas: async (): Promise<CinemaResponse[]> => {
    const envelope = await axiosInstance.get('/api/cinemas') as unknown as ApiEnvelope<CinemaResponse[]>;
    return envelope?.data ?? [];
  },
};
