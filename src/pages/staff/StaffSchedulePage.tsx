import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getCurrentUserProfile } from '../../lib/auth';

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

const DAYS_OF_WEEK = [
  { key: 'MON', label: 'Thứ 2', short: 'T2' },
  { key: 'TUE', label: 'Thứ 3', short: 'T3' },
  { key: 'WED', label: 'Thứ 4', short: 'T4' },
  { key: 'THU', label: 'Thứ 5', short: 'T5' },
  { key: 'FRI', label: 'Thứ 6', short: 'T6' },
  { key: 'SAT', label: 'Thứ 7', short: 'T7' },
  { key: 'SUN', label: 'Chủ Nhật', short: 'CN' },
];

const STORAGE_KEY = 'g2c-manager-staff-shifts-v1';

// Default mock schedule fallback if manager hasn't created any shifts yet
const DEFAULT_SCHEDULE: Record<string, Record<string, ShiftType[]>> = {
  'usr-staff-01': { MON: ['MORNING'], TUE: ['MORNING'], WED: ['EVENING'], THU: ['MORNING'], FRI: ['EVENING'] },
  'usr-staff-02': { MON: ['AFTERNOON'], TUE: ['AFTERNOON'], WED: ['MORNING'], FRI: ['MORNING'], SAT: ['EVENING'] },
  'usr-staff-03': { TUE: ['EVENING'], WED: ['AFTERNOON'], THU: ['AFTERNOON'], SAT: ['MORNING'], SUN: ['EVENING'] },
  'usr-staff-04': { MON: ['NIGHT'], THU: ['NIGHT'], FRI: ['NIGHT'], SAT: ['NIGHT'], SUN: ['NIGHT'] },
  'usr-staff-05': { WED: ['NIGHT'], THU: ['EVENING'], FRI: ['AFTERNOON'], SAT: ['AFTERNOON'], SUN: ['MORNING'] },
};

const DEFAULT_STAFF_PROFILES: Record<string, { fullName: string; role: string; email: string }> = {
  'usr-staff-01': { fullName: 'Nguyễn Văn An', role: 'Staff Quầy Vé', email: 'an.nguyen@g2cinema.vn' },
  'usr-staff-02': { fullName: 'Trần Thị Bình', role: 'Staff Quầy Vé & F&B', email: 'binh.tran@g2cinema.vn' },
  'usr-staff-03': { fullName: 'Lê Văn Cường', role: 'Staff Kiểm Vé', email: 'cuong.le@g2cinema.vn' },
  'usr-staff-04': { fullName: 'Phạm Minh Đức', role: 'Staff Đêm', email: 'duc.pham@g2cinema.vn' },
  'usr-staff-05': { fullName: 'Hoàng Anh Tuấn', role: 'Staff Vận Hành', email: 'tuan.hoang@g2cinema.vn' },
};

