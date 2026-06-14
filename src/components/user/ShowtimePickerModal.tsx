import { useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T | null;
};

export type ShowtimePickerMovie = {
  movieId: string;
  title: string;
  genre?: string;
  duration?: string;
  posterUrl?: string;
  ageRating?: string;
};

type ShowtimeResponse = {
  showtimeId: string;
  movieId: string;
  movieTitle: string;
  roomId: string;
  roomName: string;
  cinemaId: string;
  cinemaName: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  status: string;
  showtimeSeatCount: number;
};

type SeatMapResponse = {
  showtimeId: string;
  availableSeats?: unknown[];
  lockedSeats?: unknown[];
  soldSeats?: unknown[];
};

type SeatAvailability = {
  available: number;
  total: number;
};

type ShowtimeSlot = ShowtimeResponse & {
  seatAvailability?: SeatAvailability;
};

type RoomGroup = {
  roomId: string;
  roomName: string;
  slots: ShowtimeSlot[];
};

type CinemaGroup = {
  cinemaId: string;
  cinemaName: string;
  city: string;
  roomGroups: RoomGroup[];
};

type DayTab = {
  label: string;
  dateDisplay: string;
  dateValue: string;
};

type Props = {
  movie: ShowtimePickerMovie;
  onClose: () => void;
};

const weekdays = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

const getDateKey = (value: string) => value.split("T")[0] || "";

const getTodayKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
};

const buildDayTab = (dateValue: string): DayTab => {
  const [, month, date] = dateValue.split("-");
  const dateObject = new Date(`${dateValue}T00:00:00`);
  const label =
    dateValue === getTodayKey()
      ? "Hôm nay"
      : weekdays[Number.isNaN(dateObject.getTime()) ? 0 : dateObject.getDay()];

  return {
    label,
    dateDisplay: `${date}/${month}`,
    dateValue,
  };
};

const formatDate = (dateValue: string) => {
  if (!dateValue) {
    return "";
  }

  const [year, month, date] = dateValue.split("-");
  return `${date}/${month}/${year}`;
};

const formatISOToShortTime = (value: string) => {
  if (!value) {
    return "";
  }

  const timePart = value.includes("T")
    ? value.split("T")[1]
    : value.split(" ")[1];

  return timePart?.substring(0, 5) || "";
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value);

const getAvailability = (seatMap: SeatMapResponse): SeatAvailability => {
  const available = seatMap.availableSeats?.length ?? 0;
  const locked = seatMap.lockedSeats?.length ?? 0;
  const sold = seatMap.soldSeats?.length ?? 0;

  return {
    available,
    total: available + locked + sold,
  };
};

const groupShowtimesByCinema = (
  showtimes: ShowtimeSlot[],
  selectedDate: string,
): CinemaGroup[] => {
  const cinemaMap = new Map<string, CinemaGroup & { roomMap: Map<string, RoomGroup> }>();

  showtimes
    .filter((showtime) => getDateKey(showtime.startTime) === selectedDate)
    .filter((showtime) => showtime.status?.toUpperCase() === "OPEN")
    .forEach((showtime) => {
      const cinemaId = showtime.cinemaId || "CINEMA_DEFAULT";
      const roomId = showtime.roomId || showtime.roomName || "ROOM_DEFAULT";

      if (!cinemaMap.has(cinemaId)) {
        cinemaMap.set(cinemaId, {
          cinemaId,
          cinemaName: showtime.cinemaName || "G2Cinema",
          city: "Thái Nguyên",
          roomGroups: [],
          roomMap: new Map<string, RoomGroup>(),
        });
      }

      const cinema = cinemaMap.get(cinemaId);
      if (!cinema) {
        return;
      }

      if (!cinema.roomMap.has(roomId)) {
        const roomGroup = {
          roomId,
          roomName: showtime.roomName || `Phòng ${roomId}`,
          slots: [],
        };
        cinema.roomMap.set(roomId, roomGroup);
        cinema.roomGroups.push(roomGroup);
      }

      cinema.roomMap.get(roomId)?.slots.push(showtime);
    });

  return Array.from(cinemaMap.values()).map((cinema) => ({
    cinemaId: cinema.cinemaId,
    cinemaName: cinema.cinemaName,
    city: cinema.city,
    roomGroups: cinema.roomGroups.map((room) => ({
      ...room,
      slots: [...room.slots].sort((left, right) =>
        left.startTime.localeCompare(right.startTime),
      ),
    })),
  }));
};

