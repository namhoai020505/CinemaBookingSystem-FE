import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  FaCashRegister,
  FaCheckCircle,
  FaMinus,
  FaPlus,
  FaReceipt,
  FaSearch,
  FaShoppingBasket,
  FaSpinner,
  FaTimesCircle,
  FaTrashAlt,
  FaUtensils,
} from 'react-icons/fa';
import { fbItemService, type CinemaFbInventoryItem, type FbFulfillmentResponse } from '../../services/fbItemService';
import { roomService, type RoomResponse } from '../../services/roomService';
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  getApiErrorMessage,
  inputClass,
  PageShell,
  panelClass,
  StatePanel,
  StatusBadge,
} from '../manager/managerUi';

type StaffOutletContext = {
  isLightMode: boolean;
};

type GuestInfo = {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
};

type ScopedCinema = {
  cinemaId: string;
  cinemaName: string;
};

const emptyGuestInfo: GuestInfo = {
  guestName: '',
  guestPhone: '',
  guestEmail: '',
};

const getScopedCinemas = (rooms: RoomResponse[]): ScopedCinema[] => {
  const cinemaMap = new Map<string, string>();

  rooms.forEach((room) => {
    if (room.cinemaId && !cinemaMap.has(room.cinemaId)) {
      cinemaMap.set(room.cinemaId, room.cinemaName || room.cinemaId);
    }
  });

  return Array.from(cinemaMap, ([cinemaId, cinemaName]) => ({ cinemaId, cinemaName }));
};

const CASH_PAYMENT_METHOD = 'Cash';

const parseFormattedNumberInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

const getFormattedNumberInputValue = (value: number) => (value > 0 ? formatNumber(value) : '');