export default function StaffSchedulePage() {
  const context = useOutletContext<{ isLightMode?: boolean }>() || {};
  const isLightMode = context.isLightMode ?? false;

  const profile = getCurrentUserProfile();

  // Saved schedule state from Manager
  const scheduleData = useMemo<Record<string, Record<string, ShiftType[]>>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Object.keys(parsed).length > 0) return parsed;
      }
    } catch {
      // Ignore
    }
    return DEFAULT_SCHEDULE;
  }, []);

  // Determine current logged-in staff ID strictly (No switching allowed)
  const availableStaffIds = Object.keys(scheduleData);
  const activeStaffId = useMemo(() => {
    if (profile?.userId && scheduleData[profile.userId]) {
      return profile.userId;
    }
    const matchByEmail = availableStaffIds.find(
      (id) => DEFAULT_STAFF_PROFILES[id]?.email.toLowerCase() === profile?.email?.toLowerCase()
    );
    if (matchByEmail) return matchByEmail;
    return availableStaffIds[0] || 'usr-staff-01';
  }, [profile, scheduleData, availableStaffIds]);

  // Get personal schedule of logged-in staff member ONLY
  const personalSchedule = scheduleData[activeStaffId] || {};
  const staffInfo = DEFAULT_STAFF_PROFILES[activeStaffId] || {
    fullName: profile?.fullName || 'Nhân Viên Rạp',
    role: 'Staff Vận Hành',
    email: profile?.email || 'staff@g2cinema.vn',
  };

  // Calculate statistics for personal schedule
  const stats = useMemo(() => {
    let totalShifts = 0;
    let totalHours = 0;

    DAYS_OF_WEEK.forEach((day) => {
      const dayShifts = personalSchedule[day.key] || [];
      totalShifts += dayShifts.length;
      dayShifts.forEach((s) => {
        totalHours += SHIFT_DEFINITIONS[s]?.hours || 0;
      });
    });

    return { totalShifts, totalHours };
  }, [personalSchedule]);

  // Determine current day key for highlighting today
  const todayKey = useMemo(() => {
    const dayNum = new Date().getDay(); // 0 is Sunday
    const map: Record<number, string> = { 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT', 0: 'SUN' };
    return map[dayNum] || 'MON';
  }, []);

  return (
    <div className="space-y-6 select-none p-2 sm:p-4">
      {/* Header Banner - Personal Profile Only */}
      <div
        className={`rounded-2xl border p-6 transition ${
          isLightMode
            ? 'border-slate-200 bg-white shadow-sm'
            : 'border-white/10 bg-[#0B1528] text-white'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight">
                Lịch Ca Trực Cá Nhân · {staffInfo.fullName}
              </h1>
              <span className="rounded-md bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-400 border border-emerald-500/30">
                Lịch Cá Nhân
              </span>
            </div>
            <p className={`mt-1 text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Mã NV: <span className="font-mono font-bold text-cyan-400">{activeStaffId}</span> · {staffInfo.email} · Rạp G2Cinema
            </p>
          </div>
        </div>

        {/* Weekly Stats Summary Bar */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t pt-5 border-slate-200/60 dark:border-white/10">
          <div className={`rounded-xl border p-3.5 ${
            isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.03] border-white/10'
          }`}>
            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              Tổng Giờ Làm Tuần
            </div>
            <div className="mt-1 text-2xl font-black text-emerald-400">
              {stats.totalHours} <span className="text-xs font-normal text-slate-400">Giờ</span>
            </div>
          </div>

          <div className={`rounded-xl border p-3.5 ${
            isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.03] border-white/10'
          }`}>
            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              Tổng Ca Trực
            </div>
            <div className="mt-1 text-2xl font-black text-cyan-400">
              {stats.totalShifts} <span className="text-xs font-normal text-slate-400">Ca</span>
            </div>
          </div>

          <div className={`col-span-2 sm:col-span-1 rounded-xl border p-3.5 ${
            isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.03] border-white/10'
          }`}>
            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              Trạng Thái Phân Ca
            </div>
            <div className="mt-1 text-xs font-bold text-slate-300">
              {stats.totalShifts > 0 ? (
                <span className="text-emerald-400 font-extrabold">Đã xếp lịch hoàn tất</span>
              ) : (
                <span className="text-rose-400 font-extrabold">Chưa xếp ca tuần này</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Personal Schedule Calendar Grid (Mon -> Sun) */}
      <div
        className={`rounded-2xl border p-6 transition ${
          isLightMode
            ? 'border-slate-200 bg-white shadow-sm'
            : 'border-white/10 bg-[#0B1528] text-white'
        }`}
      >
        <div className="mb-5">
          <h2 className="text-base font-black">
            Lịch Trực Cá Nhân (Thứ 2 đến Chủ Nhật)
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Chỉ hiển thị riêng lịch phân công ca làm việc của bạn.
          </p>
        </div>

        {/* 7-Day Calendar Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {DAYS_OF_WEEK.map((day) => {
            const dayShifts = personalSchedule[day.key] || [];
            const isToday = day.key === todayKey;

            return (
              <div
                key={day.key}
                className={`rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                  isToday
                    ? isLightMode
                      ? 'border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-400/40 shadow-md'
                      : 'border-emerald-400/80 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/10'
                    : isLightMode
                    ? 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                {/* Day Header */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/50 dark:border-white/10">
                    <span className="text-sm font-black tracking-tight">{day.label}</span>
                    {isToday && (
                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black text-white uppercase tracking-wider">
                        Hôm nay
                      </span>
                    )}
                  </div>

                  {/* Shift Badges Container */}
                  <div className="mt-3 space-y-2">
                    {dayShifts.length === 0 ? (
                      <div className="py-6 text-center">
                        <span className="inline-block rounded-xl bg-slate-500/10 px-3 py-1.5 text-xs font-bold text-slate-400 border border-slate-500/20">
                          Nghỉ (Không có ca)
                        </span>
                      </div>
                    ) : (
                      dayShifts.map((shiftKey) => {
                        const def = SHIFT_DEFINITIONS[shiftKey];
                        if (!def) return null;

                        return (
                          <div
                            key={shiftKey}
                            className={`rounded-xl border p-3 text-center transition transform hover:scale-[1.02] ${
                              isLightMode ? def.badgeClassLight : def.badgeClassDark
                            }`}
                          >
                            <div className="text-sm font-black">{def.shortLabel}</div>
                            <div className="mt-0.5 text-[10px] font-bold opacity-80">
                              {def.label} · {def.timeRange}
                            </div>
                            <div className="mt-1 text-[10px] font-mono opacity-70">
                              {def.hours} tiếng
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Day Footer Shift Count */}
                <div className="mt-4 border-t pt-2 border-slate-200/40 dark:border-white/5 text-center">
                  <span className="text-[10px] font-bold text-slate-400">
                    {dayShifts.length > 0 ? `${dayShifts.length} ca làm việc` : '0 ca trực'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Note / Information Notice */}
        <div className={`mt-6 rounded-xl border p-4 text-xs ${
          isLightMode
            ? 'border-blue-200 bg-blue-50/70 text-blue-900'
            : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
        }`}>
          <div>
            <span className="font-black">Lưu ý quan trọng:</span> Lịch làm việc được Quản lý (Manager) cập nhật trực tiếp. Nếu cần xin đổi ca hoặc có thắc mắc về ca trực, vui lòng liên hệ Ban quản lý rạp trước 24 giờ.
          </div>
        </div>
      </div>
    </div>
  );
}
