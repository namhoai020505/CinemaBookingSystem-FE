import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaBuilding, FaChair, FaDoorOpen, FaMapMarkerAlt, FaPhoneAlt, FaUserShield } from 'react-icons/fa';
import type { ManagerOutletContext } from '../../layouts/manager/ManagerLayout';
import { managerService } from '../../services/managerService';
import { notificationService } from '../../services/notificationService';
import type { CinemaResponse, RoomResponse } from '../../services/roomService';
import { isUserOnline } from '../../lib/sessionHeartbeat';
import {
  formatNumber,
  getApiErrorMessage,
  PageShell,
  panelClass,
  StatePanel,
  StatusBadge,
} from './managerUi';

type StaffUser = {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  isOnline?: boolean;
};

const MyCinemaPage = () => {
  const { isLightMode } = useOutletContext<ManagerOutletContext>();
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [cinemas, setCinemas] = useState<CinemaResponse[]>([]);
  const [staffs, setStaffs] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const [roomData, cinemaData, staffRes] = await Promise.all([
          managerService.getRooms(),
          managerService.getCinemas(),
          notificationService.getFilteredUsers({ targetGroup: 'STAFF' }),
        ]);

        if (!isMounted) {
          return;
        }

        setRooms(roomData ?? []);
        setCinemas(cinemaData ?? []);

        const rawStaffData = (staffRes as { data?: StaffUser[] })?.data ?? (Array.isArray(staffRes) ? staffRes : []);
        setStaffs(Array.isArray(rawStaffData) ? rawStaffData : []);
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

    // Live status polling every 3 seconds
    const statusInterval = setInterval(() => {
      notificationService
        .getFilteredUsers({ targetGroup: 'STAFF' })
        .then((res) => {
          if (!isMounted) return;
          const freshStaffs = (res as { data?: StaffUser[] })?.data ?? (Array.isArray(res) ? res : []);
          if (Array.isArray(freshStaffs) && freshStaffs.length > 0) {
            setStaffs(freshStaffs);
          }
        })
        .catch(() => {});
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(statusInterval);
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
      eyebrow="Rạp của tôi"
      title="Hồ sơ rạp & Danh sách phòng - Staff"
      description="Chi tiết thông tin rạp, danh sách phòng chiếu và danh sách nhân sự Staff thuộc phạm vi quản lý của Manager."
      isLightMode={isLightMode}
      action={cinema ? <StatusBadge status={cinema.cinemaStatus} /> : undefined}
    >
      {loading ? (
        <StatePanel type="loading" title="Đang tải thông tin rạp" description="Đang lấy phòng chiếu và danh sách nhân sự rạp..." isLightMode={isLightMode} />
      ) : errorMessage ? (
        <StatePanel type="error" title="Không tải được dữ liệu rạp" description={errorMessage} isLightMode={isLightMode} />
      ) : !cinema ? (
        <StatePanel
          title="Chưa có rạp được gắn với tài khoản"
          description="Backend chưa trả về phòng chiếu nào cho tài khoản này, nên hệ thống chưa xác định được rạp của Manager."
          isLightMode={isLightMode}
        />
      ) : (
        <>
          {/* CINEMA OVERVIEW CARD */}
          <section className={`${panelClass(isLightMode)} overflow-hidden`}>
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div className="flex items-start gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 text-xl text-white shadow-lg">
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
                  { label: 'Đang HĐ', value: formatNumber(activeRooms), icon: <FaBuilding /> },
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

          {/* 2 TABLES GRID: ROOMS TABLE & STAFF TABLE */}
          <div className="grid gap-6 xl:grid-cols-2 mt-2">
            {/* TABLE 1: DANH SÁCH PHÒNG CHIẾU */}
            <section className={panelClass(isLightMode)}>
              <div className={`flex items-center justify-between border-b px-5 py-4 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
                <div className="flex items-center gap-2">
                  <FaDoorOpen className="text-emerald-500 text-lg" />
                  <h2 className={`font-black text-base ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                    Danh Sách Phòng Chiếu ({rooms.length})
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                  {activeRooms} Đang HĐ
                </span>
              </div>

              {rooms.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">Chưa có phòng chiếu nào.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-medium">
                    <thead className={`border-b text-[11px] font-black uppercase tracking-wider ${isLightMode ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-white/10 bg-white/5 text-slate-400'}`}>
                      <tr>
                        <th className="py-3 px-4">Tên & Mã Phòng</th>
                        <th className="py-3 px-4">Sức Chứa</th>
                        <th className="py-3 px-4">Ghế Đã Tạo</th>
                        <th className="py-3 px-4">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/10'}`}>
                      {rooms.map((room) => (
                        <tr key={room.roomId} className={`transition ${isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}>
                          <td className="py-3.5 px-4">
                            <p className={`font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{room.roomName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{room.roomId}</p>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-emerald-400">
                            {formatNumber(room.capacity)} ghế
                          </td>
                          <td className="py-3.5 px-4 font-bold">
                            {formatNumber(room.seatCount)} ghế
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusBadge status={room.roomStatus} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* TABLE 2: DANH SÁCH STAFF CÙNG RẠP */}
            <section className={panelClass(isLightMode)}>
              <div className={`flex items-center justify-between border-b px-5 py-4 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
                <div className="flex items-center gap-2">
                  <FaUserShield className="text-cyan-500 text-lg" />
                  <h2 className={`font-black text-base ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                    Danh Sách Staff Cùng Rạp ({staffs.length})
                  </h2>
                </div>
                <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-400 border border-cyan-500/20">
                  Nhân Sự Rạp
                </span>
              </div>

              {staffs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">Chưa có dữ liệu nhân viên Staff cho rạp này.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-medium">
                    <thead className={`border-b text-[11px] font-black uppercase tracking-wider ${isLightMode ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-white/10 bg-white/5 text-slate-400'}`}>
                      <tr>
                        <th className="py-3 px-4">Mã Staff (User ID)</th>
                        <th className="py-3 px-4">Họ & Tên</th>
                        <th className="py-3 px-4">Email Liên Hệ</th>
                        <th className="py-3 px-4">Vai Trò</th>
                        <th className="py-3 px-4">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/10'}`}>
                      {staffs.map((staff) => (
                        <tr key={staff.userId} className={`transition ${isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}>
                          <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                            {staff.userId}
                          </td>
                          <td className="py-3.5 px-4 font-black text-white">
                            {staff.fullName || 'Nhân viên rạp'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">
                            {staff.email || '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="rounded-md bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                              {staff.role || 'Staff'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {staff.isOnline || isUserOnline(staff.userId, staff.email, staff.role) ? (
                              <span className="rounded-md bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                                Online
                              </span>
                            ) : (
                              <span className="rounded-md bg-slate-500/15 px-2.5 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-500/30">
                                Offline
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </PageShell>
  );
};

export default MyCinemaPage;