const CounterFbSalesPage = () => {
  const { isLightMode } = useOutletContext<StaffOutletContext>();
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState('');
  const [inventory, setInventory] = useState<CinemaFbInventoryItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [guestInfo, setGuestInfo] = useState<GuestInfo>(emptyGuestInfo);
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loadingScope, setLoadingScope] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scopeError, setScopeError] = useState('');
  const [orderError, setOrderError] = useState('');
  const [orderResult, setOrderResult] = useState<FbFulfillmentResponse | null>(null);

  const scopedCinemas = useMemo(() => getScopedCinemas(rooms), [rooms]);
  const selectedCinema = useMemo(
    () => scopedCinemas.find((cinema) => cinema.cinemaId === selectedCinemaId) ?? null,
    [scopedCinemas, selectedCinemaId],
  );

  const visibleInventory = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return inventory.filter((item) => {
      if (!keyword) {
        return true;
      }

      return item.itemName.toLowerCase().includes(keyword) || item.fbItemId.toLowerCase().includes(keyword);
    });
  }, [inventory, searchKeyword]);

  const cartItems = useMemo(
    () =>
      inventory
        .map((item) => ({
          ...item,
          selectedQuantity: cart[item.fbItemId] || 0,
        }))
        .filter((item) => item.selectedQuantity > 0),
    [cart, inventory],
  );

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.selectedQuantity, 0),
    [cartItems],
  );

  const selectedUnits = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.selectedQuantity, 0),
    [cartItems],
  );

  const changeAmount = useMemo(() => Math.max(0, receivedAmount - cartTotal), [receivedAmount, cartTotal]);

  const clearCart = () => {
    setCart({});
    setOrderError('');
    setReceivedAmount(0);
  };

  const loadInventory = useCallback(async (cinemaId: string) => {
    try {
      setLoadingInventory(true);
      setOrderError('');
      const response = await fbItemService.getCinemaInventory(cinemaId);
      setInventory(response.data ?? []);
      setCart((current) => {
        const availableIds = new Set((response.data ?? []).map((item) => item.fbItemId));
        return Object.fromEntries(
          Object.entries(current).filter(([fbItemId]) => availableIds.has(fbItemId)),
        );
      });
    } catch (error) {
      setInventory([]);
      setOrderError(getApiErrorMessage(error, 'Không tải được tồn kho F&B của rạp này.'));
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadScope = async () => {
      try {
        setLoadingScope(true);
        setScopeError('');
        const data = await roomService.getRooms(false);

        if (!isMounted) {
          return;
        }

        const activeRooms = data ?? [];
        const cinemas = getScopedCinemas(activeRooms);
        const nextCinemaId = cinemas[0]?.cinemaId || '';
        setRooms(activeRooms);
        setSelectedCinemaId(nextCinemaId);

        if (nextCinemaId) {
          await loadInventory(nextCinemaId);
        }
      } catch (error) {
        if (isMounted) {
          setScopeError(getApiErrorMessage(error, 'Không xác định được rạp đang gắn với tài khoản staff.'));
        }
      } finally {
        if (isMounted) {
          setLoadingScope(false);
        }
      }
    };

    void loadScope();

    return () => {
      isMounted = false;
    };
  }, [loadInventory]);

  const handleCinemaChange = (cinemaId: string) => {
    setSelectedCinemaId(cinemaId);
    clearCart();
    setOrderResult(null);

    if (cinemaId) {
      void loadInventory(cinemaId);
    }
  };

  const updateGuestInfo = (field: keyof GuestInfo, value: string) => {
    setGuestInfo((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const setItemQuantity = (item: CinemaFbInventoryItem, nextQuantity: number) => {
    const boundedQuantity = Math.min(Math.max(nextQuantity, 0), item.quantity);

    setCart((current) => {
      const next = { ...current };

      if (boundedQuantity <= 0) {
        delete next[item.fbItemId];
      } else {
        next[item.fbItemId] = boundedQuantity;
      }

      return next;
    });
  };

  const adjustItemQuantity = (item: CinemaFbInventoryItem, delta: number) => {
    setItemQuantity(item, (cart[item.fbItemId] || 0) + delta);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOrderResult(null);

    if (!selectedCinemaId) {
      setOrderError('Tài khoản staff chưa có rạp để tạo đơn F&B tại quầy.');
      return;
    }

    if (cartItems.length === 0) {
      setOrderError('Vui lòng chọn ít nhất một món F&B trước khi tạo đơn.');
      return;
    }

    if (receivedAmount < cartTotal) {
      setOrderError(`Tiền nhận (${formatCurrency(receivedAmount)}) không đủ để thanh toán (${formatCurrency(cartTotal)}).`);
      return;
    }

    try {
      setSubmitting(true);
      setOrderError('');

      const response = await fbItemService.createCounterOrder({
        cinemaId: selectedCinemaId,
        guestName: guestInfo.guestName.trim() || undefined,
        guestPhone: guestInfo.guestPhone.trim() || undefined,
        guestEmail: guestInfo.guestEmail.trim() || undefined,
        items: cartItems.map((item) => ({
          fbItemId: item.fbItemId,
          itemId: item.fbItemId,
          quantity: item.selectedQuantity,
          unitPrice: item.price,
          options: [],
        })),
        totalAmount: cartTotal,
        paymentMethod: CASH_PAYMENT_METHOD,
        receivedAmount,
        changeAmount,
        discountAmount: 0,
      });

      setOrderResult(response.data);
      setGuestInfo(emptyGuestInfo);
      setCart({});
      setReceivedAmount(0);
      await loadInventory(selectedCinemaId);
    } catch (error) {
      setOrderError(getApiErrorMessage(error, 'Không tạo được đơn F&B tại quầy. Vui lòng kiểm tra tồn kho hoặc quyền rạp.'));
    } finally {
      setSubmitting(false);
    }
  };

  const surfaceClass = (soft = false) =>
    [
      'rounded-lg border transition-colors',
      isLightMode
        ? `border-slate-200 ${soft ? 'bg-slate-50' : 'bg-white'}`
        : `border-white/10 ${soft ? 'bg-white/[0.04]' : 'bg-[#0B1220]'}`,
    ].join(' ');

  return (
    <PageShell
      eyebrow="Counter POS"
      title="Bán F&B tại quầy"
      description="Dùng cho trường hợp khách đã mua vé online nhưng đến rạp mới mua thêm bắp nước. Đơn được ghi nhận trực tiếp qua API counter-orders và trừ tồn kho theo chi nhánh."
      isLightMode={isLightMode}
      action={<StatusBadge status={selectedCinema?.cinemaName || 'Staff counter'} />}
    >
      {loadingScope ? (
        <StatePanel
          type="loading"
          title="Đang tải phạm vi rạp"
          description="Đang kiểm tra rạp mà tài khoản staff được phép bán F&B."
          isLightMode={isLightMode}
        />
      ) : scopeError ? (
        <StatePanel
          type="error"
          title="Không tải được phạm vi staff"
          description={scopeError}
          isLightMode={isLightMode}
        />
      ) : scopedCinemas.length === 0 ? (
        <StatePanel
          title="Chưa có rạp để bán F&B"
          description="Tài khoản staff cần được gắn với một rạp đang hoạt động trước khi tạo đơn F&B tại quầy."
          isLightMode={isLightMode}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className={`${panelClass(isLightMode)} overflow-hidden`}>
            <div className={`border-b p-5 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <FaUtensils />
                  </span>
                  <div>
                    <h2 className={`text-lg font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                      Danh sách F&B theo tồn kho
                    </h2>
                    <p className={`mt-1 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Giá và số lượng lấy từ backend, không hard-code ở frontend.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[220px_minmax(240px,1fr)]">
                  <select
                    value={selectedCinemaId}
                    onChange={(event) => handleCinemaChange(event.target.value)}
                    className={inputClass(isLightMode)}
                  >
                    {scopedCinemas.map((cinema) => (
                      <option key={cinema.cinemaId} value={cinema.cinemaId}>
                        {cinema.cinemaName}
                      </option>
                    ))}
                  </select>

                  <label className="relative block">
                    <FaSearch className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`} />
                    <input
                      value={searchKeyword}
                      onChange={(event) => setSearchKeyword(event.target.value)}
                      className={`${inputClass(isLightMode)} pl-9`}
                      placeholder="Tìm món F&B..."
                    />
                  </label>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className={`${surfaceClass(true)} p-4`}>
                  <p className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Món đang bán
                  </p>
                  <p className="mt-2 text-2xl font-black">{formatNumber(inventory.length)}</p>
                </div>
                <div className={`${surfaceClass(true)} p-4`}>
                  <p className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Đã chọn
                  </p>
                  <p className="mt-2 text-2xl font-black">{formatNumber(selectedUnits)}</p>
                </div>
                <div className={`${surfaceClass(true)} p-4`}>
                  <p className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Tạm tính
                  </p>
                  <p className="mt-2 text-2xl font-black text-emerald-400">{formatCurrency(cartTotal)}</p>
                </div>
              </div>
            </div>

            {loadingInventory ? (
              <div className="flex items-center justify-center gap-3 px-5 py-16 text-sm font-black text-emerald-400">
                <FaSpinner className="animate-spin" />
                Đang tải tồn kho F&B...
              </div>
            ) : visibleInventory.length === 0 ? (
              <div className="px-5 py-14">
                <StatePanel
                  title="Không có món F&B phù hợp"
                  description="Thử đổi từ khóa tìm kiếm hoặc kiểm tra tồn kho của chi nhánh hiện tại."
                  isLightMode={isLightMode}
                />
              </div>
            ) : (
              <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-3">
                {visibleInventory.map((item) => {
                  const selectedQuantity = cart[item.fbItemId] || 0;
                  const soldOut = item.quantity <= 0;

                  return (
                    <article key={item.cinemaInventoryId || item.fbItemId} className={`${surfaceClass()} flex min-h-48 flex-col p-4`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className={`line-clamp-2 text-base font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                            {item.itemName}
                          </h3>
                          <p className={`mt-1 break-all text-xs font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {item.fbItemId}
                          </p>
                        </div>
                        <span
                          className={[
                            'shrink-0 rounded-full border px-2.5 py-1 text-xs font-black',
                            soldOut
                              ? 'border-rose-400/30 bg-rose-500/10 text-rose-300'
                              : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
                          ].join(' ')}
                        >
                          {soldOut ? 'Hết hàng' : `Còn ${formatNumber(item.quantity)}`}
                        </span>
                      </div>

                      <div className="mt-auto pt-5">
                        <p className="text-2xl font-black text-amber-300">{formatCurrency(item.price)}</p>
                        <div className="mt-4 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
                          <button
                            type="button"
                            onClick={() => adjustItemQuantity(item, -1)}
                            disabled={selectedQuantity <= 0}
                            className={`grid h-11 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-45 ${
                              isLightMode
                                ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                                : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                            }`}
                            aria-label={`Giảm ${item.itemName}`}
                          >
                            <FaMinus />
                          </button>
                          <input
                            inputMode="numeric"
                            value={getFormattedNumberInputValue(selectedQuantity)}
                            onChange={(event) => setItemQuantity(item, parseFormattedNumberInput(event.target.value))}
                            onFocus={(event) => event.currentTarget.select()}
                            className={`${inputClass(isLightMode)} text-center`}
                            placeholder="0"
                            aria-label={`Số lượng ${item.itemName}`}
                          />
                          <button
                            type="button"
                            onClick={() => adjustItemQuantity(item, 1)}
                            disabled={soldOut || selectedQuantity >= item.quantity}
                            className="grid h-11 place-items-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label={`Thêm ${item.itemName}`}
                          >
                            <FaPlus />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <form onSubmit={handleSubmit} className={`${panelClass(isLightMode)} flex flex-col overflow-hidden`}>
            <div className={`border-b p-5 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300">
                  <FaCashRegister />
                </span>
                <div>
                  <h2 className={`text-lg font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                    Đơn F&B tại quầy
                  </h2>
                  <p className={`mt-1 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Nhập thông tin khách nếu cần lưu nhận diện đơn.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5">
              <label className="grid gap-2">
                <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Tên khách</span>
                <input
                  value={guestInfo.guestName}
                  onChange={(event) => updateGuestInfo('guestName', event.target.value)}
                  className={inputClass(isLightMode)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <label className="grid gap-2">
                  <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Số điện thoại</span>
                  <input
                    value={guestInfo.guestPhone}
                    onChange={(event) => updateGuestInfo('guestPhone', event.target.value)}
                    className={inputClass(isLightMode)}
                    placeholder="Tùy chọn"
                  />
                </label>
                <label className="grid gap-2">
                  <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Email</span>
                  <input
                    type="email"
                    value={guestInfo.guestEmail}
                    onChange={(event) => updateGuestInfo('guestEmail', event.target.value)}
                    className={inputClass(isLightMode)}
                    placeholder="Tùy chọn"
                  />
                </label>
              </div>
            </div>

            <div className={`min-h-0 flex-1 border-y ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
              {cartItems.length === 0 ? (
                <div className="grid min-h-48 place-items-center p-5 text-center">
                  <div>
                    <span className={`mx-auto grid h-12 w-12 place-items-center rounded-lg ${isLightMode ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-slate-300'}`}>
                      <FaShoppingBasket />
                    </span>
                    <p className={`mt-3 text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>Giỏ F&B đang trống</p>
                    <p className={`mt-1 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Chọn bắp nước từ danh sách để tạo đơn tại quầy.
                    </p>
                  </div>
                </div>
              ) : (
                <div className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/10'}`}>
                  {cartItems.map((item) => (
                    <div key={item.fbItemId} className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className={`font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>{item.itemName}</p>
                        <p className={`mt-1 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {formatCurrency(item.price)} x {formatNumber(item.selectedQuantity)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-black text-emerald-400">
                          {formatCurrency(item.price * item.selectedQuantity)}
                        </p>
                        <button
                          type="button"
                          onClick={() => setItemQuantity(item, 0)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-black text-rose-300 transition hover:text-rose-200"
                        >
                          <FaTrashAlt />
                          Bỏ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 p-5">
              <div className="grid gap-2">
                <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Phương thức thanh toán</span>
                <div className={`${inputClass(isLightMode)} flex items-center justify-between gap-3`}>
                  <span>Tiền mặt</span>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black uppercase text-emerald-300">
                    Mặc định
                  </span>
                </div>
              </div>

              <label className="grid gap-2">
                <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Tiền khách đưa (₫)</span>
                <input
                  inputMode="numeric"
                  value={getFormattedNumberInputValue(receivedAmount)}
                  onChange={(event) => setReceivedAmount(parseFormattedNumberInput(event.target.value))}
                  onFocus={(event) => event.currentTarget.select()}
                  className={inputClass(isLightMode)}
                  placeholder="0"
                />
              </label>

              <div className={`${surfaceClass(true)} p-4`}>
                <div className="flex items-center justify-between gap-4">
                  <span className={`text-sm font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Tổng thanh toán
                  </span>
                  <strong className="text-2xl font-black text-amber-300">{formatCurrency(cartTotal)}</strong>
                </div>
                {receivedAmount > 0 && (
                  <div className="mt-3 flex items-center justify-between gap-4 border-t pt-3 border-dashed border-current/20">
                    <span className={`text-sm font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Tiền thừa trả khách
                    </span>
                    <strong className={`text-xl font-black ${changeAmount >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
                      {formatCurrency(changeAmount)}
                    </strong>
                  </div>
                )}
              </div>

              {orderError ? (
                <div className="flex items-start gap-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm font-bold text-rose-200">
                  <FaTimesCircle className="mt-0.5 shrink-0" />
                  <span>{orderError}</span>
                </div>
              ) : null}

              {orderResult ? (
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  <div className="flex items-center gap-2 font-black">
                    <FaCheckCircle />
                    Đã tạo đơn F&B thành công
                  </div>
                  <div className="mt-3 grid gap-2">
                    <p><strong>Mã đơn:</strong> {orderResult.bookingId}</p>
                    <p><strong>Trạng thái:</strong> {orderResult.fbFulfillmentStatus}</p>
                    <p><strong>Thời gian giao món:</strong> {formatDateTime(orderResult.fbFulfilledAt || undefined)}</p>
                    {orderResult.message ? <p><strong>Ghi chú:</strong> {orderResult.message}</p> : null}
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting || cartItems.length === 0}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <FaSpinner className="animate-spin" /> : <FaReceipt />}
                {submitting ? 'Đang tạo đơn...' : 'Xác nhận bán F&B'}
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
};

export default CounterFbSalesPage;
