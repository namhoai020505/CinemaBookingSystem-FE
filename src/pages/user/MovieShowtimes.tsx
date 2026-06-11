import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import api from "../../lib/api"; // Axios instance bóc vỏ tự động của team

// Hàm sinh nhanh 5 ngày tiếp theo tính từ ngày hiện tại để làm bộ lọc lịch ngày
const generateDaysFilter = () => {
  const days = [];
  const weekdays = [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ];

  // 💡 Đồng bộ mốc ngày xuất phát từ đúng ngày có dữ liệu trong SQL Server (05/06/2026)
  const baseDate = new Date("2026-06-05T00:00:00");

  for (let i = 0; i < 5; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const date = String(d.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${date}`;

    days.push({
      label: i === 0 ? "Hôm nay" : weekdays[d.getDay()],
      dateDisplay: `${date}/${month}`,
      dateValue: dateStr,
    });
  }
  return days;
};

export default function MovieShowtimes() {
  const { movieId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const daysFilter = generateDaysFilter();

  // Đọc ngày đang chọn từ thanh URL, nếu trống mặc định lấy ngày hôm nay (2026-06-05)
  const currentSelectedDate =
    searchParams.get("date") || daysFilter[0].dateValue;

  // States quản lý dữ liệu đồng bộ từ Database
  const [movieInfo, setMovieInfo] = useState<any>(null);
  const [groupedCinemas, setGroupedCinemas] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // =================================================================
  // 🔄 GỌI API DATABASE: LOAD TOÀN BỘ SUẤT CHIẾU VÀ PHÂN NHÓM ĐỘNG
  // =================================================================
  useEffect(() => {
    const fetchAndGroupShowtimes = async () => {
      try {
        setLoading(true);

        // Gọi API lấy danh sách toàn bộ suất chiếu của Backend .NET
        const res: any = await api.get("/api/showtimes");

        if (res && res.success && res.data) {
          const allShowtimes = res.data;

          // 🌟 1. SỬA LỖI ÉP KIỂU: Chuyển st.movieId về chuỗi để so sánh chuẩn với movieId trên URL
          const movieShowtimeSample = allShowtimes.find(
            (st: any) =>
              String(st.movieId || st.id || st.MovieId) === String(movieId),
          );

          if (movieShowtimeSample) {
            setMovieInfo({
              movieId: movieId,
              // Map động linh hoạt theo tên trường của Backend (.NET hay trả về viết hoa hoặc Object lồng)
              title:
                movieShowtimeSample.movieTitle ||
                movieShowtimeSample.movieName ||
                movieShowtimeSample.title ||
                "Phim Hệ Thống",
              durationMinutes:
                movieShowtimeSample.durationMinutes ||
                movieShowtimeSample.duration ||
                120,
              ageRating: movieShowtimeSample.ageRating || "P",
              genre: movieShowtimeSample.genre || "Hành động, Viễn tưởng",
              posterUrl:
                movieShowtimeSample.posterUrl ||
                "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500",
            });
          } else {
            // 🌟 2. CƠ CHẾ DỰ PHÒNG CHUYÊN NGHIỆP:
            // Nếu phim chưa có lịch chiếu nào, gọi API lấy chi tiết phim của Nam để hiển thị giao diện trống lịch
            try {
              const movieDetailRes: any = await api.get(
                `/api/movies/${movieId}`,
              );
              if (
                movieDetailRes &&
                movieDetailRes.success &&
                movieDetailRes.data
              ) {
                const m = movieDetailRes.data;
                setMovieInfo({
                  movieId: m.movieId || m.id,
                  title: m.title || m.movieName,
                  durationMinutes: m.durationMinutes || m.duration,
                  ageRating: m.ageRating,
                  genre: m.genre,
                  posterUrl: m.posterUrl,
                });
              } else {
                setMovieInfo({ title: "Không tìm thấy thông tin phim này" });
              }
            } catch (movieErr) {
              setMovieInfo({ title: "Lỗi kết nối API thông tin phim" });
            }
          }

          // Bước 2: Lọc suất chiếu khớp đúng ngày người dùng đang chọn (Bổ sung ép kiểu String)
          const filteredShowtimes = allShowtimes.filter((st: any) => {
            const showtimeDate = st.startTime ? st.startTime.split("T")[0] : "";
            return (
              String(st.movieId || st.MovieId) === String(movieId) &&
              showtimeDate === currentSelectedDate
            );
          });

          // =================================================================
          // 🔄 KHỐI GOM CỤM RẠP (Giữ nguyên logic bên dưới của bạn nhưng thêm ép kiểu)
          // =================================================================
          const cinemaMap: Record<string, any> = {};

          filteredShowtimes.forEach((st: any) => {
            const cId = st.cinemaId || "CIN_001";
            const cName = st.cinemaName || "G2Cinema Thái Nguyên";
            const cCity = st.city || "Thái Nguyên";
            const rName =
              st.roomName ||
              (st.roomId === "RM01"
                ? "Phòng 1 (IMAX)"
                : `Phòng ${st.roomId || ""}`);

            if (!cinemaMap[cId]) {
              cinemaMap[cId] = {
                cinemaId: cId,
                cinemaName: cName,
                city: cCity,
                rooms: {},
              };
            }

            if (!cinemaMap[cId].rooms[rName]) {
              cinemaMap[cId].rooms[rName] = {
                roomName: rName,
                slots: [],
              };
            }

            cinemaMap[cId].rooms[rName].slots.push({
              showtimeId: st.showtimeId,
              roomId: st.roomId,
              startTime: st.startTime,
              endTime: st.endTime,
              basePrice: st.basePrice || 80000,
              availableSeatCount: st.showtimeSeatCount ?? 120,
            });
          });

          const finalCinemaList = Object.values(cinemaMap).map(
            (cinema: any) => ({
              cinemaId: cinema.cinemaId,
              cinemaName: cinema.cinemaName,
              city: cinema.city,
              roomGroups: Object.values(cinema.rooms),
            }),
          );

          setGroupedCinemas(finalCinemaList);
        }
      } catch (err) {
        console.error("Lỗi tải thông tin lịch chiếu từ Database:", err);
      } finally {
        setLoading(false);
      }
    };

    if (movieId) {
      fetchAndGroupShowtimes();
    }
  }, [movieId, currentSelectedDate]);

  // Trích xuất lấy giờ HH:mm ngắn gọn từ chuỗi ISO 8601 múi giờ hệ thống
  const formatISOToShortTime = (isoString: string) => {
    if (!isoString || !isoString.includes("T")) return "";
    const timePart = isoString.split("T")[1];
    return timePart.substring(0, 5);
  };

  const handleDateChange = (dateValue: string) => {
    setSearchParams({ date: dateValue });
  };

  const handleSelectShowtime = (showtimeId: string) => {
    // Kích hoạt tuyến đường chuyển trang mượt mà sang trang ma trận lưới ghế thực tế
    navigate(`/booking/seats/${showtimeId}`);
  };

  if (loading) {
    return (
      <div className="bg-[#0A0A0C] min-h-screen text-white flex items-center justify-center font-bold">
        <p className="animate-pulse text-sm text-blue-400 font-mono">
          Đang truy vấn lịch chiếu thời gian thực từ Database...
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#0A0A0C] min-h-screen text-white font-['Urbanist'] select-none">
      <div className="max-w-5xl mx-auto">
        {/* KHỐI THÔNG TIN PHIM CHUẨN ĐỒNG BỘ */}
        {movieInfo && (
          <div className="bg-[#111C44] border border-gray-800 rounded-3xl p-6 shadow-2xl flex gap-6 items-center mb-8">
            <div className="w-24 h-36 bg-slate-900 rounded-xl overflow-hidden shrink-0 shadow-md">
              <img
                src={movieInfo.posterUrl}
                alt={movieInfo.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-0.5 text-[10px] font-black rounded bg-amber-500 text-black uppercase">
                  {movieInfo.ageRating}
                </span>
                <h1 className="text-2xl font-black tracking-wide">
                  {movieInfo.title}
                </h1>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                🎬 Thể loại: {movieInfo.genre} | ⏱️ Thời lượng:{" "}
                {movieInfo.durationMinutes} phút
              </p>
              <p className="text-xs text-gray-500 mt-4 italic">
                * Lưu ý: Vui lòng mua vé đúng độ tuổi quy định của bộ phim.
              </p>
            </div>
          </div>
        )}

        {/* BỘ LỌC CHỌN NGÀY XEM CHIẾU PHIM ĐỘNG (5 NGÀY THỰC TẾ) */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">
            Chọn ngày xem
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-1 class-scroll-custom">
            {daysFilter.map((day) => {
              const isSelected = day.dateValue === currentSelectedDate;
              return (
                <button
                  key={day.dateValue}
                  onClick={() => handleDateChange(day.dateValue)}
                  className={`flex flex-col items-center p-3 rounded-xl border min-w-[90px] transition-all cursor-pointer ${
                    isSelected
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 border-indigo-500 text-white shadow-lg"
                      : "bg-[#111C44] border-gray-800 text-gray-400 hover:text-white hover:border-gray-700"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                    {day.label}
                  </span>
                  <span className="text-lg font-black mt-0.5">
                    {day.dateDisplay}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* DANH SÁCH CỤM RẠP VÀ SUẤT CHIẾU SAU KHI PHÂN NHÓM */}
        <div className="space-y-6">
          <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">
            Danh sách suất chiếu tại rạp
          </h3>

          {groupedCinemas.length === 0 ? (
            <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-10 text-center text-gray-500 text-sm italic">
              🍿 Hiện tại không tìm thấy suất chiếu nào khả dụng cho phim trong
              ngày hôm nay. Vui lòng chọn ngày tiếp theo!
            </div>
          ) : (
            groupedCinemas.map((cinema) => (
              <div
                key={cinema.cinemaId}
                className="bg-[#111C44] border border-gray-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4"
              >
                {/* Tên cụm rạp */}
                <div className="border-b border-gray-800/80 pb-3 flex justify-between items-center">
                  <h4 className="text-base font-extrabold text-blue-400 tracking-wide">
                    📍 {cinema.cinemaName}
                  </h4>
                  <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                    {cinema.city}
                  </span>
                </div>

                {/* Danh sách phòng đã gom cụm */}
                <div className="space-y-4">
                  {cinema.roomGroups.map((group: any) => (
                    <div
                      key={group.roomName}
                      className="flex flex-col sm:flex-row gap-2 sm:gap-6 items-start bg-[#0D1637]/40 p-4 rounded-xl border border-gray-800/40"
                    >
                      {/* Tên phòng chiếu gốc từ DB */}
                      <div className="text-xs font-black text-gray-400 uppercase tracking-wider w-32 pt-2 shrink-0">
                        🖥️ {group.roomName}
                      </div>

                      {/* Các nút khung giờ suất chiếu */}
                      <div className="flex flex-wrap gap-3">
                        {group.slots
                          .sort((a: any, b: any) =>
                            a.startTime.localeCompare(b.startTime),
                          )
                          .map((slot: any) => {
                            const shortTime = formatISOToShortTime(
                              slot.startTime,
                            );
                            return (
                              <button
                                key={slot.showtimeId}
                                onClick={() =>
                                  handleSelectShowtime(slot.showtimeId)
                                }
                                className="group px-4 py-2.5 bg-[#0F172A] border border-gray-800 hover:border-blue-500 rounded-xl text-center transition-all hover:scale-[1.03] cursor-pointer"
                                title={`Giá vé cơ bản: ${slot.basePrice.toLocaleString()}đ`}
                              >
                                <div className="text-sm font-black text-white group-hover:text-blue-400 transition-colors">
                                  {shortTime}
                                </div>
                                <div className="text-[9px] text-gray-500 mt-0.5 font-medium">
                                  {slot.availableSeatCount} ghế trống
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
