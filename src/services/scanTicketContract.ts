export type ScanTicketRequest = {
  qrCode: string;
  roomId: string;
};

export type ConfirmTicketScanRequest = {
  ticketId: string;
  roomId: string;
};

export const ticketScanEndpoints = {
  preview: '/api/tickets/scan/preview',
  confirm: '/api/tickets/scan/confirm',
  legacyScan: '/api/tickets/scan',
} as const;

export type ScanTicketFoodAndBeverageItem = {
  fbItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type ScanTicketResponse = {
  ticketId: string;
  ticketStatus: string;
  checkInLogId?: string | null;
  scanTime?: string | null;
  bookingId: string;
  bookingCode: string;
  customerName?: string | null;
  customerPhone?: string | null;
  cinemaId: string;
  cinemaName: string;
  roomId: string;
  roomName: string;
  showtimeId: string;
  showtimeStartTime: string;
  showtimeEndTime: string;
  movieTitle: string;
  seatCode: string;
  seatCodes: string[];
  foodAndBeverageItems: ScanTicketFoodAndBeverageItem[];
};

export const buildConfirmTicketScanRequest = (
  ticket: Pick<ScanTicketResponse, 'ticketId' | 'roomId'>,
): ConfirmTicketScanRequest => ({
  ticketId: ticket.ticketId,
  roomId: ticket.roomId,
});

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isNullableString = (value: unknown): value is string | null | undefined =>
  value === null || value === undefined || typeof value === 'string';

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const requireString = (source: RecordValue, key: keyof ScanTicketResponse): string => {
  const value = source[key];
  if (!isString(value) || value.trim().length === 0) {
    throw new Error(`Invalid ticket scan response: ${String(key)} is required.`);
  }

  return value;
};

const optionalString = (source: RecordValue, key: keyof ScanTicketResponse): string | null | undefined => {
  const value = source[key];
  if (!isNullableString(value)) {
    throw new Error(`Invalid ticket scan response: ${String(key)} must be a string or null.`);
  }

  return value;
};

const parseFoodAndBeverageItem = (value: unknown): ScanTicketFoodAndBeverageItem => {
  if (!isRecord(value)) {
    throw new Error('Invalid ticket scan response: F&B item must be an object.');
  }

  if (!isNumber(value.quantity)) {
    throw new Error('Invalid ticket scan response: F&B item quantity is required.');
  }

  if (!isNumber(value.unitPrice) || !isNumber(value.subtotal)) {
    throw new Error('Invalid ticket scan response: F&B item prices are required.');
  }

  const fbItemId = value.fbItemId;
  const itemName = value.itemName;
  if (!isString(fbItemId) || !isString(itemName)) {
    throw new Error('Invalid ticket scan response: F&B item id/name is required.');
  }

  return {
    fbItemId,
    itemName,
    quantity: value.quantity,
    unitPrice: value.unitPrice,
    subtotal: value.subtotal,
  };
};

export const parseScanTicketResponse = (value: unknown): ScanTicketResponse => {
  if (!isRecord(value)) {
    throw new Error('Invalid ticket scan response: payload must be an object.');
  }

  if (!Array.isArray(value.seatCodes) || !value.seatCodes.every(isString)) {
    throw new Error('Invalid ticket scan response: seatCodes must be a string array.');
  }

  if (!Array.isArray(value.foodAndBeverageItems)) {
    throw new Error('Invalid ticket scan response: foodAndBeverageItems must be an array.');
  }

  return {
    ticketId: requireString(value, 'ticketId'),
    ticketStatus: requireString(value, 'ticketStatus'),
    checkInLogId: optionalString(value, 'checkInLogId'),
    scanTime: optionalString(value, 'scanTime'),
    bookingId: requireString(value, 'bookingId'),
    bookingCode: requireString(value, 'bookingCode'),
    customerName: optionalString(value, 'customerName'),
    customerPhone: optionalString(value, 'customerPhone'),
    cinemaId: requireString(value, 'cinemaId'),
    cinemaName: requireString(value, 'cinemaName'),
    roomId: requireString(value, 'roomId'),
    roomName: requireString(value, 'roomName'),
    showtimeId: requireString(value, 'showtimeId'),
    showtimeStartTime: requireString(value, 'showtimeStartTime'),
    showtimeEndTime: requireString(value, 'showtimeEndTime'),
    movieTitle: requireString(value, 'movieTitle'),
    seatCode: requireString(value, 'seatCode'),
    seatCodes: value.seatCodes,
    foodAndBeverageItems: value.foodAndBeverageItems.map(parseFoodAndBeverageItem),
  };
};
