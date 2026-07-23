export type RecurrenceFrequency = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";

export type RecurrenceSourceShowtime = {
  sourceId: string;
  movieId: string;
  roomId: string;
  startMinutesFrom8AM: number;
  duration: number;
  basePrice: number;
  status?: string;
};

export type RecurringShowtimeDraft = {
  sourceId: string;
  movieId: string;
  roomId: string;
  startDate: string;
  startTime: string;
  basePrice: number;
  status: string;
};

export type RecurrenceBuildInput = {
  sources: RecurrenceSourceShowtime[];
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate: string;
  timelineStartHour?: number;
};

const parseDateKey = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (dateKey: string, days: number): string => {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
};

const addMonthsClamped = (dateKey: string, monthsToAdd: number): string => {
  const sourceDate = parseDateKey(dateKey);
  const targetMonthIndex = sourceDate.getMonth() + monthsToAdd;
  const targetYear = sourceDate.getFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const day = Math.min(sourceDate.getDate(), lastDayOfTargetMonth);

  return formatDateKey(new Date(targetYear, normalizedMonth, day));
};

export const getRecurringDateKeys = (
  startDate: string,
  endDate: string,
  frequency: RecurrenceFrequency,
): string[] => {
  if (frequency === "NONE") {
    return [];
  }

  if (!startDate || !endDate || endDate < startDate) {
    return [];
  }

  const dates: string[] = [];
  let cursor =
    frequency === "DAILY"
      ? addDays(startDate, 1)
      : frequency === "WEEKLY"
        ? addDays(startDate, 7)
        : addMonthsClamped(startDate, 1);

  while (cursor <= endDate) {
    dates.push(cursor);
    cursor =
      frequency === "DAILY"
        ? addDays(cursor, 1)
        : frequency === "WEEKLY"
          ? addDays(cursor, 7)
          : addMonthsClamped(cursor, 1);
  }

  return dates;
};

export const buildShowtimeDateTime = (
  dateKey: string,
  startMinutesFrom8AM: number,
  timelineStartHour = 8,
): string => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const totalMinutes = timelineStartHour * 60 + startMinutesFrom8AM;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0)).toISOString();
};

export const buildRecurringShowtimeDrafts = ({
  sources,
  frequency,
  startDate,
  endDate,
  timelineStartHour = 8,
}: RecurrenceBuildInput): RecurringShowtimeDraft[] => {
  const recurringDateKeys = getRecurringDateKeys(startDate, endDate, frequency);

  return sources.flatMap((source) =>
    recurringDateKeys.map((dateKey) => ({
      sourceId: source.sourceId,
      movieId: source.movieId,
      roomId: source.roomId,
      startDate: dateKey,
      startTime: buildShowtimeDateTime(dateKey, source.startMinutesFrom8AM, timelineStartHour),
      basePrice: source.basePrice,
      status: source.status || "OPEN",
    })),
  );
};
