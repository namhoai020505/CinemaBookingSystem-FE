import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'react-toastify';
import {
  staffService,
  type AssignableAccountRole,
  type CinemaOption,
  type ProvisionedAccountData,
} from '../../services/staffService';
import { notificationService } from '../../services/notificationService';
import { isUserOnline } from '../../lib/sessionHeartbeat';
import { TEXT } from '../../constants/vi';

type ParsedApiError = {
  message: string;
  errorCode?: string;
};

const staffErrorMessages: Record<string, string> = {
  DUPLICATE_EMAIL: TEXT.STAFF.ERR_DUPLICATE_EMAIL,
  CINEMA_REQUIRED: TEXT.STAFF.ERR_CINEMA_REQUIRED,
  CINEMA_NOT_ALLOWED: TEXT.STAFF.ERR_CINEMA_NOT_ALLOWED,
  CINEMA_NOT_FOUND: TEXT.STAFF.ERR_CINEMA_NOT_FOUND,
  ROLE_ASSIGNMENT_NOT_ALLOWED: TEXT.STAFF.ERR_ROLE_NOT_ALLOWED,
  ROLE_NOT_FOUND: TEXT.STAFF.ERR_ROLE_NOT_FOUND,
  EMAIL_SEND_FAILED: TEXT.STAFF.ERR_EMAIL_SEND_FAILED,
  VALIDATION_ERROR: TEXT.STAFF.ERR_VALIDATION,
};

const DIRECTORY_PAGE_SIZE = 10;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeForSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gu, 'd')
    .toLocaleLowerCase('vi-VN')
    .trim();

const formatRoleName = (roleName: string) =>
  roleName.charAt(0).toUpperCase() + roleName.slice(1).toLowerCase();

const getCinemaSearchRank = (cinema: CinemaOption, searchTerm: string) => {
  if (!searchTerm) {
    return 0;
  }

  const cinemaName = normalizeForSearch(cinema.cinemaName);
  const city = normalizeForSearch(cinema.city);
  const address = normalizeForSearch(cinema.address);

  if (cinemaName.startsWith(searchTerm)) {
    return 0;
  }

  if (cinemaName.split(/\s+/).some((word) => word.startsWith(searchTerm))) {
    return 1;
  }

  if (city.startsWith(searchTerm)) {
    return 2;
  }

  return `${cinemaName} ${city} ${address}`.includes(searchTerm) ? 3 : -1;
};

const parseApiError = (error: unknown): ParsedApiError => {
  if (!isRecord(error)) {
    return { message: TEXT.STAFF.ERR_UNKNOWN_OBJ };
  }

  if (isRecord(error.response)) {
    const data = error.response.data;

    if (isRecord(data)) {
      const errorCode = typeof data.errorCode === 'string' ? data.errorCode : undefined;
      const mappedMessage = errorCode ? staffErrorMessages[errorCode] : undefined;

      if (mappedMessage) {
        return { message: mappedMessage, errorCode };
      }

      if (typeof data.message === 'string' && data.message.trim()) {
        return { message: data.message.trim(), errorCode };
      }
    }
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return { message: error.message.trim() };
  }

  return { message: TEXT.STAFF.ERR_UNKNOWN };
};

export interface UserDirectoryItem {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'Staff' | 'Manager' | 'Customer' | 'Admin';
  cinemaName: string;
  status: 'Active' | 'Blocked';
  createdAt: string;
  isOnlineFromBe?: boolean;
}