export default function ShowtimePickerModal({ movie, onClose }: Props) {
  const navigate = useNavigate();
  const [showtimes, setShowtimes] = useState<ShowtimeSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<ShowtimeSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedSlot) {
          setSelectedSlot(null);
          return;
        }

        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, selectedSlot]);

  useEffect(() => {
    let isMounted = true;

    const fetchShowtimes = async () => {
      if (!movie.movieId) {
        setErrorMessage("Không tìm thấy mã phim.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");

        const showtimeResponse = (await api.get("/api/showtimes")) as unknown as ApiResponse<ShowtimeResponse[]>;

        if (!showtimeResponse.success || !Array.isArray(showtimeResponse.data)) {
          throw new Error(showtimeResponse.message || "Không tải được lịch chiếu.");
        }

        const movieShowtimes = showtimeResponse.data.filter(
          (showtime) => String(showtime.movieId) === String(movie.movieId),
        );

        const availabilityEntries = await Promise.all(
          movieShowtimes.map(async (showtime) => {
            try {
              const response = (await api.get(
                `/api/seats/showtimes/${showtime.showtimeId}/map`,
              )) as unknown as ApiResponse<SeatMapResponse>;

              return [
                showtime.showtimeId,
                response.success && response.data ? getAvailability(response.data) : null,
              ] as const;
            } catch (error) {
              console.warn("Không tải được sơ đồ ghế cho suất chiếu", showtime.showtimeId, error);
              return [showtime.showtimeId, null] as const;
            }
          }),
        );

        if (!isMounted) {
          return;
        }

        const availabilityMap = new Map(
          availabilityEntries.filter(
            (entry): entry is readonly [string, SeatAvailability] => entry[1] !== null,
          ),
        );
        const nextShowtimes = movieShowtimes.map((showtime) => ({
          ...showtime,
          seatAvailability: availabilityMap.get(showtime.showtimeId),
        }));

        setShowtimes(nextShowtimes);
        setSelectedDate(
          Array.from(new Set(nextShowtimes.map((showtime) => getDateKey(showtime.startTime)).filter(Boolean))).sort()[0] ||
            "",
        );
      } catch (error) {
        console.error("Lỗi tải lịch chiếu:", error);
        if (isMounted) {
          setShowtimes([]);
          setErrorMessage("Không tải được lịch chiếu từ hệ thống.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchShowtimes();

    return () => {
      isMounted = false;
    };
  }, [movie.movieId]);

  const daysFilter = useMemo(() => {
    const dateValues = Array.from(
      new Set(showtimes.map((showtime) => getDateKey(showtime.startTime)).filter(Boolean)),
    ).sort();

    return dateValues.map(buildDayTab);
  }, [showtimes]);

  const groupedCinemas = useMemo(
    () => groupShowtimesByCinema(showtimes, selectedDate),
    [selectedDate, showtimes],
  );

  const selectedSlotCinema =
    selectedSlot?.cinemaName || groupedCinemas[0]?.cinemaName || "G2Cinema";
  const selectedSlotDate = selectedSlot ? formatDate(getDateKey(selectedSlot.startTime)) : "";
  const selectedSlotTime = selectedSlot ? formatISOToShortTime(selectedSlot.startTime) : "";

  const handleConfirm = () => {
    if (!selectedSlot) {
      return;
    }

    navigate(`/booking/seats/${selectedSlot.showtimeId}`, {
      state: {
        movie: {
          movieId: movie.movieId,
          title: movie.title,
          genre: movie.genre,
          duration: movie.duration,
          posterUrl: movie.posterUrl,
          ageRating: movie.ageRating,
        },
        showtime: selectedSlot,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 px-3 py-6 backdrop-blur-sm sm:px-6">
      <div className="relative max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-white/10 bg-[#1C2A3D] p-5 text-white shadow-2xl sm:p-7">
        <button
          type="button"
          aria-label="Đóng lịch chiếu"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <FiX className="h-5 w-5" />
        </button>

        <h2 className="pr-10 text-base font-black uppercase tracking-wide">
          Lịch chiếu - {movie.title}
        </h2>

        <div className="mt-6 text-center">
          <h3 className="text-2xl font-black">{selectedSlotCinema}</h3>
        </div>

        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <p className="animate-pulse text-sm font-bold text-[#FFD166]">
              Đang tải lịch chiếu...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="mt-8 rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center text-sm font-bold text-red-100">
            {errorMessage}
          </div>
        ) : (
          <>
            <div className="mt-7 flex gap-8 overflow-x-auto border-b border-white/20 pb-3">
              {daysFilter.length === 0 ? (
                <p className="text-sm font-bold text-white/55">
                  Hiện phim này chưa có lịch chiếu khả dụng.
                </p>
              ) : (
                daysFilter.map((day) => {
                  const isSelected = day.dateValue === selectedDate;

                  return (
                    <button
                      type="button"
                      key={day.dateValue}
                      onClick={() => setSelectedDate(day.dateValue)}
                      className={`min-w-[92px] text-left transition ${
                        isSelected ? "text-[#FFD166]" : "text-white hover:text-[#FFD166]"
                      }`}
                    >
                      <span className="text-2xl font-black leading-none">
                        {day.dateDisplay.split("/")[0]}
                      </span>
                      <span className="ml-0.5 text-sm font-bold">
                        /{day.dateDisplay.split("/")[1]} - {day.label.slice(0, 2).toUpperCase()}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-5 space-y-7">
              {groupedCinemas.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-[#142039] p-8 text-center text-sm italic text-white/55">
                  Không tìm thấy suất chiếu khả dụng trong ngày đã chọn.
                </div>
              ) : (
                groupedCinemas.map((cinema) => (
                  <section key={cinema.cinemaId} className="space-y-4">
                    {groupedCinemas.length > 1 && (
                      <h4 className="text-center text-lg font-black text-[#FFD166]">
                        {cinema.cinemaName}
                      </h4>
                    )}

                    {cinema.roomGroups.map((room) => (
                      <div key={room.roomId} className="grid gap-4 sm:grid-cols-[130px_1fr]">
                        <div className="pt-2 text-sm font-black text-white">
                          2D Phụ đề
                        </div>

                        <div className="flex flex-wrap gap-5">
                          {room.slots.map((slot) => {
                            const availableSeats =
                              slot.seatAvailability?.available ?? slot.showtimeSeatCount;
                            const isSoldOut = availableSeats <= 0;

                            return (
                              <button
                                type="button"
                                key={slot.showtimeId}
                                onClick={() => setSelectedSlot(slot)}
                                disabled={isSoldOut}
                                className={`min-w-[82px] rounded-sm px-4 py-2 text-center transition ${
                                  isSoldOut
                                    ? "cursor-not-allowed bg-red-500 text-white opacity-70"
                                    : "bg-white text-[#1A2434] hover:-translate-y-0.5 hover:bg-[#FFD166]"
                                }`}
                                title={`Giá vé cơ bản: ${formatMoney(slot.basePrice)}đ`}
                              >
                                <span className="block text-sm font-black">
                                  {formatISOToShortTime(slot.startTime)}
                                </span>
                                <span className="mt-1 block text-[9px] font-semibold opacity-75">
                                  {availableSeats} ghế trống
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </section>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {selectedSlot && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-4xl rounded-md border border-white/10 bg-[#1C2A3D] p-6 text-white shadow-2xl sm:p-8">
            <h3 className="text-sm font-black uppercase tracking-wide">
              Bạn đang đặt vé xem phim
            </h3>
            <h4 className="mt-6 text-center text-2xl font-black text-[#FFD166]">
              {movie.title}
            </h4>

            <div className="mt-6 overflow-hidden border-t border-white/20">
              <div className="grid grid-cols-3 border-b border-white/20 py-3 text-center text-xs font-black">
                <span>Rạp chiếu</span>
                <span>Ngày chiếu</span>
                <span>Giờ chiếu</span>
              </div>
              <div className="grid grid-cols-3 py-4 text-center text-sm font-bold">
                <span>{selectedSlot.cinemaName || "G2Cinema"}</span>
                <span>{selectedSlotDate}</span>
                <span>{selectedSlotTime}</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="rounded-lg bg-slate-700 px-7 py-3 text-xs font-black uppercase text-white transition hover:bg-slate-600"
              >
                Chọn lại
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-lg bg-[#FFD166] px-7 py-3 text-xs font-black uppercase text-black transition hover:bg-[#FFE7A3]"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
