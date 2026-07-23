import type { CheckoutPayload } from './bookingService';

const STORAGE_VERSION = 1;

export type CheckoutAttempt = {
  version: number;
  idempotencyKey: string;
  request: CheckoutPayload;
  bookingId?: string;
  createdAt: string;
};

const getStorageKey = (showtimeId: string, userKey: string) =>
  `g2c-checkout-attempt:v${STORAGE_VERSION}:${userKey}:${showtimeId}`;

export const readCheckoutAttempt = (
  showtimeId: string,
  userKey: string,
): CheckoutAttempt | null => {
  try {
    const raw = localStorage.getItem(getStorageKey(showtimeId, userKey));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CheckoutAttempt;
    if (
      parsed.version !== STORAGE_VERSION
      || !parsed.idempotencyKey
      || !parsed.request
    ) {
      localStorage.removeItem(getStorageKey(showtimeId, userKey));
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(getStorageKey(showtimeId, userKey));
    return null;
  }
};

export const writeCheckoutAttempt = (
  showtimeId: string,
  userKey: string,
  attempt: CheckoutAttempt,
) => {
  localStorage.setItem(getStorageKey(showtimeId, userKey), JSON.stringify(attempt));
};

export const removeCheckoutAttempt = (showtimeId: string, userKey: string) => {
  localStorage.removeItem(getStorageKey(showtimeId, userKey));
};

export const isSameCheckoutRequest = (
  left: CheckoutPayload,
  right: CheckoutPayload,
) => {
  const normalize = (payload: CheckoutPayload) => JSON.stringify({
    showtimeId: String(payload.showtimeId),
    showtimeSeatIds: payload.showtimeSeatIds.map(String).toSorted(),
    voucherCode: payload.voucherCode?.trim() || undefined,
    compensationTicketCodes: payload.compensationTicketCodes?.map(String).toSorted() || undefined,
    foodItems: payload.foodItems
      ?.map((item) => ({ fbItemId: item.fbItemId, quantity: item.quantity }))
      .toSorted((a, b) => a.fbItemId.localeCompare(b.fbItemId)),
  });

  return normalize(left) === normalize(right);
};
