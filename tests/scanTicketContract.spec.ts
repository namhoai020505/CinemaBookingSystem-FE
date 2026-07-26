import { expect, test } from '@playwright/test';
import {
  buildConfirmTicketScanRequest,
  parseScanTicketResponse,
  ticketScanEndpoints,
} from '../src/services/scanTicketContract';

const validScanTicketResponse = {
  ticketId: 'TCK_001',
  ticketStatus: 'UNUSED',
  checkInLogId: null,
  scanTime: '2026-07-26T10:00:00Z',
  bookingId: 'BOK_001',
  bookingCode: 'BOK_001',
  customerName: 'Nam Hoai',
  customerPhone: '0900000001',
  cinemaId: 'CIN_001',
  cinemaName: 'G2Cinema Thai Nguyen',
  roomId: 'RM_001',
  roomName: 'Phong 1',
  showtimeId: 'SHW_001',
  showtimeStartTime: '2026-07-26T12:00:00Z',
  showtimeEndTime: '2026-07-26T14:00:00Z',
  movieTitle: 'Avengers: Secret Wars',
  seatCode: 'A1',
  seatCodes: ['A1', 'A2'],
  foodAndBeverageItems: [
    {
      fbItemId: 'FB_POPCORN',
      itemName: 'Popcorn',
      quantity: 2,
      unitPrice: 55000,
      subtotal: 110000,
    },
  ],
};

test('scan ticket contract accepts the backend response shape used by desktop popup', () => {
  const parsed = parseScanTicketResponse(validScanTicketResponse);

  expect(parsed.bookingId).toBe('BOK_001');
  expect(parsed.customerName).toBe('Nam Hoai');
  expect(parsed.seatCodes).toEqual(['A1', 'A2']);
  expect(parsed.foodAndBeverageItems[0]).toMatchObject({
    itemName: 'Popcorn',
    quantity: 2,
  });
});

test('scan ticket contract rejects missing seatCodes array', () => {
  const invalid = { ...validScanTicketResponse, seatCodes: undefined };

  expect(() => parseScanTicketResponse(invalid)).toThrow(/seatCodes/);
});

test('scan ticket contract rejects F&B items without quantity', () => {
  const invalid = {
    ...validScanTicketResponse,
    foodAndBeverageItems: [
      {
        fbItemId: 'FB_POPCORN',
        itemName: 'Popcorn',
        unitPrice: 55000,
        subtotal: 110000,
      },
    ],
  };

  expect(() => parseScanTicketResponse(invalid)).toThrow(/quantity/);
});

test('ticket scan endpoints keep preview separate from check-in confirm', () => {
  expect(ticketScanEndpoints.preview).toBe('/api/tickets/scan/preview');
  expect(ticketScanEndpoints.confirm).toBe('/api/tickets/scan/confirm');
  expect(ticketScanEndpoints.legacyScan).toBe('/api/tickets/scan');
  expect(ticketScanEndpoints.preview).not.toBe(ticketScanEndpoints.confirm);
});

test('desktop confirm payload uses ticketId and roomId from previewed ticket', () => {
  const payload = buildConfirmTicketScanRequest(validScanTicketResponse);

  expect(payload).toEqual({
    ticketId: 'TCK_001',
    roomId: 'RM_001',
  });
});
