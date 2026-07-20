import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "react-toastify";
import { bannerService } from "../../services/bannerService";
import type { BannerResponse } from "../../services/bannerService";
import { getMediaUrl } from "../../lib/media";

type ApiErrorLike = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as ApiErrorLike;
  return apiError.response?.data?.message || fallback;
};

export default function ManageBanner() {
  const context = useOutletContext<{ isLightMode?: boolean }>() || {};
  const isLightMode = context.isLightMode ?? false;

  const [banners, setBanners] = useState<BannerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    linkUrl: "",
    bannerType: "PROMOTION", // MOVIE, PROMOTION, FOOD_BEVERAGE, SYSTEM
    displayOrder: 0,
    imageUrl: "",
    isActive: true,
  });

  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const data = await bannerService.getAllBanners();
      setBanners(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải danh sách banner."));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const parsed = name === "displayOrder" ? (value === "" ? 0 : Number(value)) : value;
    setFormData(prev => ({ ...prev, [name]: parsed }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error("File ảnh không được vượt quá 8MB.");
        e.target.value = "";
        return;
      }
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const handleOpenCreateModal = () => {
    setEditingBannerId(null);
    setFormData({
      title: "",
      linkUrl: "",
      bannerType: "PROMOTION",
      displayOrder: 0,
      imageUrl: "",
      isActive: true,
    });
    setBannerFile(null);
    setBannerPreview("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (banner: BannerResponse) => {
    setEditingBannerId(banner.bannerId);
    setFormData({
      title: banner.title,
      linkUrl: banner.linkUrl || "",
      bannerType: banner.bannerType,
      displayOrder: banner.displayOrder,
      imageUrl: banner.imageUrl,
      isActive: banner.isActive,
    });
    setBannerFile(null);
    setBannerPreview(getMediaUrl(banner.imageUrl));
    setIsModalOpen(true);
  };

  const handleDeleteBanner = async (bannerId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa banner này?")) return;

    try {
      setLoading(true);
      await bannerService.deleteBanner(bannerId);
      toast.success("Xóa banner thành công!");
      fetchBanners();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa banner."));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề banner.");
      return;
    }
    if (!bannerFile && !formData.imageUrl) {
      toast.error("Vui lòng tải file ảnh lên hoặc nhập URL ảnh banner.");
      return;
    }

    try {
      setIsSaving(true);
      const submitData = new FormData();
      submitData.append("Title", formData.title);
      submitData.append("BannerType", formData.bannerType);
      submitData.append("DisplayOrder", String(formData.displayOrder));
      submitData.append("IsActive", String(formData.isActive));
      
      if (formData.linkUrl) submitData.append("LinkUrl", formData.linkUrl);
      if (formData.imageUrl) submitData.append("ImageUrl", formData.imageUrl);
      if (bannerFile) submitData.append("bannerFile", bannerFile);

      if (editingBannerId) {
        await bannerService.updateBanner(editingBannerId, submitData);
        toast.success("Cập nhật banner thành công!");
      } else {
        await bannerService.createBanner(submitData);
        toast.success("Tạo banner mới thành công!");
      }

      setIsModalOpen(false);
      fetchBanners();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Lỗi khi lưu banner."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`p-6 min-h-screen transition-colors duration-300 ${
      isLightMode ? 'bg-[#F6F8FB] text-slate-950' : 'bg-[#0B0F19] text-white'
    }`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className={`text-2xl font-bold tracking-wide ${
            isLightMode ? 'text-slate-950' : 'text-white'
          }`}>Quản Lý Banner Quảng Cáo & Sự Kiện</h1>
          <p className={`text-xs mt-1 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Thêm, sửa, xóa các banner rạp, banner bắp nước, sự kiện hiển thị trên Carousel trang chủ.</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-950 transition-all flex items-center gap-2"
        >
          <span>+ Thêm Banner Mới</span>
        </button>
      </div>

      {/* List / Table */}
      {loading && banners.length === 0 ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className={`border rounded-2xl overflow-hidden shadow-xl transition ${
          isLightMode ? 'bg-white border-slate-200 shadow-slate-200/70' : 'bg-[#111827] border-gray-800 shadow-black/20'
        }`}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`border-b text-xs font-semibold uppercase transition ${
                isLightMode ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-gray-800 bg-[#1F2937]/50 text-slate-400'
              }`}>
                <th className="py-4 px-6">Ảnh Banner</th>
                <th className="py-4 px-6">Tiêu đề</th>
                <th className="py-4 px-6">Loại Banner</th>
                <th className="py-4 px-6">Thứ tự</th>
                <th className="py-4 px-6">Trạng thái</th>
                <th className="py-4 px-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className={`divide-y text-sm transition ${
              isLightMode ? 'divide-slate-200 text-slate-700' : 'divide-gray-800/65 text-slate-300'
            }`}>
              {banners.map((b) => (
                <tr key={b.bannerId} className={`transition ${
                  isLightMode ? 'hover:bg-slate-50/85' : 'hover:bg-[#1F2937]/25'
                }`}>
                  <td className="py-3 px-6">
                    <div className={`w-28 h-16 rounded-xl overflow-hidden border transition ${
                      isLightMode ? 'border-slate-200 bg-slate-100' : 'border-gray-800 bg-[#0F172A]'
                    }`}>
                      <img src={getMediaUrl(b.imageUrl)} alt={b.title} className="w-full h-full object-cover" />
                    </div>
                  </td>
                  <td className={`py-3 px-6 font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                    <div>{b.title}</div>
                    {b.linkUrl && (
                      <a href={b.linkUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline block mt-1 max-w-xs truncate">
                        Link: {b.linkUrl}
                      </a>
                    )}
                  </td>
                  <td className="py-3 px-6">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${
                      b.bannerType === 'FOOD_BEVERAGE' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                      b.bannerType === 'PROMOTION' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                      b.bannerType === 'MOVIE' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}>
                      {b.bannerType === 'FOOD_BEVERAGE' ? '🍿 Bắp Nước' :
                       b.bannerType === 'PROMOTION' ? '🎟️ Khuyến Mãi' :
                       b.bannerType === 'MOVIE' ? '🎬 Phim' : '📍 Hệ Thống'}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-center font-mono">{b.displayOrder}</td>
                  <td className="py-3 px-6">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                      b.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${b.isActive ? 'bg-green-400' : 'bg-red-400'}`}></span>
                      {b.isActive ? 'Đang bật' : 'Đang tắt'}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => handleOpenEditModal(b)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                          isLightMode
                            ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200'
                            : 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border-blue-500/15'
                        }`}
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDeleteBanner(b.bannerId)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                          isLightMode
                            ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
                            : 'bg-red-600/10 hover:bg-red-600/20 text-red-400 border-red-500/15'
                        }`}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {banners.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Chưa có banner nào. Hãy bấm thêm banner ở góc trên bên phải!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-lg border rounded-2xl shadow-2xl p-6 relative transition ${
            isLightMode ? 'bg-white border-slate-200' : 'bg-[#111827] border-gray-800'
          }`}>
            <h2 className={`text-xl font-bold mb-4 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
              {editingBannerId ? "Chỉnh Sửa Banner" : "Thêm Banner Mới"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tiêu đề */}
              <div>
                <label className={`block text-xs font-semibold uppercase mb-1 ${
                  isLightMode ? 'text-slate-500' : 'text-gray-400'
                }`}>
                  Tiêu đề Banner <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: Siêu Combo Bắp Nước Ưu Đãi 30%"
                  className={`w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    isLightMode
                      ? 'bg-slate-50 border-slate-200 text-slate-900'
                      : 'bg-[#0F172A] border-gray-800 text-white'
                  }`}
                  required
                />
              </div>

              {/* Loại Banner & Display Order */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold uppercase mb-1 ${
                    isLightMode ? 'text-slate-500' : 'text-gray-400'
                  }`}>
                    Loại Banner
                  </label>
                  <select
                    name="bannerType"
                    value={formData.bannerType}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      isLightMode
                        ? 'bg-slate-50 border-slate-200 text-slate-900'
                        : 'bg-[#0F172A] border-gray-800 text-white'
                    }`}
                  >
                    <option value="PROMOTION">🎟️ Khuyến mãi / Sự kiện</option>
                    <option value="FOOD_BEVERAGE">🍿 Quảng cáo Bắp nước</option>
                    <option value="MOVIE">🎬 Phim chiếu rạp</option>
                    <option value="SYSTEM">📍 Hệ thống / Giới thiệu</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-semibold uppercase mb-1 ${
                    isLightMode ? 'text-slate-500' : 'text-gray-400'
                  }`}>
                    Thứ tự hiển thị
                  </label>
                  <input
                    type="number"
                    name="displayOrder"
                    value={formData.displayOrder}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      isLightMode
                        ? 'bg-slate-50 border-slate-200 text-slate-900'
                        : 'bg-[#0F172A] border-gray-800 text-white'
                    }`}
                  />
                </div>
              </div>

              {/* Link liên kết */}
              <div>
                <label className={`block text-xs font-semibold uppercase mb-1 ${
                  isLightMode ? 'text-slate-500' : 'text-gray-400'
                }`}>
                  Link chuyển hướng khi click (Tùy chọn)
                </label>
                <input
                  type="text"
                  name="linkUrl"
                  value={formData.linkUrl}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: /food-beverage hoặc link sự kiện..."
                  className={`w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    isLightMode
                      ? 'bg-slate-50 border-slate-200 text-slate-900'
                      : 'bg-[#0F172A] border-gray-800 text-white'
                  }`}
                />
              </div>

              {/* URL hình ảnh ngoài */}
              <div>
                <label className={`block text-xs font-semibold uppercase mb-1 ${
                  isLightMode ? 'text-slate-500' : 'text-gray-400'
                }`}>
                  URL ảnh banner ngoài (Tùy chọn)
                </label>
                <input
                  type="text"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleInputChange}
                  placeholder="https://example.com/banner.jpg (hoặc tải file ở dưới)"
                  className={`w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    isLightMode
                      ? 'bg-slate-50 border-slate-200 text-slate-900'
                      : 'bg-[#0F172A] border-gray-800 text-white'
                  }`}
                />
              </div>

              {/* Upload file banner */}
              <div>
                <label className={`block text-xs font-semibold uppercase mb-1 ${
                  isLightMode ? 'text-slate-500' : 'text-gray-400'
                }`}>
                  Tải lên File ảnh (Khuyên dùng tỉ lệ ngang rộng 2:1 hoặc 16:9, ví dụ: 1920x620)
                </label>
                <div className="flex gap-4 items-center mt-1">
                  {bannerPreview ? (
                    <div className={`relative w-28 h-16 rounded-xl overflow-hidden border shadow transition-colors ${
                      isLightMode ? 'border-slate-200 bg-slate-50' : 'border-gray-800 bg-[#0F172A]'
                    }`}>
                      <img src={bannerPreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className={`w-28 h-16 rounded-xl border border-dashed flex items-center justify-center text-xs transition-colors ${
                      isLightMode ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#0F172A] border-gray-800 text-gray-500'
                    }`}>
                      <span>Chưa có ảnh</span>
                    </div>
                  )}

                  <div className={`flex-1 border border-dashed hover:border-indigo-500 rounded-xl p-3 text-center transition cursor-pointer relative ${
                    isLightMode ? 'border-slate-200 bg-slate-50' : 'border-gray-800 bg-[#0F172A]'
                  }`}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <span className="text-xs text-slate-400">Chọn file từ máy tính</span>
                  </div>
                </div>
              </div>

              {/* Trạng thái Kích hoạt */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleCheckboxChange}
                  className="w-4 h-4 rounded text-blue-600 bg-gray-900 border-gray-800 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className={`text-xs font-semibold uppercase cursor-pointer ${
                  isLightMode ? 'text-slate-700' : 'text-gray-300'
                }`}>
                  Kích hoạt hiển thị ngay lập tức
                </label>
              </div>

              {/* Actions Button */}
              <div className={`flex justify-end gap-3 pt-4 border-t ${
                isLightMode ? 'border-slate-200' : 'border-gray-800'
              }`}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    isLightMode
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-gray-800 hover:bg-gray-700 text-slate-300'
                  }`}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold shadow transition disabled:opacity-50"
                >
                  {isSaving ? "Đang lưu..." : "Lưu banner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
