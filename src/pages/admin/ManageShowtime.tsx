import React, { useState, useRef } from "react";
import { toast } from "react-toastify";

// =================================================================
// 💡 CẤU HÌNH TIMELINE CHUẨN: 8H ĐẾN 24H (16 TIẾNG)
// =================================================================
const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 24;
const TOTAL_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR; // 16 tiếng
const HOUR_WIDTH = 120; // 1 tiếng cố định đúng 120px
const MINUTE_WIDTH = HOUR_WIDTH / 60; // ~2px cho mỗi phút

const MOCK_ROOMS = [
  { id: "room-1", name: "Phòng 1 (IMAX)" },
  { id: "room-2", name: "Phòng 2 (2D)" },
  { id: "room-3", name: "Phòng 3 (3D)" },
  { id: "room-4", name: "Phòng 4 (Sweetbox)" },
];

const MOCK_UNSCHEDULED_MOVIES = [
  { movieId: 'movie-1', movieNameVn: 'Lật Mặt 7: Một Điều Ước', movieNameEng: 'Face Off 7', duration: 138, ageRating: 'P', color: '#4318FF' },
  { movieId: 'movie-2', movieNameVn: 'Doraemon: Bản Tình Ca', movieNameEng: 'Doraemon Nobita', duration: 115, ageRating: 'P', color: '#00C2FF' },
  { movieId: 'movie-3', movieNameVn: 'Mai', movieNameEng: 'Mai A Film by Tran Thanh', duration: 131, ageRating: 'T18', color: '#FF007A' },
];

// Sinh danh sách mốc giờ hiển thị từ 08:00 đến 24:00
const TIME_SLOTS: string[] = [];
for (let i = TIMELINE_START_HOUR; i <= TIMELINE_END_HOUR; i++) {
  TIME_SLOTS.push(`${i.toString().padStart(2, '0')}:00`);
}

