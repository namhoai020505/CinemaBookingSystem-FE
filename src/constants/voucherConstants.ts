export const VOUCHER_CATEGORIES = {
  EVENT: {
    key: 'EVENT',
    label: 'Sự kiện',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  FOOD_BEVERAGE: {
    key: 'FOOD_BEVERAGE',
    label: 'Bắp nước',
    badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  },
  COMPENSATION: {
    key: 'COMPENSATION',
    label: 'Đền bù sự cố',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
} as const;

export const APPLICABLE_SCOPES = {
  TOTAL_ORDER: {
    key: 'TOTAL_ORDER',
    label: 'Toàn đơn hàng',
    badgeClass: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  },
  TICKET_ONLY: {
    key: 'TICKET_ONLY',
    label: 'Chỉ Vé xem phim',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  },
  FOOD_BEVERAGE_ONLY: {
    key: 'FOOD_BEVERAGE_ONLY',
    label: 'Chỉ Bắp nước',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
} as const;

export const TARGET_TYPES = {
  ALL_CUSTOMERS: {
    key: 'ALL_CUSTOMERS',
    label: 'Tất cả khách hàng (Công khai)',
  },
  SPECIFIC_CUSTOMERS: {
    key: 'SPECIFIC_CUSTOMERS',
    label: 'Khách hàng chỉ định',
  },
} as const;

export const VOUCHER_MESSAGES = {
  CODE_REQUIRED: 'Mã voucher không được để trống.',
  DISCOUNT_VAL_INVALID: 'Giá trị giảm giá phải lớn hơn 0.',
  PERCENT_LIMIT: 'Giá trị giảm phần trăm không được quá 100%.',
  DATES_REQUIRED: 'Vui lòng nhập đầy đủ thời gian bắt đầu và kết thúc.',
  DATE_RANGE_INVALID: 'Thời gian bắt đầu phải diễn ra trước thời gian kết thúc.',
  SAVE_SUCCESS: 'Lưu voucher thành công.',
  SAVE_FAILED: 'Có lỗi xảy ra khi lưu thông tin voucher.',
  DELETE_SUCCESS: 'Xóa voucher thành công.',
  DELETE_FAILED: 'Xóa voucher thất bại.',
  ISSUE_SUCCESS: 'Đã phát voucher đền bù thành công.',
  ISSUE_FAILED: 'Phát voucher đền bù thất bại.',
  CLAIM_SUCCESS: 'Đã lưu voucher vào ví cá nhân thành công.',
  CLAIM_FAILED: 'Không thể lưu voucher vào ví.',
} as const;
