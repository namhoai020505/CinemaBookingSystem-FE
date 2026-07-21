export const TEXT = {
  SHOWTIME: {
    TITLE: "Quản Lý Lịch Chiếu",
    SUBTITLE: "Nắm kéo phim thả vào khung giờ để sắp xếp lịch chiếu trực quan",
    SYNCING: "Đang đồng bộ dữ liệu lịch chiếu...",
    
    // Filters & Warnings
    NO_CINEMAS: "Không có rạp nào",
    PAST_DATE_WARNING: "Ngày đã qua — chỉ xem, không thể chỉnh sửa lịch",
    UNSAVED_CHANGES_WARNING: "⚠️ Có thay đổi chưa lưu",
    DEFAULT_TICKET_PRICE: "Giá vé mặc định:",
    
    // Actions
    BTN_SAVING: "Đang lưu...",
    BTN_SAVE_SCHEDULE: "💾 Lưu Lịch Chiếu",
    BTN_CANCEL: "Hủy",
    
    // Timeline
    NO_ROOMS_TITLE: "Không có phòng chiếu",
    NO_ROOMS_DESC: "Rạp này chưa có phòng chiếu nào hoạt động, hoặc chưa chọn rạp.",
    HEADER_ROOM_TIME: "Phòng / Giờ",
    SEAT_COUNT: "ghế",
    
    // Sidebar
    UNSCHEDULED_MOVIES_TITLE: "Phim Chưa Xếp Lịch",
    NO_UNSCHEDULED_MOVIES: "Không có phim nào chờ xếp lịch",
    DURATION_LABEL: "Thời lượng:",
    MINUTES: "phút",

    // Confirms & Alerts
    CONFIRM_NAVIGATE_AWAY: "⚠️ Bạn có thay đổi lịch chiếu chưa lưu. Nếu chuyển trang bây giờ, tất cả thay đổi sẽ bị mất.\n\nBấm OK để tiếp tục chuyển trang, Hủy để ở lại và lưu lịch chiếu.",
    BEFORE_UNLOAD: "Bạn có các thay đổi chưa lưu trên lịch chiếu. Nếu rời đi, các thay đổi này sẽ bị mất.",
    CONFIRM_CANCEL_CHANGES: "⚠️ Bạn có chắc chắn muốn hủy bỏ toàn bộ các thay đổi chưa lưu trên lịch chiếu này không?",
    CONFIRM_CHANGE_CINEMA: "⚠️ Bạn có các thay đổi chưa lưu trên lịch chiếu. Đổi rạp chiếu sẽ làm mất các thay đổi này. Tiếp tục?",
    CONFIRM_CHANGE_DATE: "⚠️ Bạn có các thay đổi chưa lưu trên lịch chiếu. Đổi ngày sẽ làm mất các thay đổi này. Tiếp tục?",

    // Toasts - Success & Info
    TOAST_TEMP_DELETED: "Đã xóa suất chiếu khỏi lịch tạm thời.",
    TOAST_RESTORED_ORIGINAL: "Đã khôi phục lịch chiếu ban đầu.",
    
    // Toasts - Errors
    ERR_FETCH_CINEMAS: "Không thể tải danh sách rạp chiếu.",
    ERR_FETCH_ROOMS: "Không thể tải danh sách phòng chiếu.",
    ERR_FETCH_MOVIES: "Không thể tải danh sách phim.",
    ERR_FETCH_SHOWTIMES: "Không thể tải lịch chiếu.",
    ERR_PAST_DATE_SAVE: "❌ Không thể lưu lịch chiếu cho ngày đã qua. Vui lòng chọn ngày hôm nay hoặc tương lai.",
    ERR_GENERIC_SAVE: "Lưu lịch chiếu thất bại. Vui lòng thử lại.",
    
    // Backend API Error Messages
    BE_ERRORS: {
      SHOWTIME_OVERLAP: "❌ Suất chiếu bị trùng lấp thời gian với suất chiếu khác trong cùng phòng!",
      RESOURCE_HAS_BOOKINGS: "❌ Suất chiếu đã có người đặt vé, không thể di chuyển hoặc xóa.",
      INVALID_START_TIME: "❌ Giờ chiếu phải là thời gian trong tương lai. Kiểm tra lại ngày và giờ đã chọn.",
      INVALID_BASE_PRICE: "❌ Giá vé phải lớn hơn 0. Vui lòng kiểm tra giá vé suất chiếu.",
      ROOM_HAS_NO_SEATS: "❌ Phòng chiếu đích chưa có ghế hoạt động nào.",
      MOVIE_NOT_SELLABLE: "❌ Phim này không còn được phép xếp lịch (có thể đã bị ẩn hoặc ngừng chiếu).",
      ROOM_NOT_AVAILABLE: "❌ Phòng chiếu hoặc rạp hiện không ở trạng thái hoạt động.",
      PAST_SHOWTIME: "❌ Không thể xóa suất chiếu đã diễn ra hoặc đã hoàn thành.",
      MOVIE_NOT_FOUND: "❌ Không tìm thấy phim. Có thể phim đã bị xóa khỏi hệ thống.",
      ROOM_NOT_FOUND: "❌ Không tìm thấy phòng chiếu.",
      SHOWTIME_NOT_FOUND: "❌ Không tìm thấy suất chiếu (có thể đã bị xóa bởi người khác)."
    }
  },
  MOVIE: {
    TITLE: "Quản Lý Phim",
    SUBTITLE: "Quản lý kho phim, tải ảnh poster và đồng bộ lịch chiếu của rạp",
    ADD_MOVIE: "Thêm Phim Mới",
    EDIT_MOVIE: "Chỉnh Sửa Phim",
    
    // Status Filters
    STATUS_ALL: "🎬 Tất Cả Phim",
    STATUS_NOW_SHOWING: "🟢 Đang Chiếu",
    STATUS_COMING_SOON: "🔵 Sắp Chiếu",
    STATUS_ENDED: "🟡 Đã Kết Thúc",
    STATUS_INACTIVE: "🔴 Tạm Ẩn",
    STATUS_ARCHIVED: "🟣 Lưu Trữ",
    
    // Messages
    ERR_FETCH_MOVIES: "Không thể tải danh sách phim.",
    ERR_FETCH_GENRES: "Không thể tải danh sách thể loại.",
    ERR_FETCH_DETAIL_EDIT: "Không thể tải chi tiết phim để chỉnh sửa.",
    ERR_FETCH_DETAIL_ACTIVATE: "Không thể tải chi tiết phim để kích hoạt.",
    
    CONFIRM_HIDE: "⚠️ Bạn có chắc chắn muốn ẩn bộ phim \"{0}\" khỏi hệ thống không?\n\nPhim sẽ được chuyển sang trạng thái \"Tạm Ẩn\" (Soft Delete). Các suất chiếu đang mở sẽ bị hủy và hoàn tiền vé nếu có.",
    SUCCESS_HIDE: "Đã ẩn phim thành công! Phim chuyển sang trạng thái Tạm Ẩn.",
    ERR_HIDE: "Không thể ẩn phim. Vui lòng thử lại.",
    
    CONFIRM_REACTIVATE: "🔄 Bạn có muốn kích hoạt lại bộ phim \"{0}\" không?\n\nPhim sẽ chuyển sang trạng thái \"Sắp Chiếu\" và có thể xếp lịch chiếu.",
    SUCCESS_REACTIVATE: "Kích hoạt lại phim thành công!",
    ERR_REACTIVATE: "Không thể kích hoạt lại phim.",
    
    ERR_POSTER_SIZE: "Ảnh poster quá lớn! Vui lòng chọn ảnh dưới 5MB.",
    ERR_TITLE_EMPTY: "Tên phim không được để trống!",
    ERR_DURATION_INVALID: "Thời lượng phim phải lớn hơn 0!",
    
    SUCCESS_UPDATE: "Cập nhật thông tin phim thành công!",
    SUCCESS_CREATE: "Thêm phim mới thành công!",
    ERR_SAVE: "Lưu thông tin thất bại.",
    
    // UI Elements
    SEARCH_PLACEHOLDER: "Tìm theo tên phim...",
    ALL_GENRES: "Tất cả thể loại",
    BTN_SEARCH: "Tìm Kiếm",
    SYNCING: "Đang đồng bộ dữ liệu phim từ máy chủ...",
    LOADING: "Đang tải...",
    
    // Table Headers
    TH_POSTER: "Poster",
    TH_TITLE: "Tên Phim",
    TH_DIRECTOR: "Đạo Diễn",
    TH_GENRE: "Thể Loại",
    TH_DURATION: "Thời Lượng",
    TH_AGE: "Độ Tuổi",
    TH_STATUS: "Trạng Thái",
    TH_ACTION: "Hành Động",
    
    NO_MOVIES: "Chưa có bộ phim nào trong danh sách.",
    NOT_UPDATED: "Chưa cập nhật",
    MINUTES: "phút",
    
    // Status Texts
    STATUS_NOW_SHOWING_TEXT: "Đang chiếu",
    STATUS_COMING_SOON_TEXT: "Sắp chiếu",
    STATUS_ENDED_TEXT: "Đã kết thúc",
    STATUS_INACTIVE_TEXT: "Tạm ẩn",
    STATUS_ARCHIVED_TEXT: "Lưu trữ",
    
    // Action Buttons
    BTN_EDIT: "Sửa",
    BTN_HIDE: "Ẩn Phim",
    BTN_SHOW: "Hiện Phim",
    
    // Pagination
    PAGINATION_NO_DATA: "Không có phim nào trong danh sách",
    PAGINATION_INFO: "Hiển thị {0}–{1} trong số {2} phim",
    BTN_PREV: "◀ Trang trước",
    PAGE: "Trang",
    BTN_NEXT: "Trang sau ▶",
    
    // Modal Form
    MODAL_UPDATE_TITLE: "✏️ Cập Nhật Thông Tin Phim",
    MODAL_ADD_TITLE: "Thêm Phim Mới Vào Hệ Thống",
    LABEL_TITLE: "Tên Phim",
    PLACEHOLDER_TITLE: "Nhập tên tiếng Việt...",
    LABEL_DURATION: "Thời Lượng (Phút)",
    LABEL_GENRE: "Thể Loại",
    PLACEHOLDER_GENRE: "Chọn thể loại...",
    LABEL_DIRECTOR: "Đạo Diễn",
    PLACEHOLDER_DIRECTOR: "Nhập tên đạo diễn...",
    LABEL_LANGUAGE: "Ngôn Ngữ",
    LABEL_RELEASE_DATE: "Khởi Chiếu Từ Ngày",
    LABEL_AGE: "Độ Tuổi Cho Phép",
    LABEL_HIGHLIGHT: "Nhãn nổi bật (Highlight)",
    LABEL_STATUS: "Trạng Thái Phân Phối",
    LABEL_TRAILER: "Trailer URL (Youtube)",
    LABEL_POSTER: "Ảnh Poster Phim",
    NO_POSTER: "No poster",
    POSTER_UPLOAD_DESC: "📥 Click hoặc kéo thả ảnh để tải lên Poster",
    POSTER_HINT: "Định dạng hỗ trợ: JPG, PNG, WEBP. Dung lượng tối đa 5MB.",
    LABEL_DESC: "Nội Dung Mô Tả Phim",
    PLACEHOLDER_DESC: "Mô tả tóm tắt nội dung cốt truyện...",
    
    BTN_CANCEL_FORM: "Hủy bỏ",
    BTN_UPDATE_FORM: "Cập Nhật",
    BTN_SAVE_FORM: "Lưu Thông Tin",
  },
  ROOM: {
    TITLE: "Quản Lý Phòng Chiếu",
    SUBTITLE: "Quản lý danh sách phòng chiếu, sức chứa và sơ đồ ghế cho từng rạp.",
    BTN_ADD_ROOM: "+ Thêm Phòng Mới",
    
    // Status Options
    STATUS_ACTIVE: "Hoạt Động",
    STATUS_INACTIVE: "Ngừng Hoạt Động",
    STATUS_MAINTENANCE: "Bảo Trì",
    STATUS_ALL: "Tất cả",
    
    // Messages
    ERR_FETCH_ROOMS: "Không thể tải dữ liệu phòng chiếu.",
    ERR_NAME_EMPTY: "Tên phòng không được để trống!",
    ERR_CINEMA_EMPTY: "Vui lòng chọn rạp chiếu!",
    SUCCESS_UPDATE: "Cập nhật phòng chiếu thành công!",
    SUCCESS_CREATE: "Thêm phòng chiếu mới thành công!",
    ERR_SAVE: "Lưu phòng chiếu thất bại. Kiểm tra lại dữ liệu.",
    CONFIRM_DEACTIVATE: "⚠️ Bạn có chắc chắn muốn ngừng hoạt động phòng \"{0}\"?",
    SUCCESS_DEACTIVATE: "Đã ngừng hoạt động phòng \"{0}\"!",
    ERR_DEACTIVATE: "Thao tác thất bại. Vui lòng thử lại sau.",
    
    // Filters and Labels
    FILTER_CINEMA: "Rạp:",
    FILTER_CINEMA_ALL: "Tất cả rạp",
    FILTER_STATUS: "Trạng thái:",
    SHOWING_INFO: "Hiển thị {0} / {1} phòng",
    
    // UI Elements
    LOADING: "Đang tải dữ liệu...",
    NO_ROOMS_SYSTEM: "Chưa có phòng chiếu nào trong hệ thống.",
    NO_ROOMS_FILTER: "Không có phòng chiếu nào khớp với bộ lọc đã chọn.",
    
    // Table Headers
    TH_NAME: "Tên Phòng",
    TH_CINEMA: "Rạp",
    TH_CAPACITY: "Sức Chứa",
    TH_SEATS: "Số Ghế",
    TH_STATUS: "Trạng Thái",
    TH_ACTION: "Hành Động",
    
    // Actions
    BTN_SEAT_LAYOUT: "Sơ Đồ Ghế",
    BTN_EDIT: "Sửa",
    BTN_DELETE: "Xóa",
    
    // Modal
    MODAL_UPDATE_TITLE: "✏️ Cập Nhật Phòng Chiếu",
    MODAL_ADD_TITLE: "✨ Thêm Phòng Chiếu Mới",
    LABEL_CINEMA: "Rạp Chiếu",
    PLACEHOLDER_CINEMA: "-- Chọn rạp chiếu --",
    HINT_CINEMA_EDIT: "Không thể thay đổi rạp khi sửa phòng.",
    LABEL_NAME: "Tên Phòng",
    PLACEHOLDER_NAME: "Ví dụ: Phòng 1 - 2D Dolby",
    LABEL_CAPACITY: "Sức Chứa",
    LABEL_STATUS: "Trạng Thái",
    BTN_CANCEL: "Hủy bỏ",
    BTN_SUBMIT_UPDATE: "Cập Nhật",
    BTN_SUBMIT_ADD: "Lưu Phòng",
    BTN_SUBMITTING: "Đang xử lý...",
    
    UNIT_CAPACITY: "chỗ",
    UNIT_SEAT: "ghế",
  },
  SEAT_LAYOUT: {
    // Messages
    ERR_FETCH_DATA: "Không thể tải dữ liệu phòng chiếu.",
    MSG_COPY_WARN: "⚠️ CẢNH BÁO:\nHành động này sẽ XÓA toàn bộ ghế hiện tại của phòng này và sao chép sơ đồ ghế từ phòng nguồn.\nBạn có chắc chắn muốn tiếp tục?",
    ERR_COPY_EMPTY: "Phòng nguồn không có ghế nào để sao chép.",
    MSG_COPY_WARN_RESULT: "Sao chép thành công. Tạo mới: {0}, Cập nhật: {1}, Vô hiệu hóa: {2}. Thất bại ở: {3}...",
    MSG_COPY_SUCCESS: "Đã sao chép thành công sơ đồ ghế (Tạo mới: {0}, Cập nhật: {1}, Vô hiệu hóa: {2})!",
    ERR_COPY_FAIL: "Sao chép sơ đồ ghế thất bại.",
    MSG_GEN_CONFIRM: "⚠️ Bạn có muốn sinh thêm các ghế mới trong sơ đồ {0}×{1} không? Các ghế hiện tại sẽ được giữ nguyên.",
    ERR_GEN_CAPACITY: "Không thể sinh thêm ghế vì tổng số chỗ ngồi sau khi sinh ({0}) sẽ vượt quá sức chứa tối đa của phòng ({1} chỗ).",
    MSG_GEN_WARN: "Tạo/Kích hoạt được {0} ghế (bỏ qua {1} ghế hoạt động). Không thể xử lý: {2}{3}.",
    MSG_GEN_SUCCESS: "Đã tạo/kích hoạt {0} ghế thành công! (Bỏ qua {1} ghế đã tồn tại và hoạt động)",
    ERR_GEN_FAIL: "Sinh ghế thất bại. Vui lòng thử lại.",
    ERR_REACTIVATE_EMPTY: "Vui lòng chọn ít nhất 1 ghế!",
    ERR_REACTIVATE_CAPACITY: "Không thể kích hoạt các ghế này vì tổng số chỗ ngồi sau khi kích hoạt ({0}) sẽ vượt quá sức chứa tối đa của phòng ({1} chỗ).",
    MSG_REACTIVATE_WARN: "Kích hoạt được {0}/{1} ghế. Thất bại: {2}{3}.",
    MSG_REACTIVATE_SUCCESS: "Đã kích hoạt thành công {0} ghế!",
    ERR_REACTIVATE_FAIL: "Kích hoạt thất bại.",
    ERR_CHANGE_TYPE_EMPTY: "Vui lòng chọn ít nhất 1 ghế!",
    ERR_CHANGE_TYPE_CAPACITY: "Không thể đổi loại ghế vì tổng số chỗ ngồi sau khi đổi ({0}) sẽ vượt quá sức chứa tối đa của phòng ({1} chỗ).",
    MSG_CHANGE_TYPE_SUCCESS: "Đã đổi loại {0} ghế thành công!",
    ERR_CHANGE_TYPE_FAIL: "Cập nhật ghế thất bại.",
    ERR_DEACTIVATE_EMPTY: "Vui lòng chọn ít nhất 1 ghế!",
    MSG_DEACTIVATE_CONFIRM: "⚠️ Bạn sắp vô hiệu hóa {0} ghế. Ghế đã vô hiệu hóa sẽ không hiển thị cho khách hàng. Tiếp tục?",
    MSG_DEACTIVATE_WARN: "Vô hiệu hóa được {0}/{1} ghế. {2} ghế bị chặn (đang dùng bởi suất chiếu): {3}{4}.",
    MSG_DEACTIVATE_SUCCESS: "Đã vô hiệu hóa {0} ghế!",
    ERR_DEACTIVATE_FAIL: "Vô hiệu hóa thất bại.",

    // Loading
    LOADING: "Đang tải sơ đồ ghế...",
    LOADING_PROCESS: "Đang xử lý...",

    // Header
    BTN_BACK: "Quay lại",
    TITLE: "Sơ Đồ Ghế",
    ROOM_CAPACITY: "Sức chứa: {0}",

    // Grid Empty State
    NO_SEATS: "Phòng chiếu chưa có ghế nào.",
    NO_SEATS_HINT: "Sử dụng bảng điều khiển bên phải để sinh ghế tự động.",
    SCREEN: "Màn Hình",

    // Controls
    BTN_SELECT_ALL_ROW: "Chọn tất cả hàng {0}",
    BTN_SELECT_ALL: "Chọn tất cả",
    BTN_DESELECT_ALL: "Bỏ chọn tất cả",
    BTN_DESELECT: "Bỏ chọn ({0})",
    BTN_UNDO: "Undo",
    BTN_REDO: "Redo",
    TOOLTIP_UNDO: "Hoàn tác chọn ghế (Ctrl+Z)",
    TOOLTIP_REDO: "Làm lại chọn ghế (Ctrl+Y)",

    // Stats panel
    TITLE_STATS: "Thống Kê Ghế",
    STATS_CAPACITY: "Sức chứa đã dùng (chỗ ngồi)",
    STATS_TOTAL: "Tổng Ghế",
    STATS_INACTIVE: "Vô Hiệu",
    BTN_HIDE_INACTIVE: "🙈 Ẩn ghế vô hiệu",
    BTN_SHOW_INACTIVE: "👁️ Hiện {0} ghế vô hiệu",

    // Batch Edit panel
    TITLE_BATCH: "🎯 Chỉnh Sửa Hàng Loạt",
    BATCH_SELECTED: "Đã chọn:",
    BATCH_SEATS: "ghế",
    BATCH_HINT: "Click vào ghế trên sơ đồ hoặc click vào chữ cái hàng để chọn.",
    BATCH_CHANGE_TYPE: "Đổi Loại Ghế ({0} ghế active)",
    BTN_APPLY: "Áp dụng",
    BTN_BATCH_DEACTIVATE: "🚫 Vô Hiệu Hóa {0} Ghế Active",
    BTN_BATCH_REACTIVATE: "✅ Kích Hoạt Lại {0} Ghế Vô Hiệu",
    BATCH_MIXED_HINT: "Đang chọn cả ghế active và vô hiệu.",

    // Auto Gen panel
    TITLE_GEN: "⚡ Sinh Ghế Tự Động",
    GEN_ROWS: "Số Hàng",
    GEN_COLS: "Số Cột",
    GEN_TYPE: "Loại Ghế Mặc Định",
    GEN_INFO_1: "Sẽ tạo",
    GEN_INFO_2: "ghế",
    GEN_INFO_3: "({0} hàng × {1} cột)",
    BTN_GENERATE: "⚡ Sinh Ghế Ngay",

    // Copy panel
    TITLE_COPY: "📋 Sao Chép Sơ Đồ",
    COPY_DESC: "Áp dụng sơ đồ thiết kế ghế từ một phòng chiếu khác cho phòng này.",
    BTN_COPY: "📋 Sao chép từ phòng khác...",

    // Legend panel
    TITLE_LEGEND: "Chú Thích",
    LEGEND_FEE_0: "Phụ thu 0đ",
    LEGEND_FEE_30: "+30,000đ",
    LEGEND_FEE_50: "+50,000đ",
    LEGEND_INACTIVE: "Không hoạt động",
    LEGEND_SELECTED: "Đang được chọn",
    
    // Copy Modal
    MODAL_COPY_TITLE: "📋 Sao chép sơ đồ ghế",
    MODAL_COPY_DESC: "Lấy toàn bộ thiết kế ghế từ một phòng chiếu khác và áp dụng cho phòng hiện tại. Ghế hiện tại của phòng này sẽ được đồng bộ/vô hiệu hóa tương ứng.",
    MODAL_COPY_LABEL: "Chọn phòng chiếu nguồn",
    MODAL_COPY_PLACEHOLDER: "-- Chọn phòng --",
    MODAL_COPY_ROOM_INFO: "{0} ({1}) - {2} ghế",
    BTN_CANCEL: "Hủy bỏ",
    BTN_CONFIRM_COPY: "Xác nhận sao chép",
  },
  STAFF: {
    ERR_DUPLICATE_EMAIL: "Email này đã tồn tại trong hệ thống.",
    ERR_CINEMA_NOT_FOUND: "Chưa có rạp trong hệ thống. Vui lòng seed dữ liệu rạp trước.",
    ERR_ROLE_NOT_FOUND: "Chưa có role Staff trong hệ thống.",
    ERR_EMAIL_SEND_FAILED: "Không gửi được email mời staff. Vui lòng kiểm tra SMTP backend.",
    ERR_VALIDATION: "Email hoặc tên nhân viên chưa hợp lệ.",
    ERR_UNKNOWN_OBJ: "Đã xảy ra lỗi không xác định.",
    ERR_CONNECTION: "Không thể kết nối backend. Hãy kiểm tra API đã chạy chưa.",
    ERR_UNKNOWN: "Đã xảy ra lỗi không xác định.",

    SUCCESS_INVITE: "Đã gửi email mời staff.",

    TITLE: "Quản Lý Staff",
    SUBTITLE: "Tạo tài khoản staff và gửi OTP đặt mật khẩu tới email nhân viên.",

    FORM_TITLE: "Mời Staff Mới",
    LABEL_EMAIL: "Email Staff",
    PLACEHOLDER_EMAIL: "staff@example.com",
    LABEL_NAME: "Họ Tên",
    PLACEHOLDER_NAME: "Không bắt buộc",
    BTN_SUBMITTING: "Đang gửi lời mời...",
    BTN_SUBMIT: "Gửi Lời Mời Staff",

    STATUS_TITLE: "Trạng Thái",
    STATUS_SUCCESS: "Đã tạo tài khoản staff cho ",
    STATUS_OTP_EXPIRE: "OTP hết hạn lúc ",
    STATUS_LINK_LABEL: "Trang đặt mật khẩu",
    STATUS_EMPTY: "Chưa có lời mời staff nào trong phiên này.",
  },
  DASHBOARD: {
    TITLE: "Dashboard",
    SUBTITLE: "Đây là khu vực quản trị.",
  }
};