export default function ManageStaff() {
  const [activeTab, setActiveTab] = useState<'invite' | 'users'>('invite');
  
  // Invitation Form state
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [roles, setRoles] = useState<AssignableAccountRole[]>([]);
  const [cinemas, setCinemas] = useState<CinemaOption[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedCinemaId, setSelectedCinemaId] = useState('');
  const [cinemaQuery, setCinemaQuery] = useState('');
  const [isCinemaMenuOpen, setIsCinemaMenuOpen] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState<ProvisionedAccountData | null>(null);

  // User Directory State
  const [directoryUsers, setDirectoryUsers] = useState<UserDirectoryItem[]>([]);
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'STAFF' | 'MANAGER' | 'CUSTOMER'>('ALL');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDirectoryItem | null>(null);

  useEffect(() => {
    let isCurrent = true;

    const loadFormOptions = async () => {
      try {
        const [rolesResponse, cinemasResponse] = await Promise.all([
          staffService.getAssignableRoles(),
          staffService.getCinemas(),
        ]);

        if (!rolesResponse.success) {
          throw new Error(rolesResponse.message || TEXT.STAFF.ERR_LOAD_ROLES);
        }

        if (!cinemasResponse.success) {
          throw new Error(cinemasResponse.message || TEXT.STAFF.ERR_LOAD_CINEMAS);
        }

        if (isCurrent) {
          setRoles(rolesResponse.data ?? []);
          setCinemas(cinemasResponse.data ?? []);
        }
      } catch (loadError: unknown) {
        if (isCurrent) {
          setOptionsError(parseApiError(loadError).message);
        }
      } finally {
        if (isCurrent) {
          setIsLoadingOptions(false);
        }
      }
    };

    void loadFormOptions();

    const fetchLiveUsers = () => {
      notificationService
        .getFilteredUsers({})
        .then((res) => {
          if (!isCurrent) return;
          if (res.success && res.data) {
            const apiUsers: UserDirectoryItem[] = res.data.map((u) => {
              let role: 'Staff' | 'Manager' | 'Customer' | 'Admin' = 'Customer';
              const rUpper = (u.role || '').toUpperCase();
              if (rUpper.includes('MANAGER')) role = 'Manager';
              else if (rUpper.includes('STAFF')) role = 'Staff';
              else if (rUpper.includes('ADMIN')) role = 'Admin';

              return {
                userId: u.userId,
                fullName: u.fullName || u.userId,
                email: u.email || 'Không có',
                phone: 'Không có',
                role,
                cinemaName: role === 'Customer' ? 'ALL' : 'CINEMA',
                status: 'Active',
                createdAt: '—',
                isOnlineFromBe: u.isOnline,
              };
            });

            setDirectoryUsers(apiUsers);
          }
        })
        .catch(() => {});
    };

    fetchLiveUsers();

    return () => {
      isCurrent = false;
    };
  }, []);

  // Realtime heartbeat ticker for dynamic online/offline status updates
  const [, setHeartbeatTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setHeartbeatTick((t) => t + 1);
      notificationService
        .getFilteredUsers({})
        .then((res) => {
          if (res.success && res.data && res.data.length > 0) {
            const apiMap = new Map(res.data.map((u) => [u.userId, u]));
            setDirectoryUsers((prev) =>
              prev.map((p) => {
                const match = apiMap.get(p.userId) || res.data?.find((a) => a.email && a.email.toLowerCase() === p.email.toLowerCase());
                if (match) {
                  return { ...p, isOnlineFromBe: match.isOnline };
                }
                return p;
              })
            );
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const staffRoles = useMemo(
    () =>
      roles.filter(
        (role) => role.profileKind.toUpperCase() === 'STAFF' && role.requiresCinema,
      ),
    [roles],
  );

  const activeCinemas = useMemo(
    () => cinemas.filter((cinema) => cinema.cinemaStatus.toUpperCase() === 'ACTIVE'),
    [cinemas],
  );

  const selectedRole = useMemo(
    () => staffRoles.find((role) => role.roleId === selectedRoleId),
    [selectedRoleId, staffRoles],
  );

  const selectedCinema = useMemo(
    () => activeCinemas.find((cinema) => cinema.cinemaId === selectedCinemaId),
    [activeCinemas, selectedCinemaId],
  );

  const matchingCinemas = useMemo(() => {
    const normalizedQuery = normalizeForSearch(cinemaQuery);

    return activeCinemas
      .map((cinema) => ({
        cinema,
        rank: getCinemaSearchRank(cinema, normalizedQuery),
      }))
      .filter(({ rank }) => rank >= 0)
      .sort(
        (left, right) =>
          left.rank - right.rank ||
          left.cinema.cinemaName.localeCompare(right.cinema.cinemaName, 'vi'),
      )
      .map(({ cinema }) => cinema);
  }, [activeCinemas, cinemaQuery]);

  const selectedInvitationCinema = useMemo(
    () => cinemas.find((cinema) => cinema.cinemaId === invitation?.cinemaId),
    [cinemas, invitation?.cinemaId],
  );

  const cinemaIsRequired = selectedRole?.requiresCinema ?? false;
  const formIsUnavailable = isLoadingOptions || Boolean(optionsError) || staffRoles.length === 0;
  const cinemaInputValue = isCinemaMenuOpen
    ? cinemaQuery
    : selectedCinema?.cinemaName ?? '';

  const staffSetPasswordPath = invitation?.email
    ? `/staff/set-password?email=${encodeURIComponent(invitation.email)}`
    : '/staff/set-password';

  const selectCinema = (cinema: CinemaOption) => {
    setSelectedCinemaId(cinema.cinemaId);
    setCinemaQuery('');
    setIsCinemaMenuOpen(false);
  };

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    setSelectedCinemaId('');
    setCinemaQuery('');
    setIsCinemaMenuOpen(false);
  };

  const handleUserRoleFilterChange = (
    nextFilter: 'ALL' | 'STAFF' | 'MANAGER' | 'CUSTOMER',
  ) => {
    setUserRoleFilter(nextFilter);
    setUserPage(1);
  };

  const handleUserSearchChange = (value: string) => {
    setUserSearchQuery(value);
    setUserPage(1);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!selectedRole) {
      setError(TEXT.STAFF.ERR_ROLE_REQUIRED);
      return;
    }

    if (selectedRole.requiresCinema && !selectedCinemaId) {
      setError(TEXT.STAFF.ERR_CINEMA_REQUIRED);
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await staffService.provisionAccount({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim() || undefined,
        roleId: selectedRole.roleId,
        cinemaId: selectedCinemaId || undefined,
      });

      if (!response.success || !response.data) {
        throw new Error(response.message || TEXT.STAFF.ERR_SUBMIT_FAILED);
      }

      setInvitation(response.data);

      // Also add newly provisioned staff to user directory list
      const newDirUser: UserDirectoryItem = {
        userId: response.data.userId || `usr-staff-${Date.now().toString().slice(-4)}`,
        fullName: fullName.trim() || email.split('@')[0],
        email: email.trim().toLowerCase(),
        phone: '—',
        role: selectedRole.roleName.toUpperCase().includes('MANAGER') ? 'Manager' : 'Staff',
        cinemaName: selectedCinema?.cinemaName || 'Rạp phân quyền',
        status: 'Active',
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setDirectoryUsers((prev) => [newDirUser, ...prev]);

      toast.success(response.message || TEXT.STAFF.SUCCESS_INVITE);
      setEmail('');
      setFullName('');
    } catch (submitError: unknown) {
      const apiError = parseApiError(submitError);
      setError(apiError.message);
      toast.error(apiError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Directory Filtered Users
  const filteredDirectoryUsers = useMemo(() => {
    return directoryUsers.filter((u) => {
      if (userRoleFilter === 'STAFF' && u.role !== 'Staff') return false;
      if (userRoleFilter === 'MANAGER' && u.role !== 'Manager') return false;
      if (userRoleFilter === 'CUSTOMER' && u.role !== 'Customer') return false;

      const q = userSearchQuery.trim().toLowerCase();
      if (!q) return true;

      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        u.cinemaName.toLowerCase().includes(q)
      );
    });
  }, [directoryUsers, userRoleFilter, userSearchQuery]);

  const totalUserPages = Math.max(
    1,
    Math.ceil(filteredDirectoryUsers.length / DIRECTORY_PAGE_SIZE),
  );
  const currentUserPage = Math.min(userPage, totalUserPages);
  const paginatedDirectoryUsers = useMemo(() => {
    const startIndex = (currentUserPage - 1) * DIRECTORY_PAGE_SIZE;
    return filteredDirectoryUsers.slice(
      startIndex,
      startIndex + DIRECTORY_PAGE_SIZE,
    );
  }, [currentUserPage, filteredDirectoryUsers]);
  const firstVisibleUserIndex =
    filteredDirectoryUsers.length === 0
      ? 0
      : (currentUserPage - 1) * DIRECTORY_PAGE_SIZE + 1;
  const lastVisibleUserIndex = Math.min(
    currentUserPage * DIRECTORY_PAGE_SIZE,
    filteredDirectoryUsers.length,
  );

  return (
    <div className="min-h-screen bg-[#0A0A0C] p-6 font-['Urbanist'] text-white">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wider">Quản Lý Nhân Viên</h1>
        <p className="mt-1 text-xs text-gray-400">
          Tạo lời mời, cấp tài khoản nhân viên nội bộ và tra cứu thông tin toàn bộ người dùng hệ thống.
        </p>
      </div>

      {/* Main Tab Navigation (Text-only, NO ICONS) */}
      <div className="mb-6 flex border-b border-gray-800 gap-3 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('invite')}
          className={`rounded-xl px-4 py-2 text-xs font-black transition ${
            activeTab === 'invite'
              ? 'bg-[#4318FF] text-white shadow-lg'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          Tạo tài khoản
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`rounded-xl px-4 py-2 text-xs font-black transition ${
            activeTab === 'users'
              ? 'bg-[#4318FF] text-white shadow-lg'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          Người dùng · {directoryUsers.length}
        </button>
      </div>

      {/* TAB 1: INVITE & PROVISION FORM */}
      {activeTab === 'invite' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-gray-800 bg-[#111C44] p-6 shadow-2xl"
          >
            <div className="mb-5 border-b border-gray-800 pb-4">
              <h2 className="text-lg font-bold uppercase tracking-wide">{TEXT.STAFF.FORM_TITLE}</h2>
            </div>

            {error ? (
              <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            {optionsError ? (
              <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                {optionsError}
              </div>
            ) : null}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                  {TEXT.STAFF.LABEL_EMAIL} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  disabled={formIsUnavailable}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={TEXT.STAFF.PLACEHOLDER_EMAIL}
                  className="w-full rounded-xl border border-gray-800 bg-[#0F172A] px-4 py-2.5 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                  Họ và tên nhân viên (Không bắt buộc)
                </label>
                <input
                  type="text"
                  disabled={formIsUnavailable}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nhập họ tên nhân viên..."
                  className="w-full rounded-xl border border-gray-800 bg-[#0F172A] px-4 py-2.5 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                  {TEXT.STAFF.LABEL_ROLE} <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  disabled={formIsUnavailable}
                  value={selectedRoleId}
                  onChange={(event) => handleRoleChange(event.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0F172A] px-4 py-2.5 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">{TEXT.STAFF.SELECT_ROLE}</option>
                  {staffRoles.map((role) => (
                    <option key={role.roleId} value={role.roleId}>
                      {formatRoleName(role.roleName)} ({role.profileKind})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                  {TEXT.STAFF.LABEL_CINEMA}{' '}
                  {cinemaIsRequired ? <span className="text-red-500">*</span> : null}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={formIsUnavailable || !cinemaIsRequired}
                    value={cinemaInputValue}
                    onChange={(event) => {
                      setCinemaQuery(event.target.value);
                      if (!isCinemaMenuOpen) {
                        setIsCinemaMenuOpen(true);
                      }
                    }}
                    onFocus={() => {
                      if (cinemaIsRequired) {
                        setIsCinemaMenuOpen(true);
                      }
                    }}
                    placeholder={
                      cinemaIsRequired
                        ? TEXT.STAFF.PLACEHOLDER_CINEMA
                        : TEXT.STAFF.CINEMA_NOT_REQUIRED
                    }
                    aria-autocomplete="list"
                    aria-controls="cinema-options"
                    aria-expanded={isCinemaMenuOpen}
                    className="w-full rounded-xl border border-gray-800 bg-[#0F172A] px-4 py-2.5 pr-10 text-sm text-white outline-none transition placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                    ▾
                  </span>

                  {isCinemaMenuOpen && cinemaIsRequired && !formIsUnavailable ? (
                    <div
                      id="cinema-options"
                      role="listbox"
                      className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-700 bg-[#0F172A] p-1 shadow-2xl"
                    >
                      <p className="px-3 py-2 text-xs text-gray-400">{TEXT.STAFF.HINT_CINEMA_SEARCH}</p>
                      {matchingCinemas.length ? (
                        matchingCinemas.map((cinema) => (
                          <button
                            key={cinema.cinemaId}
                            type="button"
                            role="option"
                            aria-selected={cinema.cinemaId === selectedCinemaId}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              selectCinema(cinema);
                            }}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white transition hover:bg-[#1B2A5B] focus:bg-[#1B2A5B] focus:outline-none"
                          >
                            <span className="block font-semibold">{cinema.cinemaName}</span>
                            <span className="block text-xs text-gray-400">
                              {cinema.address}{cinema.city ? ` · ${cinema.city}` : ''}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-3 text-sm text-gray-400">{TEXT.STAFF.NO_CINEMAS_MATCH}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {!isLoadingOptions && !optionsError && staffRoles.length === 0 ? (
              <p className="mt-4 text-sm text-amber-300">{TEXT.STAFF.NO_ASSIGNABLE_ROLES}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting || formIsUnavailable}
              className={`mt-6 w-full rounded-xl bg-[#4318FF] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition ${
                isSubmitting || formIsUnavailable
                  ? 'cursor-not-allowed opacity-70'
                  : 'hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? TEXT.STAFF.BTN_SUBMITTING : TEXT.STAFF.BTN_SUBMIT}
            </button>
          </form>

          {/* Invitation Status Panel */}
          <div className="rounded-2xl border border-gray-800 bg-[#111C44] p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">{TEXT.STAFF.STATUS_TITLE}</h2>

            {invitation ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                  {TEXT.STAFF.STATUS_SUCCESS} <span className="font-bold">{invitation.email}</span>.
                </div>

                <div className="grid gap-3 rounded-xl border border-gray-800 bg-[#0F172A] p-4 text-sm text-gray-300 sm:grid-cols-2">
                  <p>
                    <span className="text-gray-400">{TEXT.STAFF.STATUS_ROLE}</span>{' '}
                    <span className="font-semibold text-white">
                      {invitation.roleName ? formatRoleName(invitation.roleName) : '—'}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-400">{TEXT.STAFF.STATUS_CINEMA}</span>{' '}
                    <span className="font-semibold text-white">
                      {selectedInvitationCinema?.cinemaName ?? invitation.cinemaId ?? '—'}
                    </span>
                  </p>
                </div>

                {invitation.invitationExpiresAt ? (
                  <div className="rounded-xl border border-gray-800 bg-[#0F172A] p-4 text-sm text-gray-300">
                    {TEXT.STAFF.STATUS_OTP_EXPIRE}{' '}
                    <span className="font-semibold text-white">
                      {new Date(invitation.invitationExpiresAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                ) : null}

                <div className="rounded-xl border border-gray-800 bg-[#0F172A] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-400">
                    {TEXT.STAFF.STATUS_LINK_LABEL}
                  </p>
                  <a
                    href={staffSetPasswordPath}
                    className="break-all text-sm font-semibold text-[#FFD166] transition hover:text-[#FFEBA4]"
                  >
                    {staffSetPasswordPath}
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-800 bg-[#0F172A] p-4 text-sm text-gray-400">
                {TEXT.STAFF.STATUS_EMPTY}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: USER DIRECTORY & DETAILS */}
      {activeTab === 'users' && (
        <div className="rounded-2xl border border-gray-800 bg-[#111C44] p-6 shadow-2xl space-y-5">
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Quick Filter Pills (Text-only, NO ICONS) */}
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleUserRoleFilterChange('ALL')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  userRoleFilter === 'ALL'
                    ? 'bg-[#4318FF] text-white font-bold'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Tất cả · {directoryUsers.length}
              </button>

              <button
                type="button"
                onClick={() => handleUserRoleFilterChange('STAFF')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  userRoleFilter === 'STAFF'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Nhân viên · {directoryUsers.filter((u) => u.role === 'Staff').length}
              </button>

              <button
                type="button"
                onClick={() => handleUserRoleFilterChange('MANAGER')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  userRoleFilter === 'MANAGER'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Quản lý · {directoryUsers.filter((u) => u.role === 'Manager').length}
              </button>

              <button
                type="button"
                onClick={() => handleUserRoleFilterChange('CUSTOMER')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  userRoleFilter === 'CUSTOMER'
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Khách hàng · {directoryUsers.filter((u) => u.role === 'Customer').length}
              </button>
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Tìm kiếm người dùng (Tên, Email, SĐT, ID)..."
              value={userSearchQuery}
              onChange={(e) => handleUserSearchChange(e.target.value)}
              className="w-full md:w-80 rounded-xl border border-gray-800 bg-[#0F172A] px-3.5 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* User Table Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Họ tên</th>
                  <th className="py-2.5 px-3">Email/SĐT</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Rạp</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredDirectoryUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-gray-400">
                      Không có người dùng phù hợp.
                    </td>
                  </tr>
                ) : (
                  paginatedDirectoryUsers.map((user) => (
                    <tr key={user.userId} className="hover:bg-white/[0.02] transition">
                      <td className="py-2.5 px-3 font-mono text-gray-300 font-semibold">
                        {user.userId}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {user.fullName || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-gray-300">
                        <div>{user.email || '—'}</div>
                        {user.phone && user.phone !== '—' && user.phone !== 'Không có' ? (
                          <div className="text-[10px] text-gray-500">{user.phone}</div>
                        ) : (
                          <div className="text-[10px] text-gray-600">SĐT: —</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {user.role === 'Manager' && (
                          <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-[10px] font-black text-purple-400 border border-purple-500/30">
                            Manager
                          </span>
                        )}
                        {user.role === 'Staff' && (
                          <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-400 border border-emerald-500/30">
                            Staff
                          </span>
                        )}
                        {user.role === 'Customer' && (
                          <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-[10px] font-black text-cyan-400 border border-cyan-500/30">
                            Customer
                          </span>
                        )}
                        {user.role === 'Admin' && (
                          <span className="rounded-md bg-blue-500/20 px-2 py-0.5 text-[10px] font-black text-blue-400 border border-blue-500/30">
                            Admin
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-gray-300 font-medium">
                        {user.cinemaName || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {user.isOnlineFromBe || isUserOnline(user.userId, user.email, user.role) ? (
                          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                            Online
                          </span>
                        ) : (
                          <span className="rounded-md bg-slate-500/15 px-2 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-500/30">
                            Offline
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedUserDetail(user)}
                          className="text-[11px] font-bold text-[#FFD166] hover:underline"
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredDirectoryUsers.length > DIRECTORY_PAGE_SIZE && (
            <div className="mt-5 flex flex-col gap-3 border-t border-gray-800 pt-4 text-xs text-gray-400 md:flex-row md:items-center md:justify-between">
              <p>
                Hiển thị{" "}
                <span className="font-bold text-white">{firstVisibleUserIndex}</span>
                {" - "}
                <span className="font-bold text-white">{lastVisibleUserIndex}</span>
                {" / "}
                <span className="font-bold text-white">
                  {filteredDirectoryUsers.length}
                </span>{" "}
                người dùng
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                  disabled={currentUserPage === 1}
                  className="rounded-lg border border-gray-800 bg-white/5 px-3 py-2 font-bold text-gray-300 transition hover:border-[#FFD166]/50 hover:text-[#FFD166] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Trước
                </button>

                {Array.from({ length: totalUserPages }, (_, index) => index + 1).map(
                  (pageNumber) => {
                    const isActive = pageNumber === currentUserPage;

                    return (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setUserPage(pageNumber)}
                        className={`h-9 min-w-9 rounded-lg border px-3 font-black transition ${
                          isActive
                            ? "border-[#FFD166] bg-[#FFD166] text-black"
                            : "border-gray-800 bg-white/5 text-gray-300 hover:border-[#FFD166]/50 hover:text-[#FFD166]"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  },
                )}

                <button
                  type="button"
                  onClick={() =>
                    setUserPage((page) => Math.min(totalUserPages, page + 1))
                  }
                  disabled={currentUserPage === totalUserPages}
                  className="rounded-lg border border-gray-800 bg-white/5 px-3 py-2 font-bold text-gray-300 transition hover:border-[#FFD166]/50 hover:text-[#FFD166] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* USER DETAIL MODAL */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-[#111C44] p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold">
                Chi Tiết Người Dùng: {selectedUserDetail.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="text-xs font-bold text-gray-400 hover:text-white"
              >
                [Đóng]
              </button>
            </div>

            <div className="my-5 space-y-3 text-xs text-gray-300">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-800 bg-[#0F172A] p-3.5">
                <div>
                  <span className="text-gray-400 block mb-0.5">Mã User ID:</span>
                  <span className="font-mono font-bold text-white">{selectedUserDetail.userId}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Vai trò (Role):</span>
                  <span className="font-bold text-emerald-400">{selectedUserDetail.role}</span>
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-[#0F172A] p-3.5 space-y-2">
                <div>
                  <span className="text-gray-400 block mb-0.5">Họ và Tên:</span>
                  <span className="font-bold text-white text-sm">{selectedUserDetail.fullName}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Email liên hệ:</span>
                  <span className="font-semibold text-white">{selectedUserDetail.email}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Số điện thoại:</span>
                  <span className="font-semibold text-white">{selectedUserDetail.phone}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Rạp phân quyền / Chi nhánh:</span>
                  <span className="font-bold text-cyan-400">{selectedUserDetail.cinemaName}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Ngày khởi tạo tài khoản:</span>
                  <span className="font-semibold text-gray-300">{selectedUserDetail.createdAt}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-gray-800 pt-3">
              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="rounded-xl bg-[#4318FF] px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 transition"
              >
                [Đóng Cửa Sổ]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
