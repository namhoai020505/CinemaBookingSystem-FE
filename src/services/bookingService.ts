import axiosInstance from '../lib/api';

export interface BookingPayload {
  showtimeId: string | number;
  showtimeSeatIds: (string | number)[];
  paymentMethod?: string;
}

export const bookingService = {
  createBooking: async (payload: BookingPayload) => {
    const response = await axiosInstance.post('/api/bookings', payload);
    return response;
  },

  getBookingById: async (bookingId: string | number) => {
    const response = await axiosInstance.get(`/api/bookings/${bookingId}`);
    return response;
  },

  getMyBookings: async () => {
    const response = await axiosInstance.get('/api/bookings/my-bookings');
    return response;
  }
};
