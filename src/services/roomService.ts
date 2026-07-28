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
  seatTypeId: string;
  seatStatus?: string;  // ACTIVE | INACTIVE
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
  seatStatus?: string;  // ACTIVE | INACTIVE
}

export interface SeatTypeResponse {
  seatTypeId: string;
  typeName: string;
  extraFee: number;
  seatSpan: number;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
}

export interface UpsertSeatTypePayload {
  typeName: string;
  extraFee: number;
  seatSpan: number;
  isActive: boolean;
  sortOrder: number;
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
  // ---------- Rooms ----------

  /** GET /api/rooms/rooms – Lấy toàn bộ danh sách phòng */
  getRooms: async (includeInactive = true): Promise<RoomResponse[]> => {
    const envelope = await axiosInstance.get('/api/rooms/rooms', {
      params: { includeInactive }
    }) as unknown as ApiEnvelope<RoomResponse[]>;
    return envelope?.data ?? [];
  },

  /** GET /api/rooms/rooms/{roomId} – Chi tiết phòng */
  getRoomById: async (roomId: string, includeInactive = true): Promise<RoomResponse> => {
    const envelope = await axiosInstance.get(`/api/rooms/rooms/${roomId}`, {
      params: { includeInactive }
    }) as unknown as ApiEnvelope<RoomResponse>;
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
  getSeatTypes: async (includeInactive = false): Promise<SeatTypeResponse[]> => {
    const envelope = await axiosInstance.get('/api/seat-types', {
      params: { includeInactive }
    }) as unknown as ApiEnvelope<SeatTypeResponse[]>;
    return envelope?.data ?? [];
  },

  createSeatType: async (payload: UpsertSeatTypePayload): Promise<SeatTypeResponse> => {
    const envelope = await axiosInstance.post('/api/seat-types', payload) as unknown as ApiEnvelope<SeatTypeResponse>;
    return envelope.data;
  },

  updateSeatType: async (seatTypeId: string, payload: UpsertSeatTypePayload): Promise<SeatTypeResponse> => {
    const envelope = await axiosInstance.put(`/api/seat-types/${seatTypeId}`, payload) as unknown as ApiEnvelope<SeatTypeResponse>;
    return envelope.data;
  },

  deleteSeatType: async (seatTypeId: string): Promise<void> => {
    await axiosInstance.delete(`/api/seat-types/${seatTypeId}`);
  },

  mergeSeatType: async (
    seatTypeId: string,
    replacementSeatTypeId: string
  ): Promise<number> => {
    const envelope = await axiosInstance.post(
      `/api/seat-types/${seatTypeId}/merge`,
      { replacementSeatTypeId }
    ) as unknown as ApiEnvelope<number>;
    return envelope.data;
  },

  getSeatMap: async (roomId: string): Promise<SeatResponse[]> => {
    const envelope = await axiosInstance.get(`/api/seats/room/${roomId}`) as unknown as ApiEnvelope<SeatResponse[]>;
    const seats = envelope?.data ?? [];
    return seats.map(s => ({
      ...s,
      isActive: s.seatStatus !== 'INACTIVE'
    }));
  },

  /** POST /api/seats – Tạo ghế đơn */
  createSeat: async (payload: CreateSeatPayload): Promise<SeatResponse> => {
    const envelope = await axiosInstance.post('/api/seats', payload) as unknown as ApiEnvelope<SeatResponse>;
    const seat = envelope.data;
    return {
      ...seat,
      isActive: seat?.seatStatus !== 'INACTIVE'
    };
  },

  /** PUT /api/seats/{seatId} – Cập nhật ghế */
  updateSeat: async (seatId: string, payload: UpdateSeatPayload): Promise<SeatResponse> => {
    const { isActive, ...rest } = payload;
    const seatStatus = isActive !== undefined 
      ? (isActive ? 'ACTIVE' : 'INACTIVE') 
      : (payload.seatStatus || 'ACTIVE');

    const envelope = await axiosInstance.put(`/api/seats/${seatId}`, { 
      seatId, 
      ...rest, 
      seatStatus 
    }) as unknown as ApiEnvelope<SeatResponse>;

    const seat = envelope.data;
    return {
      ...seat,
      isActive: seat?.seatStatus !== 'INACTIVE'
    };
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
