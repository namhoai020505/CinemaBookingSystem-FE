import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaBuilding, FaChair, FaDoorOpen, FaMapMarkerAlt, FaPhoneAlt } from 'react-icons/fa';
import type { ManagerOutletContext } from '../../layouts/manager/ManagerLayout';
import { managerService } from '../../services/managerService';
import type { CinemaResponse, RoomResponse } from '../../services/roomService';
import {
  formatNumber,
  getApiErrorMessage,
  PageShell,
  panelClass,
  StatePanel,
  StatusBadge,
} from './managerUi';

const MyCinemaPage = () => {
  const { isLightMode } = useOutletContext<ManagerOutletContext>();
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [cinemas, setCinemas] = useState<CinemaResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const [roomData, cinemaData] = await Promise.all([
          managerService.getRooms(),
          managerService.getCinemas(),
        ]);

        if (!isMounted) {
          return;
        }

        setRooms(roomData ?? []);
        setCinemas(cinemaData ?? []);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getApiErrorMessage(error, 'Không tải được thông tin rạp.'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const cinema = useMemo(() => {
    const firstRoom = rooms[0];
    if (!firstRoom) {
      return null;
    }

    return (
      cinemas.find((item) => item.cinemaId === firstRoom.cinemaId) ?? {
        cinemaId: firstRoom.cinemaId,
        cinemaName: firstRoom.cinemaName,
        address: '',
        city: '',
        cinemaStatus: 'ACTIVE',
      }
    );
  }, [cinemas, rooms]);

  const totalSeats = rooms.reduce((sum, room) => sum + (room.seatCount || room.capacity || 0), 0);
  const activeRooms = rooms.filter((room) => room.roomStatus?.toUpperCase() === 'ACTIVE').length;

  return (
    <PageShell
      eyebrow="Cinema scope"
      title="Rạp của tôi"
      description="Thông tin rạp và phòng chiếu backend đang trả về theo phạm vi tài khoản Manager. Các thao tác vận hành khác sẽ dựa trên phạm vi này."
      isLightMode={isLightMode}
      action={cinema ? <StatusBadge status={cinema.cinemaStatus} /> : undefined}
    >
      {loading ? (
        <StatePanel type="loading" title="Đang tải thông tin rạp" description="Đang lấy rạp và phòng chiếu thuộc phạm vi quản lý." isLightMode={isLightMode} />
      ) : errorMessage ? (
        <StatePanel type="error" title="Không tải được rạp" description={errorMessage} isLightMode={isLightMode} />
      ) : !cinema ? (
        <StatePanel
          title="Chưa có rạp được gắn với tài khoản"
          description="Backend chưa trả về phòng chiếu nào cho tài khoản này, nên FE chưa xác định được rạp của Manager."
          isLightMode={isLightMode}
        />
      ) : (
        <>
          <section className={`${panelClass(isLightMode)} overflow-hidden`}>
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div className="flex items-start gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 text-xl text-white">
                  <FaBuilding />
                </span>
                <div className="min-w-0">
                  <h2 className={`text-2xl font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                    {cinema.cinemaName}
                  </h2>
                  <div className={`mt-3 grid gap-2 text-sm font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    <p className="flex items-center gap-2">
                      <FaMapMarkerAlt className="text-emerald-500" />
                      {[cinema.address, cinema.city].filter(Boolean).join(', ') || 'Chưa có địa chỉ'}
                    </p>
                    <p className="flex items-center gap-2">
                      <FaPhoneAlt className="text-emerald-500" />
                      {cinema.phoneNumber || 'Chưa có số điện thoại'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Phòng', value: formatNumber(rooms.length), icon: <FaDoorOpen /> },
                  { label: 'Đang hoạt động', value: formatNumber(activeRooms), icon: <FaBuilding /> },
                  { label: 'Ghế', value: formatNumber(totalSeats), icon: <FaChair /> },
                ].map((item) => (
                  <article key={item.label} className={`rounded-lg border p-4 text-center ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'}`}>
                    <span className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                      {item.icon}
                    </span>
                    <p className={`mt-3 text-xl font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>{item.value}</p>
                    <p className={`mt-1 text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={panelClass(isLightMode)}>
            <div className={`border-b px-5 py-4 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
              <h2 className={`font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>Danh sách phòng chiếu</h2>
            </div>
            <div className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/10'}`}>
              {rooms.map((room) => (
                <article key={room.roomId} className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_150px_150px_130px] sm:items-center">
                  <div className="min-w-0">
                    <p className={`truncate font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>{room.roomName}</p>
                    <p className={`mt-1 text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{room.roomId}</p>
                  </div>
                  <span>{formatNumber(room.capacity)} sức chứa ghế</span>
                  <span>{formatNumber(room.seatCount)} ghế đã tạo</span>
                  <StatusBadge status={room.roomStatus} />
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </PageShell>
  );
};

export default MyCinemaPage;
