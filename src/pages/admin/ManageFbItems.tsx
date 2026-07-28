import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FaBoxes,
  FaCheckCircle,
  FaEdit,
  FaPlus,
  FaSave,
  FaSearch,
  FaSpinner,
  FaStore,
  FaSyncAlt,
  FaTimes,
  FaTrashAlt,
  FaUtensils,
} from 'react-icons/fa';
import { confirmWithPopup } from '../../services/confirmDialogService';
import { cinemaService, type CinemaResponse } from '../../services/cinemaService';
import {
  fbItemService,
  type CinemaFbInventoryItem,
  type FbItem,
  type UpdateFbItemPayload,
} from '../../services/fbItemService';
import { managerService } from '../../services/managerService';
import type { RoomResponse } from '../../services/roomService';
import {
  formatCurrency,
  formatNumber,
  getApiErrorMessage,
  inputClass,
  PageShell,
  panelClass,
  StatePanel,
} from '../manager/managerUi';

type LayoutContext = {
  isLightMode: boolean;
};

type ActiveTab = 'catalog' | 'inventory';
type ItemStatusFilter = 'ALL' | 'AVAILABLE' | 'INACTIVE';

type InventoryRow = FbItem & {
  cinemaInventoryId?: string;
  cinemaId: string;
  quantity: number;
  hasInventory: boolean;
};

const ITEM_STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Đang bán' },
  { value: 'INACTIVE', label: 'Ngừng bán' },
] as const;

const getScopedCinemas = (rooms: RoomResponse[]): CinemaResponse[] => {
  const cinemaMap = new Map<string, CinemaResponse>();

  rooms.forEach((room) => {
    if (!room.cinemaId || cinemaMap.has(room.cinemaId)) {
      return;
    }

    cinemaMap.set(room.cinemaId, {
      cinemaId: room.cinemaId,
      cinemaName: room.cinemaName || room.cinemaId,
      address: '',
      city: '',
      cinemaStatus: 'ACTIVE',
    });
  });

  return Array.from(cinemaMap.values());
};

const getStatusLabel = (status: string) => {
  const normalized = status?.toUpperCase();
  if (normalized === 'AVAILABLE') return 'Đang bán';
  if (normalized === 'INACTIVE') return 'Ngừng bán';
  return status || 'Không rõ';
};

