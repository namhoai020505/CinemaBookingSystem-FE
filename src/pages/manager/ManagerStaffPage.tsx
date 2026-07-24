import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'react-toastify';
import type { ManagerOutletContext } from '../../layouts/manager/ManagerLayout';
import { notificationService } from '../../services/notificationService';

type ShiftType = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

interface ShiftDefinition {
  id: ShiftType;
  label: string;
  shortLabel: string;
  timeRange: string;
  hours: number;
  badgeClassLight: string;
  badgeClassDark: string;
}

const SHIFT_DEFINITIONS: Record<ShiftType, ShiftDefinition> = {
  MORNING: {
    id: 'MORNING',
    label: 'Ca Sáng',
    shortLabel: '08H-12H',
    timeRange: '08:00 - 12:00',
    hours: 4,
    badgeClassLight: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
    badgeClassDark: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold',
  },
  AFTERNOON: {
    id: 'AFTERNOON',
    label: 'Ca Chiều',
    shortLabel: '12H-17H',
    timeRange: '12:00 - 17:00',
    hours: 5,
    badgeClassLight: 'bg-blue-100 text-blue-800 border-blue-300 font-bold',
    badgeClassDark: 'bg-blue-500/20 text-blue-300 border-blue-500/40 font-bold',
  },
  EVENING: {
    id: 'EVENING',
    label: 'Ca Tối',
    shortLabel: '17H-22H',
    timeRange: '17:00 - 22:00',
    hours: 5,
    badgeClassLight: 'bg-purple-100 text-purple-800 border-purple-300 font-bold',
    badgeClassDark: 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold',
  },
  NIGHT: {
    id: 'NIGHT',
    label: 'Ca Đêm',
    shortLabel: '22H-02H',
    timeRange: '22:00 - 02:00',
    hours: 4,
    badgeClassLight: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
    badgeClassDark: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold',
  },
};

interface StaffMember {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  cinemaName?: string;
}

const DEFAULT_STAFF_LIST: StaffMember[] = [
  { userId: 'usr-staff-01', fullName: 'Nguyễn Văn An', email: 'an.nguyen@g2cinema.vn', phone: '0912345678', role: 'Staff', cinemaName: 'G2Cinema Thái Nguyên' },
  { userId: 'usr-staff-02', fullName: 'Trần Thị Bình', email: 'binh.tran@g2cinema.vn', phone: '0923456789', role: 'Staff', cinemaName: 'G2Cinema Thái Nguyên' },
  { userId: 'usr-staff-03', fullName: 'Lê Văn Cường', email: 'cuong.le@g2cinema.vn', phone: '0934567890', role: 'Staff', cinemaName: 'G2Cinema Thái Nguyên' },
  { userId: 'usr-staff-04', fullName: 'Phạm Minh Đức', email: 'duc.pham@g2cinema.vn', phone: '0945678901', role: 'Staff', cinemaName: 'G2Cinema Thái Nguyên' },
  { userId: 'usr-staff-05', fullName: 'Hoàng Anh Tuấn', email: 'tuan.hoang@g2cinema.vn', phone: '0956789012', role: 'Staff', cinemaName: 'G2Cinema Thái Nguyên' },
];

const DAYS_OF_WEEK = [
  { key: 'MON', label: 'Thứ 2' },
  { key: 'TUE', label: 'Thứ 3' },
  { key: 'WED', label: 'Thứ 4' },
  { key: 'THU', label: 'Thứ 5' },
  { key: 'FRI', label: 'Thứ 6' },
  { key: 'SAT', label: 'Thứ 7' },
  { key: 'SUN', label: 'Chủ Nhật' },
];

const STORAGE_KEY = 'g2c-manager-staff-shifts-v1';

