import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'react-toastify';
import {
  staffService,
  type ApiResponse,
  type AssignableAccountRole,
  type CinemaOption,
  type ProvisionedAccountData,
} from '../../services/staffService';
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
        return { message: data.message, errorCode };
      }
    }
  }

  if ('request' in error) {
    return { message: TEXT.STAFF.ERR_CONNECTION };
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return { message: error.message };
  }

  return { message: TEXT.STAFF.ERR_UNKNOWN };
};

export default function ManageStaff() {
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

    return () => {
      isCurrent = false;
    };
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setInvitation(null);

    if (!selectedRole) {
      const message = TEXT.STAFF.ERR_ROLE_REQUIRED;
      setError(message);
      toast.error(message);
      return;
    }

    if (cinemaIsRequired && !selectedCinemaId) {
      const message = TEXT.STAFF.ERR_CINEMA_REQUIRED;
      setError(message);
      toast.error(message);
      return;
    }

    setIsSubmitting(true);

    try {
      const response: ApiResponse<ProvisionedAccountData> = await staffService.provisionAccount({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        roleId: selectedRole.roleId,
        ...(cinemaIsRequired ? { cinemaId: selectedCinemaId } : {}),
      });

      if (!response.success) {
        const message = response.message || TEXT.STAFF.ERR_UNKNOWN;
        setError(message);
        toast.error(message);
        return;
      }

      setInvitation(
        response.data ?? {
          email: email.trim().toLowerCase(),
          roleId: selectedRole.roleId,
          roleName: selectedRole.roleName,
          cinemaId: selectedCinemaId,
        },
      );
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

  return (
    <div className="min-h-screen bg-[#0A0A0C] p-6 font-['Urbanist'] text-white">
      <div className="mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wider">{TEXT.STAFF.TITLE}</h1>
        <p className="mt-1 text-xs text-gray-400">{TEXT.STAFF.SUBTITLE}</p>
      </div>

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
                {TEXT.STAFF.LABEL_NAME} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={formIsUnavailable}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder={TEXT.STAFF.PLACEHOLDER_NAME}
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
                <option value="">
                  {isLoadingOptions ? TEXT.STAFF.LOADING_ROLES : TEXT.STAFF.PLACEHOLDER_ROLE}
                </option>
                {staffRoles.map((role) => (
                  <option key={role.roleId} value={role.roleId}>
                    {formatRoleName(role.roleName)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                {TEXT.STAFF.LABEL_CINEMA} <span className="text-red-500">*</span>
              </label>
              <div
                className="relative"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsCinemaMenuOpen(false);
                  }
                }}
              >
                <input
                  type="text"
                  required={cinemaIsRequired}
                  disabled={formIsUnavailable || !cinemaIsRequired}
                  value={cinemaInputValue}
                  onFocus={() => {
                    setCinemaQuery('');
                    setIsCinemaMenuOpen(true);
                  }}
                  onChange={(event) => {
                    setCinemaQuery(event.target.value);
                    setSelectedCinemaId('');
                    setIsCinemaMenuOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setIsCinemaMenuOpen(false);
                    }

                    if (event.key === 'Enter' && isCinemaMenuOpen && matchingCinemas[0]) {
                      event.preventDefault();
                      selectCinema(matchingCinemas[0]);
                    }
                  }}
                  placeholder={
                    cinemaIsRequired
                      ? TEXT.STAFF.PLACEHOLDER_CINEMA
                      : TEXT.STAFF.HINT_SELECT_ROLE_FIRST
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
    </div>
  );
}