const statusBadgeClass = (status: string) => {
  const normalized = status?.toUpperCase();
  if (normalized === 'AVAILABLE') {
    return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300';
  }

  if (normalized === 'INACTIVE') {
    return 'border-rose-400/30 bg-rose-500/10 text-rose-300';
  }

  return 'border-slate-400/30 bg-slate-500/10 text-slate-300';
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-black uppercase ${statusBadgeClass(status)}`}>
    {getStatusLabel(status)}
  </span>
);

const getStockLabel = (quantity: number) => {
  if (quantity <= 0) return 'Hết hàng';
  if (quantity < 20) return 'Sắp hết';
  return 'Đủ hàng';
};

const stockBadgeClass = (quantity: number) => {
  if (quantity <= 0) return 'border-rose-400/30 bg-rose-500/10 text-rose-300';
  if (quantity < 20) return 'border-amber-400/30 bg-amber-500/10 text-amber-300';
  return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300';
};

const StatCard = ({
  icon,
  label,
  value,
  note,
  isLightMode,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  isLightMode: boolean;
}) => (
  <section className={`${panelClass(isLightMode)} flex min-h-28 items-center gap-4 p-4`}>
    <div
      className={[
        'grid h-12 w-12 shrink-0 place-items-center rounded-lg text-lg',
        isLightMode ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-300',
      ].join(' ')}
    >
      {icon}
    </div>
    <div className="min-w-0">
      <p className={`text-[11px] font-black uppercase tracking-[0.14em] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
        {label}
      </p>
      <strong className={`mt-1 block truncate text-2xl font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
        {value}
      </strong>
      <p className={`mt-1 text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
        {note}
      </p>
    </div>
  </section>
);

const EmptyCell = ({ children = null }: { children?: ReactNode }) => (
  <td className="px-4 py-4 text-sm font-semibold text-slate-500">{children}</td>
);

const parseFormattedNumberInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

const getFormattedNumberInputValue = (value: number) => (value > 0 ? formatNumber(value) : '');

export default function ManageFbItems() {
  const { isLightMode } = useOutletContext<LayoutContext>();
  const location = useLocation();
  const isAdminMode = location.pathname.startsWith('/admin');

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => (isAdminMode ? 'catalog' : 'inventory'));
  const [catalogItems, setCatalogItems] = useState<FbItem[]>([]);
  const [cinemas, setCinemas] = useState<CinemaResponse[]>([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState('');
  const [inventory, setInventory] = useState<CinemaFbInventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatusFilter>('ALL');
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingScope, setLoadingScope] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FbItem | null>(null);
  const [formItemName, setFormItemName] = useState('');
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formStatus, setFormStatus] = useState('AVAILABLE');
  const [submittingItem, setSubmittingItem] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<InventoryRow | null>(null);
  const [stockQuantity, setStockQuantity] = useState<number>(0);
  const [submittingStock, setSubmittingStock] = useState(false);

  const selectedCinema = useMemo(
    () => cinemas.find((cinema) => cinema.cinemaId === selectedCinemaId) ?? null,
    [cinemas, selectedCinemaId],
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleCatalogItems = useMemo(
    () =>
      catalogItems.filter((item) => {
        const matchesSearch =
          !normalizedSearch ||
          item.itemName.toLowerCase().includes(normalizedSearch) ||
          item.fbItemId.toLowerCase().includes(normalizedSearch);
        const matchesStatus = statusFilter === 'ALL' || item.itemStatus === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [catalogItems, normalizedSearch, statusFilter],
  );

  const inventoryRows = useMemo<InventoryRow[]>(() => {
    const inventoryMap = new Map(inventory.map((item) => [item.fbItemId, item]));

    return catalogItems
      .filter((item) => isAdminMode || item.itemStatus === 'AVAILABLE')
      .map((item) => {
        const stock = inventoryMap.get(item.fbItemId);
        return {
          ...item,
          cinemaInventoryId: stock?.cinemaInventoryId,
          cinemaId: selectedCinemaId,
          quantity: stock?.quantity ?? 0,
          hasInventory: Boolean(stock),
        };
      });
  }, [catalogItems, inventory, isAdminMode, selectedCinemaId]);

  const visibleInventoryRows = useMemo(
    () =>
      inventoryRows.filter((item) => {
        const matchesSearch =
          !normalizedSearch ||
          item.itemName.toLowerCase().includes(normalizedSearch) ||
          item.fbItemId.toLowerCase().includes(normalizedSearch);
        const matchesStatus = statusFilter === 'ALL' || item.itemStatus === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [inventoryRows, normalizedSearch, statusFilter],
  );

  const activeItemCount = catalogItems.filter((item) => item.itemStatus === 'AVAILABLE').length;
  const totalInventoryUnits = inventoryRows.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockCount = inventoryRows.filter((item) => item.quantity > 0 && item.quantity < 20).length;
  const outOfStockCount = inventoryRows.filter((item) => item.quantity <= 0).length;

  const loadCatalog = useCallback(async () => {
    try {
      setLoadingCatalog(true);
      const response = isAdminMode
        ? await fbItemService.getAllForAdmin()
        : await fbItemService.getActiveItems();
      setCatalogItems(response.data ?? []);
    } catch (error) {
      setCatalogItems([]);
      toast.error(getApiErrorMessage(error, 'Không tải được danh mục F&B.'));
    } finally {
      setLoadingCatalog(false);
    }
  }, [isAdminMode]);

  const loadScope = useCallback(async () => {
    try {
      setLoadingScope(true);
      const nextCinemas = isAdminMode
        ? await cinemaService.getCinemas()
        : getScopedCinemas(await managerService.getRooms());

      setCinemas(nextCinemas);
      setSelectedCinemaId((current) => {
        if (current && nextCinemas.some((cinema) => cinema.cinemaId === current)) {
          return current;
        }

        const activeCinema = nextCinemas.find((cinema) => cinema.cinemaStatus !== 'INACTIVE');
        return activeCinema?.cinemaId || nextCinemas[0]?.cinemaId || '';
      });
    } catch (error) {
      setCinemas([]);
      setSelectedCinemaId('');
      toast.error(getApiErrorMessage(error, 'Không tải được danh sách rạp cho quản lý F&B.'));
    } finally {
      setLoadingScope(false);
    }
  }, [isAdminMode]);

  const loadInventory = useCallback(async (cinemaId: string) => {
    if (!cinemaId) {
      setInventory([]);
      return;
    }

    try {
      setLoadingInventory(true);
      const response = await fbItemService.getCinemaInventory(cinemaId);
      setInventory(response.data ?? []);
    } catch (error) {
      setInventory([]);
      toast.error(getApiErrorMessage(error, 'Không tải được tồn kho F&B của rạp này.'));
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCatalog();
      void loadScope();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadCatalog, loadScope]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadInventory(selectedCinemaId);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadInventory, selectedCinemaId]);

  const reloadAll = async () => {
    await Promise.all([loadCatalog(), loadScope()]);
    if (selectedCinemaId) {
      await loadInventory(selectedCinemaId);
    }
  };

  const openCreateItemModal = () => {
    if (!isAdminMode) {
      toast.warn('Manager chỉ được quản lý tồn kho theo rạp, không được tạo danh mục món F&B.');
      return;
    }

    setEditingItem(null);
    setFormItemName('');
    setFormPrice(0);
    setFormStatus('AVAILABLE');
    setItemModalOpen(true);
  };

  const openEditItemModal = (item: FbItem) => {
    if (!isAdminMode) {
      toast.warn('Manager chỉ được quản lý tồn kho theo rạp, không được sửa danh mục món F&B.');
      return;
    }

    setEditingItem(item);
    setFormItemName(item.itemName);
    setFormPrice(item.price);
    setFormStatus(item.itemStatus || 'AVAILABLE');
    setItemModalOpen(true);
  };

  const closeItemModal = () => {
    setItemModalOpen(false);
    setEditingItem(null);
  };

  const handleSaveItem = async (event: FormEvent) => {
    event.preventDefault();

    if (!formItemName.trim()) {
      toast.warn('Vui lòng nhập tên món F&B.');
      return;
    }

    if (formPrice < 0) {
      toast.warn('Giá bán không được nhỏ hơn 0.');
      return;
    }

    try {
      setSubmittingItem(true);

      if (editingItem) {
        const payload: UpdateFbItemPayload = {
          itemName: formItemName.trim(),
          price: formPrice,
          itemStatus: formStatus,
        };
        await fbItemService.updateItem(editingItem.fbItemId, payload);
        toast.success('Đã cập nhật món F&B.');
      } else {
        await fbItemService.createItem({
          itemName: formItemName.trim(),
          price: formPrice,
          itemStatus: formStatus,
        });
        toast.success('Đã tạo món F&B mới.');
      }

      closeItemModal();
      await loadCatalog();
      if (selectedCinemaId) {
        await loadInventory(selectedCinemaId);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không lưu được món F&B.'));
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleDeactivateItem = async (item: FbItem) => {
    const confirmed = await confirmWithPopup({
      title: 'Ngừng bán món F&B?',
      message: `Món "${item.itemName}" sẽ bị chuyển sang trạng thái ngừng bán và không hiển thị cho khách mua nữa.`,
      confirmLabel: 'Ngừng bán',
      cancelLabel: 'Giữ lại',
    });

    if (!confirmed) {
      return;
    }

    try {
      await fbItemService.deactivateItem(item.fbItemId);
      toast.success(`Đã ngừng bán "${item.itemName}".`);
      await loadCatalog();
      if (selectedCinemaId) {
        await loadInventory(selectedCinemaId);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể ngừng bán món F&B này.'));
    }
  };

  const openStockModal = (row: InventoryRow) => {
    if (!selectedCinemaId) {
      toast.warn('Vui lòng chọn rạp trước khi cập nhật tồn kho.');
      return;
    }

    setEditingStock(row);
    setStockQuantity(row.quantity);
    setStockModalOpen(true);
  };

  const closeStockModal = () => {
    setStockModalOpen(false);
    setEditingStock(null);
  };

  const handleSaveStock = async (event: FormEvent) => {
    event.preventDefault();

    if (!editingStock || !selectedCinemaId) {
      toast.warn('Vui lòng chọn món F&B và rạp cần cập nhật.');
      return;
    }

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      toast.warn('Số lượng tồn kho phải là số nguyên không âm.');
      return;
    }

    try {
      setSubmittingStock(true);
      await fbItemService.updateCinemaInventory({
        cinemaId: selectedCinemaId,
        fbItemId: editingStock.fbItemId,
        quantity: stockQuantity,
      });
      toast.success(`Đã cập nhật tồn kho "${editingStock.itemName}" tại ${selectedCinema?.cinemaName || selectedCinemaId}.`);
      closeStockModal();
      await loadInventory(selectedCinemaId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể cập nhật tồn kho F&B.'));
    } finally {
      setSubmittingStock(false);
    }
  };

  const controls = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="min-w-0 flex-1">
        <label className={`mb-2 block text-[11px] font-black uppercase tracking-[0.14em] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Tìm món F&B
        </label>
        <div className="relative">
          <FaSearch className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className={`${inputClass(isLightMode)} pl-9`}
            placeholder="Tìm theo tên món hoặc mã F&B..."
          />
        </div>
      </div>

      <div className="w-full lg:w-52">
        <label className={`mb-2 block text-[11px] font-black uppercase tracking-[0.14em] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Trạng thái
        </label>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as ItemStatusFilter)}
          className={inputClass(isLightMode)}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="AVAILABLE">Đang bán</option>
          <option value="INACTIVE">Ngừng bán</option>
        </select>
      </div>

      <button
        type="button"
        onClick={() => void reloadAll()}
        className={[
          'inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-black transition',
          isLightMode
            ? 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700'
            : 'border-white/10 bg-white/5 text-slate-200 hover:border-emerald-400/40 hover:text-white',
        ].join(' ')}
      >
        <FaSyncAlt />
        Làm mới
      </button>
    </div>
  );

  const isLoadingPage = loadingCatalog || loadingScope;

  return (
    <PageShell
      eyebrow={isAdminMode ? 'Food & Beverage Master Data' : 'Food & Beverage Inventory'}
      title={isAdminMode ? 'Quản lý F&B toàn hệ thống' : 'Quản lý F&B của rạp'}
      description={
        isAdminMode
          ? 'Admin quản lý danh mục món F&B, trạng thái bán và tồn kho từng chi nhánh.'
          : 'Manager theo dõi danh mục F&B đang bán và cập nhật số lượng tồn kho trong phạm vi rạp được phân quyền.'
      }
      isLightMode={isLightMode}
      action={
        isAdminMode ? (
          <button
            type="button"
            onClick={openCreateItemModal}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 px-5 text-sm font-black text-white shadow-lg shadow-emerald-950/20 transition hover:brightness-110"
          >
            <FaPlus />
            Thêm món F&B
          </button>
        ) : null
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FaUtensils />}
          label="Tổng món"
          value={formatNumber(catalogItems.length)}
          note={`${formatNumber(activeItemCount)} món đang bán`}
          isLightMode={isLightMode}
        />
        <StatCard
          icon={<FaStore />}
          label="Rạp đang chọn"
          value={selectedCinema?.cinemaName || 'Chưa chọn'}
          note={isAdminMode ? `${formatNumber(cinemas.length)} rạp trong hệ thống` : 'Scope theo tài khoản manager'}
          isLightMode={isLightMode}
        />
        <StatCard
          icon={<FaBoxes />}
          label="Tổng tồn kho"
          value={formatNumber(totalInventoryUnits)}
          note="Tính theo rạp đang chọn"
          isLightMode={isLightMode}
        />
        <StatCard
          icon={<FaCheckCircle />}
          label="Cảnh báo kho"
          value={formatNumber(lowStockCount + outOfStockCount)}
          note={`${formatNumber(outOfStockCount)} hết hàng, ${formatNumber(lowStockCount)} sắp hết`}
          isLightMode={isLightMode}
        />
      </div>

      <section className={`${panelClass(isLightMode)} p-4`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className={[
                'inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-black transition',
                activeTab === 'catalog'
                  ? 'border-emerald-400 bg-emerald-500 text-white'
                  : isLightMode
                    ? 'border-slate-200 bg-white text-slate-600 hover:text-slate-950'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:text-white',
              ].join(' ')}
            >
              <FaUtensils />
              Danh mục món
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={[
                'inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-black transition',
                activeTab === 'inventory'
                  ? 'border-emerald-400 bg-emerald-500 text-white'
                  : isLightMode
                    ? 'border-slate-200 bg-white text-slate-600 hover:text-slate-950'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:text-white',
              ].join(' ')}
            >
              <FaBoxes />
              Tồn kho theo rạp
            </button>
          </div>

          <div className="min-w-0 flex-1 xl:max-w-4xl">{controls}</div>
        </div>

        {activeTab === 'inventory' && (
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <label className={`mb-2 block text-[11px] font-black uppercase tracking-[0.14em] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Rạp áp dụng tồn kho
              </label>
              <select
                value={selectedCinemaId}
                onChange={(event) => setSelectedCinemaId(event.target.value)}
                disabled={!isAdminMode && cinemas.length <= 1}
                className={inputClass(isLightMode)}
              >
                <option value="">Chọn rạp</option>
                {cinemas.map((cinema) => (
                  <option key={cinema.cinemaId} value={cinema.cinemaId}>
                    {cinema.cinemaName} ({cinema.cinemaId})
                  </option>
                ))}
              </select>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-xs font-semibold ${isLightMode ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-white/10 bg-white/5 text-slate-400'}`}>
              {isAdminMode
                ? 'Admin có thể chọn từng chi nhánh để cập nhật tồn kho.'
                : 'Manager chỉ thao tác trong phạm vi rạp đã được gắn với tài khoản.'}
            </div>
          </div>
        )}
      </section>

      {isLoadingPage ? (
        <StatePanel
          type="loading"
          title="Đang tải dữ liệu F&B"
          description="Hệ thống đang lấy danh mục món, rạp và tồn kho liên quan."
          isLightMode={isLightMode}
        />
      ) : activeTab === 'catalog' ? (
        <section className={`${panelClass(isLightMode)} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className={isLightMode ? 'bg-slate-50 text-slate-500' : 'bg-white/[0.03] text-slate-400'}>
                <tr className="text-[11px] font-black uppercase tracking-[0.14em]">
                  <th className="px-4 py-4">Món F&B</th>
                  <th className="px-4 py-4">Giá bán</th>
                  <th className="px-4 py-4">Trạng thái</th>
                  <th className="px-4 py-4">Vai trò thao tác</th>
                  <th className="px-4 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLightMode ? 'divide-slate-100' : 'divide-white/10'}`}>
                {visibleCatalogItems.length === 0 ? (
                  <tr>
                    <EmptyCell>Không có món F&B phù hợp bộ lọc.</EmptyCell>
                    <EmptyCell />
                    <EmptyCell />
                    <EmptyCell />
                    <EmptyCell />
                  </tr>
                ) : (
                  visibleCatalogItems.map((item) => (
                    <tr key={item.fbItemId} className={isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${isLightMode ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-300'}`}>
                            <FaUtensils />
                          </div>
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                              {item.itemName}
                            </p>
                            <p className="mt-1 truncate font-mono text-xs font-semibold text-slate-500">
                              {item.fbItemId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-4 text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                        {formatCurrency(item.price)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={item.itemStatus} />
                      </td>
                      <td className={`px-4 py-4 text-sm font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {isAdminMode ? 'Admin quản lý catalog' : 'Manager xem catalog đang bán'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {isAdminMode ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditItemModal(item)}
                                className="inline-flex h-9 items-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 text-xs font-black text-cyan-300 transition hover:bg-cyan-500/20"
                              >
                                <FaEdit />
                                Sửa
                              </button>
                              {item.itemStatus !== 'INACTIVE' && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeactivateItem(item)}
                                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 text-xs font-black text-rose-300 transition hover:bg-rose-500/20"
                                >
                                  <FaTrashAlt />
                                  Ngừng bán
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-slate-500">Không có quyền sửa catalog</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : !selectedCinemaId ? (
        <StatePanel
          type="empty"
          title="Chưa xác định được rạp"
          description="Tài khoản cần có rạp/phòng đang hoạt động trước khi cập nhật tồn kho F&B."
          isLightMode={isLightMode}
        />
      ) : (
        <section className={`${panelClass(isLightMode)} overflow-hidden`}>
          <div className={`flex flex-col gap-2 border-b px-4 py-4 md:flex-row md:items-center md:justify-between ${isLightMode ? 'border-slate-100' : 'border-white/10'}`}>
            <div>
              <p className={`text-[11px] font-black uppercase tracking-[0.14em] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Tồn kho F&B
              </p>
              <h2 className={`mt-1 text-lg font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                {selectedCinema?.cinemaName || selectedCinemaId}
              </h2>
            </div>
            {loadingInventory && (
              <span className="inline-flex items-center gap-2 text-xs font-black uppercase text-emerald-400">
                <FaSpinner className="animate-spin" />
                Đang tải tồn kho
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className={isLightMode ? 'bg-slate-50 text-slate-500' : 'bg-white/[0.03] text-slate-400'}>
                <tr className="text-[11px] font-black uppercase tracking-[0.14em]">
                  <th className="px-4 py-4">Món F&B</th>
                  <th className="px-4 py-4">Giá bán</th>
                  <th className="px-4 py-4">Số lượng tồn</th>
                  <th className="px-4 py-4">Trạng thái kho</th>
                  <th className="px-4 py-4">Bản ghi kho</th>
                  <th className="px-4 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLightMode ? 'divide-slate-100' : 'divide-white/10'}`}>
                {visibleInventoryRows.length === 0 ? (
                  <tr>
                    <EmptyCell>Không có món F&B phù hợp bộ lọc.</EmptyCell>
                    <EmptyCell />
                    <EmptyCell />
                    <EmptyCell />
                    <EmptyCell />
                    <EmptyCell />
                  </tr>
                ) : (
                  visibleInventoryRows.map((item) => (
                    <tr key={item.fbItemId} className={isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${isLightMode ? 'bg-cyan-50 text-cyan-700' : 'bg-cyan-500/10 text-cyan-300'}`}>
                            <FaBoxes />
                          </div>
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                              {item.itemName}
                            </p>
                            <p className="mt-1 truncate font-mono text-xs font-semibold text-slate-500">
                              {item.fbItemId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-4 text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                        {formatCurrency(item.price)}
                      </td>
                      <td className={`px-4 py-4 text-xl font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                        {formatNumber(item.quantity)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-black uppercase ${stockBadgeClass(item.quantity)}`}>
                          {getStockLabel(item.quantity)}
                        </span>
                      </td>
                      <td className={`px-4 py-4 text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {item.hasInventory ? item.cinemaInventoryId : 'Chưa có bản ghi, lưu tồn kho để tạo'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => openStockModal(item)}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 text-xs font-black text-emerald-300 transition hover:bg-emerald-500/20"
                          >
                            <FaSave />
                            Cập nhật tồn
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {itemModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={(event) => void handleSaveItem(event)}
            className={`${panelClass(isLightMode)} w-full max-w-xl overflow-hidden`}
          >
            <div className={`flex items-center justify-between border-b px-5 py-4 ${isLightMode ? 'border-slate-100' : 'border-white/10'}`}>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-400">
                  {editingItem ? 'Cập nhật danh mục' : 'Tạo món F&B'}
                </p>
                <h3 className={`mt-1 text-xl font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                  {editingItem ? editingItem.itemName : 'Món F&B mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeItemModal}
                className={`grid h-10 w-10 place-items-center rounded-lg border ${isLightMode ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-300'}`}
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className={`mb-2 block text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Tên món F&B
                </label>
                <input
                  value={formItemName}
                  onChange={(event) => setFormItemName(event.target.value)}
                  className={inputClass(isLightMode)}
                  placeholder="VD: Combo bắp caramel + pepsi"
                  maxLength={255}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={`mb-2 block text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Giá bán
                  </label>
                  <input
                    value={getFormattedNumberInputValue(formPrice)}
                    onChange={(event) => setFormPrice(parseFormattedNumberInput(event.target.value))}
                    onFocus={(event) => event.currentTarget.select()}
                    className={inputClass(isLightMode)}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className={`mb-2 block text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Trạng thái
                  </label>
                  <select
                    value={formStatus}
                    onChange={(event) => setFormStatus(event.target.value)}
                    className={inputClass(isLightMode)}
                  >
                    {ITEM_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={`flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:justify-end ${isLightMode ? 'border-slate-100' : 'border-white/10'}`}>
              <button
                type="button"
                onClick={closeItemModal}
                className={`h-11 rounded-lg border px-5 text-sm font-black ${isLightMode ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-300'}`}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submittingItem}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 px-5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingItem ? <FaSpinner className="animate-spin" /> : <FaSave />}
                {editingItem ? 'Lưu thay đổi' : 'Tạo món'}
              </button>
            </div>
          </form>
        </div>
      )}

      {stockModalOpen && editingStock && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={(event) => void handleSaveStock(event)}
            className={`${panelClass(isLightMode)} w-full max-w-lg overflow-hidden`}
          >
            <div className={`flex items-center justify-between border-b px-5 py-4 ${isLightMode ? 'border-slate-100' : 'border-white/10'}`}>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-400">
                  Cập nhật tồn kho
                </p>
                <h3 className={`mt-1 text-xl font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                  {editingStock.itemName}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeStockModal}
                className={`grid h-10 w-10 place-items-center rounded-lg border ${isLightMode ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-300'}`}
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${isLightMode ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-white/10 bg-white/5 text-slate-300'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span>Rạp</span>
                  <strong className={isLightMode ? 'text-slate-950' : 'text-white'}>
                    {selectedCinema?.cinemaName || selectedCinemaId}
                  </strong>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>Giá bán</span>
                  <strong className={isLightMode ? 'text-slate-950' : 'text-white'}>
                    {formatCurrency(editingStock.price)}
                  </strong>
                </div>
              </div>

              <div>
                <label className={`mb-2 block text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Số lượng tồn kho
                </label>
                <input
                  value={getFormattedNumberInputValue(stockQuantity)}
                  onChange={(event) => setStockQuantity(parseFormattedNumberInput(event.target.value))}
                  onFocus={(event) => event.currentTarget.select()}
                  className={inputClass(isLightMode)}
                  inputMode="numeric"
                  placeholder="0"
                />
                <p className={`mt-2 text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Nhập 0 nếu món đang hết tại rạp. API sẽ tạo bản ghi tồn kho nếu món chưa từng có trong rạp này.
                </p>
              </div>
            </div>

            <div className={`flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:justify-end ${isLightMode ? 'border-slate-100' : 'border-white/10'}`}>
              <button
                type="button"
                onClick={closeStockModal}
                className={`h-11 rounded-lg border px-5 text-sm font-black ${isLightMode ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-300'}`}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submittingStock}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingStock ? <FaSpinner className="animate-spin" /> : <FaSave />}
                Lưu tồn kho
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}