export default function ManageShowtime() {
  const [selectedCinema, setSelectedCinema] = useState("rap-1");
  const [selectedMonth, setSelectedMonth] = useState("06");
  const [selectedDay, setSelectedDay] = useState("01");

  const [unscheduledMovies, setUnscheduledMovies] = useState(MOCK_UNSCHEDULED_MOVIES);

  const [schedule, setSchedule] = useState<any>({
    "room-1": [
      {
        id: "fixed-1",
        movieId: "movie-fixed",
        movieNameVn: "Làng Trúng Tạng",
        startMinutesFrom8AM: 30,
        duration: 135,
        color: "#7000FF",
        startTime: "2026-06-01T08:30:00Z", 
        endTime: "2026-06-01T10:45:00Z"
      },
    ],
    "room-2": [], "room-3": [], "room-4": [],
  });

  const [draggingMovie, setDraggingMovie] = useState<any>(null);
  const isToastActive = useRef(false);

  const formatMinutesToISODateTime = (minutesFrom8AM: number) => {
    const totalMinutes = TIMELINE_START_HOUR * 60 + minutesFrom8AM;
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.floor(totalMinutes % 60);
    return `2026-${selectedMonth.padStart(2, '0')}-${selectedDay.padStart(2, '0')}T${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00Z`;
  };

  const getShortTimeFromISO = (isoString: string) => {
    if (!isoString || !isoString.includes("T")) return "";
    return isoString.split("T")[1].substring(0, 5);
  };

  const handleDragStartFromSidebar = (e: React.DragEvent, movie: any) => {
    isToastActive.current = false;
    setDraggingMovie({ ...movie, isNew: true });
  };

  const handleDragStartFromTimeline = (e: React.DragEvent, roomShowtime: any, roomId: string) => {
    isToastActive.current = false;
    setDraggingMovie({ ...roomShowtime, isNew: false, originalRoomId: roomId });
  };

  // --- HÀM THẢ CHUỘT CHUẨN HÓA KHÔNG LỆCH, KHÔNG ĐƠ ---
  const handleDropOnRow = (e: React.MouseEvent, roomId: string) => {
    e.preventDefault();
    if (!draggingMovie) return;

    const rowElement = e.currentTarget as HTMLElement;
    const rect = rowElement.getBoundingClientRect();
    
    // Lấy độ trượt ngang chính xác từ thẻ chứa scroll lớn
    const scrollContainer = document.getElementById("timeline-scroll-wrapper");
    const currentScrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;

    // Tính tọa độ vị trí thả chuột chuẩn xác 100%
    const relativeX = (e.clientX - rect.left) + currentScrollLeft;
    let rawStartMinutes = Math.round(relativeX / MINUTE_WIDTH);
    
    const SNAP_INTERVAL = 15; 
    let startMinutes = Math.round(rawStartMinutes / SNAP_INTERVAL) * SNAP_INTERVAL;

    if (startMinutes < 0) startMinutes = 0;

    const maxMinutes = TOTAL_HOURS * 60 - draggingMovie.duration; 
    if (startMinutes > maxMinutes) {
      startMinutes = Math.floor(maxMinutes / SNAP_INTERVAL) * SNAP_INTERVAL;
    }

    const durationMinutes = draggingMovie.duration;
    const endMinutes = startMinutes + durationMinutes;

    // THUẬT TOÁN CHECK ĐÈ LỊCH + BUFFER 15 PHÚT
    const CLEAN_UP_BUFFER = 15; 
    const existingSlotsInRoom = (schedule[roomId] || []).filter(
      (slot: any) => slot.id !== draggingMovie.id
    );

    for (const slot of existingSlotsInRoom) {
      const slotStart = slot.startMinutesFrom8AM;
      const slotEnd = slotStart + slot.duration;

      const isOverlapping = 
        startMinutes < (slotEnd + CLEAN_UP_BUFFER) && 
        endMinutes + CLEAN_UP_BUFFER > slotStart;

      if (isOverlapping) {
        if (!isToastActive.current) {
          const slotStartShort = getShortTimeFromISO(slot.startTime);
          const slotEndShort = getShortTimeFromISO(slot.endTime);
          toast.error(
            `❌ Đè lịch chiếu! Va chạm với phim "${slot.movieNameVn}" (${slotStartShort} - ${slotEndShort}). Vui lòng cách ra 15 phút dọn phòng.`
          );
          isToastActive.current = true;
        }
        setDraggingMovie(null);
        return; 
      }
    }

    const startTimeISO = formatMinutesToISODateTime(startMinutes);
    const endTimeISO = formatMinutesToISODateTime(endMinutes);

    if (draggingMovie.isNew) {
      const newShowtimeSlot = {
        id: `slot-${Date.now()}`,
        movieId: draggingMovie.movieId, 
        roomId: roomId,            
        movieNameVn: draggingMovie.movieNameVn, 
        startMinutesFrom8AM: startMinutes, 
        duration: durationMinutes, 
        startTime: startTimeISO,   
        endTime: endTimeISO,       
        color: draggingMovie.color,
      };
      setSchedule({ ...schedule, [roomId]: [...schedule[roomId], newShowtimeSlot] });
    } else {
      const cleanSchedule = { ...schedule };
      cleanSchedule[draggingMovie.originalRoomId] = cleanSchedule[draggingMovie.originalRoomId].filter(
        (item: any) => item.id !== draggingMovie.id
      );
      cleanSchedule[roomId] = cleanSchedule[roomId].filter(
        (item: any) => item.id !== draggingMovie.id
      );

      const movedSlot = {
        ...draggingMovie,
        startMinutesFrom8AM: startMinutes, 
        startTime: startTimeISO,
        endTime: endTimeISO,
      };

      cleanSchedule[roomId] = [...cleanSchedule[roomId], movedSlot];
      setSchedule(cleanSchedule);
    }
    setDraggingMovie(null);
  };

  const handleDeleteShowtime = (roomId: string, slotId: string) => {
    const isConfirm = window.confirm("⚠️ Bạn có muốn gỡ suất chiếu này ra khỏi lịch không?");
    if (isConfirm) {
      setSchedule({
        ...schedule,
        [roomId]: schedule[roomId].filter((item: any) => item.id !== slotId),
      });
    }
  };

  return (
    <div className="p-6 bg-[#0A0A0C] min-h-screen text-white font-['Urbanist'] select-none">
      {/* TIÊU ĐỀ */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wider">Quản Lý Lịch Chiếu</h1>
        <p className="text-xs text-gray-400 mt-1">Nắm kéo phim thả vào khung giờ để sắp xếp lịch chiếu trực quan</p>
      </div>

      {/* BỘ LỌC NGÀY THÁNG */}
      <div className="flex gap-4 mb-6 bg-[#111C44] p-4 rounded-xl border border-gray-800 shadow-xl">
        <select value={selectedCinema} onChange={(e) => setSelectedCinema(e.target.value)} className="bg-[#0F172A] border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          <option value="rap-1">Chọn rạp (Rạp 1)</option>
          <option value="rap-2">Rạp 2</option>
        </select>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-[#0F172A] border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          <option value="06">Tháng 06 / 2026</option>
          <option value="07">Tháng 07 / 2026</option>
        </select>
        <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="bg-[#0F172A] border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          <option value="01">Ngày 01</option>
          <option value="02">Ngày 02</option>
        </select>
      </div>

      {/* LAYOUT GRID CHÍNH */}
      <div className="grid grid-cols-4 gap-6 items-start">
        
        {/* VÙNG CHỨA TIMELINE LỚN BÊN TRÁI */}
        <div id="timeline-scroll-wrapper" className="col-span-3 bg-[#111C44] border border-gray-800 rounded-2xl shadow-2xl overflow-x-auto class-scroll-custom max-w-full">
          <div style={{ width: `${192 + TOTAL_HOURS * HOUR_WIDTH}px` }} className="flex flex-col">
            
            {/* 1️⃣ TRỤC THỜI GIAN (HEADER) - ĐÃ FIX SẠCH PADDING LỆCH CHUỘT */}
            <div className="flex border-b border-gray-800 bg-blue-950/20 text-xs text-gray-400 font-bold uppercase h-12 items-center">
              <div className="w-48 h-full flex items-center justify-center border-r border-gray-800 bg-[#111C44] sticky left-0 z-40 shrink-0 text-white">
                Phòng / Giờ
              </div>
              
              {/* Căn lề trái tuyệt đối, chữ số giờ đứng ngay trên vạch đứng dọc */}
              <div className="flex-1 flex h-full items-center relative">
                {TIME_SLOTS.map((time, idx) => (
                  <div 
                    key={time} 
                    className="absolute text-gray-400 text-[11px] font-bold" 
                    style={{ 
                      left: `${idx * HOUR_WIDTH}px`, 
                      width: `${HOUR_WIDTH}px`,
                      transform: "translateX(-50%)", // Căn chữ nằm chính giữa vạch dọc dứt điểm lỗi lệch
                      textAlign: "center"
                    }}
                  >
                    {time}
                  </div>
                ))}
              </div>
            </div>

            {/* 2️⃣ THÂN LƯỚI CÁC PHÒNG CHIẾU */}
            <div className="divide-y divide-gray-800/60">
              {MOCK_ROOMS.map((room) => (
                <div key={room.id} className="flex min-h-[95px] items-center relative">
                  
                  {/* Cột tên phòng ghim cứng lề trái */}
                  <div className="w-48 h-[95px] border-r border-gray-800 font-semibold text-gray-200 text-center text-sm bg-[#111C44] sticky left-0 z-30 shrink-0 shadow-md flex items-center justify-center">
                    {room.name}
                  </div>

                  {/* Vùng nhận Drop và vẽ phim (Khít khịt hệ tọa độ 0-24h tràn viền) */}
                  <div 
                    className="flex-1 h-[95px] relative bg-[#0d1637]/30 flex shrink-0 cursor-crosshair"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnRow(e, room.id)}
                  >
                    
                    {/* Vạch kẻ dọc chia khung giờ mờ làm nền */}
                    {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                      <div 
                        key={i} 
                        className="absolute top-0 bottom-0 border-l border-gray-800/25 pointer-events-none" 
                        style={{ left: `${i * HOUR_WIDTH}px` }} 
                      />
                    ))}

                    {/* VÙNG KHÔNG GIAN TUYỆT ĐỐI CHỨA CÁC THẺ PHIM ĐÈ LÊN LỚP NỀN */}
                    <div className="absolute inset-0 pointer-events-none">
                      {schedule[room.id]?.map((slot: any) => {
                        const widthPx = slot.duration * MINUTE_WIDTH;
                        const leftPx = slot.startMinutesFrom8AM * MINUTE_WIDTH;
                        
                        const startShort = getShortTimeFromISO(slot.startTime);
                        const endShort = getShortTimeFromISO(slot.endTime);
                        const isCurrentDragging = draggingMovie?.id === slot.id;

                        return (
                          <div
                            key={slot.id}
                            draggable
                            onDragStart={(e) => handleDragStartFromTimeline(e, slot, room.id)}
                            className={`absolute top-3 bottom-3 rounded-xl shadow-xl border border-white/10 px-3 py-2 cursor-grab active:cursor-grabbing flex flex-col justify-between overflow-hidden transition-all hover:brightness-110 hover:scale-[1.01] hover:shadow-2xl hover:z-50 pointer-events-auto ${isCurrentDragging ? 'opacity-40 z-50' : 'z-20'}`}
                            style={{ left: `${leftPx}px`, width: `${widthPx}px`, backgroundColor: slot.color }}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <div className="text-xs font-bold truncate text-white max-w-[82%]">
                                {slot.movieNameVn}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteShowtime(room.id, slot.id); }}
                                className="text-white/60 hover:text-white bg-black/40 hover:bg-red-600 w-4 h-4 rounded-full flex items-center justify-center text-[10px] transition-all shrink-0 z-50 shadow-md"
                              >
                                &times;
                              </button>
                            </div>
                            <div className="text-[9px] text-white/90 font-medium tracking-wide">
                              {startShort && endShort ? `🕒 ${startShort} - ${endShort}` : "N/A"}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* DANH SÁCH PHIM CHỜ BÊN PHẢI */}
        <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-4 shadow-2xl flex flex-col max-h-[480px]">
          <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4 border-b border-gray-800 pb-3">
            🎬 Danh Sách Phim Chờ
          </h3>
          <div className="space-y-3 overflow-y-auto pr-1">
            {unscheduledMovies.map((movie) => (
              <div key={movie.movieId} draggable onDragStart={(e) => handleDragStartFromSidebar(e, movie)} className="p-3.5 rounded-xl border border-gray-800 bg-[#0F172A] hover:border-gray-600 transition-all cursor-grab active:cursor-grabbing flex flex-col justify-between hover:translate-x-1">
                <div className="text-sm font-bold text-white">{movie.movieNameVn}</div>
                <div className="text-[10px] text-gray-400 mt-1 flex justify-between items-center">
                  <span>⏱️ {movie.duration} phút ({movie.ageRating})</span>
                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded text-white shadow-sm" style={{ backgroundColor: movie.color }}>Kéo Thả</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}