export default function ManagerStaffPage() {
  const { isLightMode } = useOutletContext<ManagerOutletContext>();
  const [staffList, setStaffList] = useState<StaffMember[]>(DEFAULT_STAFF_LIST);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Brush Mode for Paint / Drag Selection
  const [activeBrush, setActiveBrush] = useState<ShiftType | 'CLEAR'>('MORNING');
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Schedule state: staffId -> { dayKey: ShiftType[] }
  const [schedule, setSchedule] = useState<Record<string, Record<string, ShiftType[]>>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore fallback
    }
    return {
      'usr-staff-01': { MON: ['MORNING'], TUE: ['MORNING'], WED: ['EVENING'], THU: ['MORNING'], FRI: ['EVENING'] },
      'usr-staff-02': { MON: ['AFTERNOON'], TUE: ['AFTERNOON'], WED: ['MORNING'], FRI: ['MORNING'], SAT: ['EVENING'] },
      'usr-staff-03': { TUE: ['EVENING'], WED: ['AFTERNOON'], THU: ['AFTERNOON'], SAT: ['MORNING'], SUN: ['EVENING'] },
      'usr-staff-04': { MON: ['NIGHT'], THU: ['NIGHT'], FRI: ['NIGHT'], SAT: ['NIGHT'], SUN: ['NIGHT'] },
      'usr-staff-05': { WED: ['NIGHT'], THU: ['EVENING'], FRI: ['AFTERNOON'], SAT: ['AFTERNOON'], SUN: ['MORNING'] },
    };
  });

  // Load real STAFF members from API (Filtering ONLY Staff role in cinema)
  useEffect(() => {
    notificationService
      .getFilteredUsers({ role: 'staff' })
      .then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          const onlyStaff: StaffMember[] = res.data
            .filter((u) => {
              const r = (u.role || '').toUpperCase();
              // STRICT FILTER: Only keep Staff role, exclude Customers, Managers, Admins
              return (
                r.includes('STAFF') &&
                !r.includes('ADMIN') &&
                !r.includes('MANAGER') &&
                !r.includes('CUSTOMER')
              );
            })
            .map((u) => ({
              userId: u.userId,
              fullName: u.fullName || u.userId,
              email: u.email || '—',
              phone: '—',
              role: 'Staff',
              cinemaName: 'Rạp cùng phân quyền',
            }));

          if (onlyStaff.length > 0) {
            setStaffList(onlyStaff);
          }
        }
      })
      .catch(() => {});
  }, []);

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.userId.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q),
    );
  }, [staffList, searchQuery]);

  // Apply brush paint action to a specific cell (Staff ID + Day Key)
  const applyBrushToCell = (staffId: string, dayKey: string) => {
    setSchedule((prev) => {
      const staffSchedule = prev[staffId] || {};
      const currentShifts = staffSchedule[dayKey] || [];

      if (activeBrush === 'CLEAR') {
        return {
          ...prev,
          [staffId]: {
            ...staffSchedule,
            [dayKey]: [],
          },
        };
      }

      if (currentShifts.includes(activeBrush)) {
        return prev; // Already assigned
      }

      return {
        ...prev,
        [staffId]: {
          ...staffSchedule,
          [dayKey]: [...currentShifts, activeBrush],
        },
      };
    });
  };

  // Cell Mouse Handlers for Mouse Drag / Sweep Painting
  const handleCellMouseDown = (staffId: string, dayKey: string) => {
    setIsMouseDown(true);
    applyBrushToCell(staffId, dayKey);
  };

  const handleCellMouseEnter = (staffId: string, dayKey: string) => {
    if (isMouseDown) {
      applyBrushToCell(staffId, dayKey);
    }
  };

  // Bulk Action: Assign shift for an entire staff member across Mon-Fri
  const handleAssignRowWeek = (staffId: string, shift: ShiftType) => {
    setSchedule((prev) => {
      const staffSchedule = { ...(prev[staffId] || {}) };
      ['MON', 'TUE', 'WED', 'THU', 'FRI'].forEach((dayKey) => {
        const curr = staffSchedule[dayKey] || [];
        if (!curr.includes(shift)) {
          staffSchedule[dayKey] = [...curr, shift];
        }
      });
      return { ...prev, [staffId]: staffSchedule };
    });
    toast.success(`Đã gán ${SHIFT_DEFINITIONS[shift].label} (Thứ 2-6) cho nhân viên!`);
  };

  // Bulk Action: Clear entire week for a staff member
  const handleClearRowWeek = (staffId: string) => {
    setSchedule((prev) => ({
      ...prev,
      [staffId]: {},
    }));
    toast.info('Đã xóa tất cả ca trong tuần của nhân viên này.');
  };

  // Bulk Action: Assign active brush to all staff members on a given day column
  const handleAssignDayColumn = (dayKey: string, dayLabel: string) => {
    if (activeBrush === 'CLEAR') {
      setSchedule((prev) => {
        const next = { ...prev };
        filteredStaff.forEach((staff) => {
          if (next[staff.userId]) {
            next[staff.userId] = { ...next[staff.userId], [dayKey]: [] };
          }
        });
        return next;
      });
      toast.warn(`Đã xóa tất cả ca ngày ${dayLabel}.`);
      return;
    }

    setSchedule((prev) => {
      const next = { ...prev };
      filteredStaff.forEach((staff) => {
        const staffSched = next[staff.userId] || {};
        const curr = staffSched[dayKey] || [];
        if (!curr.includes(activeBrush)) {
          next[staff.userId] = {
            ...staffSched,
            [dayKey]: [...curr, activeBrush],
          };
        }
      });
      return next;
    });
    toast.success(`Đã gán [${SHIFT_DEFINITIONS[activeBrush].label}] cho tất cả nhân viên ngày ${dayLabel}!`);
  };

  const handleSaveSchedule = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
      toast.success('Đã lưu bảng phân công ca trực thành công!');
    } catch {
      toast.error('Lỗi khi lưu bảng phân ca!');
    }
  };

  const handleAutoSchedule = () => {
    const shiftTypes: ShiftType[] = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'];
    const newSchedule: Record<string, Record<string, ShiftType[]>> = {};

    filteredStaff.forEach((staff, index) => {
      newSchedule[staff.userId] = {};
      DAYS_OF_WEEK.forEach((day, dIdx) => {
        if ((index + dIdx) % 2 === 0) {
          const shiftToAssign = shiftTypes[(index + dIdx) % shiftTypes.length];
          newSchedule[staff.userId][day.key] = [shiftToAssign];
        } else {
          newSchedule[staff.userId][day.key] = [];
        }
      });
    });

    setSchedule(newSchedule);
    toast.info('Đã tự động phân ca trực xoay vòng cân bằng cho Nhân viên!');
  };

  const handleClearAll = () => {
    setSchedule({});
    toast.warn('Đã xóa toàn bộ ca trực.');
  };

  const getStaffStats = (staffId: string) => {
    const staffSched = schedule[staffId] || {};
    let totalShifts = 0;
    let totalHours = 0;

    Object.values(staffSched).forEach((shifts) => {
      shifts.forEach((s) => {
        totalShifts += 1;
        totalHours += SHIFT_DEFINITIONS[s]?.hours || 0;
      });
    });

    return { totalShifts, totalHours };
  };

  return (
    <div
      onMouseUp={() => setIsMouseDown(false)}
      onMouseLeave={() => setIsMouseDown(false)}
      className="space-y-6 select-none"
    >
      {/* Page Header Banner */}
      <div
        className={`rounded-2xl border p-6 ${
          isLightMode
            ? 'border-slate-200 bg-white shadow-sm'
            : 'border-white/10 bg-[#0B1528]'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-tight">
              Phân Công Ca Trực Nhân Viên Rạp
            </h1>
            <p className={`mt-1 text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Xếp lịch làm việc cho các Nhân viên rạp (Staff cùng rạp). Giữ & lướt chuột qua các ô để chọn ca hàng loạt siêu nhanh!
            </p>
          </div>

          {/* Quick Control Text Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAutoSchedule}
              className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-400 hover:bg-cyan-500/20 transition"
            >
              Phân ca tự động
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition"
            >
              Xóa tất cả ca
            </button>

            <button
              type="button"
              onClick={handleSaveSchedule}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-500 transition shadow-lg"
            >
              Lưu lịch phân ca
            </button>
          </div>
        </div>

        {/* BRUSH PALETTE BAR */}
        <div className="mt-5 border-t pt-4 border-slate-200/60 dark:border-white/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black uppercase tracking-wider ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>
                Cọ chọn ca (Chọn cọ rồi rê chuột trên bảng để tô ca hàng loạt):
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {Object.values(SHIFT_DEFINITIONS).map((def) => (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => setActiveBrush(def.id)}
                  className={`rounded-xl border px-3.5 py-1.5 text-xs font-black transition ${
                    activeBrush === def.id
                      ? 'border-emerald-400 bg-emerald-500 text-white shadow-md ring-2 ring-emerald-400/50'
                      : isLightMode
                      ? def.badgeClassLight
                      : def.badgeClassDark
                  }`}
                >
                  {def.shortLabel}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setActiveBrush('CLEAR')}
                className={`rounded-xl border px-4 py-1.5 text-xs font-black tracking-wider transition ${
                  activeBrush === 'CLEAR'
                    ? 'border-rose-500 bg-rose-600 text-white shadow-md ring-2 ring-rose-400/50'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/40 hover:bg-rose-500/25'
                }`}
              >
                XÓA
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Schedule Matrix Panel */}
      <div
        className={`rounded-2xl border p-6 ${
          isLightMode
            ? 'border-slate-200 bg-white shadow-sm'
            : 'border-white/10 bg-[#0B1528]'
        }`}
      >
        {/* Search & Staff Filter Header */}
        <div className="mb-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-black">
              Bảng Phân Ca Staff Rạp · {filteredStaff.length} Nhân viên Staff
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              * Mẹo: Rê chuột đè (mouse drag) qua các ô để tô ca hàng loạt siêu tiện lợi!
            </p>
          </div>

          <input
            type="text"
            placeholder="Tìm kiếm nhân viên staff theo tên hoặc ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full md:w-72 rounded-xl border px-3.5 py-2 text-xs outline-none transition ${
              isLightMode
                ? 'border-slate-200 bg-slate-50 text-slate-900 focus:border-emerald-500'
                : 'border-white/10 bg-white/5 text-white focus:border-emerald-500'
            }`}
          />
        </div>

        {/* Schedule Table Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr
                className={`border-b font-black uppercase tracking-wider ${
                  isLightMode
                    ? 'border-slate-200 bg-slate-100 text-slate-700'
                    : 'border-white/10 bg-white/5 text-slate-300'
                }`}
              >
                <th className="py-3 px-3 min-w-[200px]">Staff Nhân Viên</th>
                <th className="py-3 px-3 w-28 text-center">Giờ / Tuần</th>
                {DAYS_OF_WEEK.map((day) => (
                  <th key={day.key} className="py-3 px-2 min-w-[110px] text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>{day.label}</span>
                      <button
                        type="button"
                        onClick={() => handleAssignDayColumn(day.key, day.label)}
                        className="text-[10px] font-black text-cyan-400 hover:underline uppercase tracking-wider"
                        title={`Gán cọ hiện tại cho tất cả nhân viên ngày ${day.label}`}
                      >
                        ALL
                      </button>
                    </div>
                  </th>
                ))}
                <th className="py-3 px-3 text-center min-w-[240px]">GÁN NHANH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-white/5">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-xs text-slate-400">
                    Không tìm thấy nhân viên Staff nào phù hợp trong rạp.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => {
                  const { totalHours, totalShifts } = getStaffStats(staff.userId);

                  return (
                    <tr
                      key={staff.userId}
                      className={`transition ${
                        isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Staff Info Column */}
                      <td className="py-3 px-3 align-middle">
                        <div className="font-bold text-sm leading-tight text-emerald-400">
                          {staff.fullName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {staff.userId} · {staff.email}
                        </div>
                      </td>

                      {/* Total Work Hours Stats */}
                      <td className="py-3 px-3 align-middle text-center">
                        <span
                          className={`inline-block rounded-lg px-2.5 py-1 text-xs font-black border ${
                            totalHours > 0
                              ? isLightMode
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : isLightMode
                              ? 'bg-slate-100 text-slate-400 border-slate-200'
                              : 'bg-white/5 text-slate-500 border-white/10'
                          }`}
                        >
                          {totalHours}h · {totalShifts} ca
                        </span>
                      </td>

                      {/* Day Columns (Support Mouse Drag / Sweep Painting) */}
                      {DAYS_OF_WEEK.map((day) => {
                        const dayShifts = schedule[staff.userId]?.[day.key] || [];

                        return (
                          <td
                            key={day.key}
                            onMouseDown={() => handleCellMouseDown(staff.userId, day.key)}
                            onMouseEnter={() => handleCellMouseEnter(staff.userId, day.key)}
                            className="py-3 px-1.5 align-middle text-center cursor-pointer hover:bg-emerald-500/10 transition border border-transparent hover:border-emerald-500/40 rounded-lg"
                          >
                            {dayShifts.length === 0 ? (
                              <span className="text-[10px] font-semibold text-slate-500 opacity-60">
                                Trống
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1 items-center justify-center">
                                {dayShifts.map((shiftKey) => {
                                  const def = SHIFT_DEFINITIONS[shiftKey];
                                  if (!def) return null;
                                  return (
                                    <span
                                      key={shiftKey}
                                      className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-black tracking-tight border ${
                                        isLightMode ? def.badgeClassLight : def.badgeClassDark
                                      }`}
                                    >
                                      {def.shortLabel}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Row Quick Action Presets - Colored T2-T6 Box Buttons & XÓA */}
                      <td className="py-3 px-3 align-middle text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAssignRowWeek(staff.userId, 'MORNING')}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-black transition hover:scale-105 ${
                              isLightMode
                                ? 'border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                            }`}
                            title="Gán ca 08H-12H (T2-T6)"
                          >
                            T2-T6
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAssignRowWeek(staff.userId, 'AFTERNOON')}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-black transition hover:scale-105 ${
                              isLightMode
                                ? 'border-blue-300 bg-blue-100 text-blue-800 hover:bg-blue-200'
                                : 'border-blue-500/40 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                            }`}
                            title="Gán ca 12H-17H (T2-T6)"
                          >
                            T2-T6
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAssignRowWeek(staff.userId, 'EVENING')}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-black transition hover:scale-105 ${
                              isLightMode
                                ? 'border-purple-300 bg-purple-100 text-purple-800 hover:bg-purple-200'
                                : 'border-purple-500/40 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                            }`}
                            title="Gán ca 17H-22H (T2-T6)"
                          >
                            T2-T6
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAssignRowWeek(staff.userId, 'NIGHT')}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-black transition hover:scale-105 ${
                              isLightMode
                                ? 'border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-200'
                                : 'border-rose-500/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                            }`}
                            title="Gán ca 22H-02H (T2-T6)"
                          >
                            T2-T6
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClearRowWeek(staff.userId)}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-black transition hover:scale-105 ${
                              isLightMode
                                ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300'
                                : 'border-rose-500/40 bg-rose-500/15 text-rose-400 hover:bg-rose-500/30'
                            }`}
                            title="Xóa tất cả ca trong tuần"
                          >
                            XÓA
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
