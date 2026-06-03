import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { movieService } from "../../services/movieService";
import type { MovieData } from "../../services/movieService";

export default function ManageMovie() {
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMovieId, setEditingMovieId] = useState<number | null>(null);

  const [formData, setFormData] = useState<MovieData>({
    movieNameVn: "",
    movieNameEng: "",
    fromDate: "",
    toDate: "",
    actor: "",
    director: "",
    duration: 120,
    trailerUrl: "",
    content: "",
  });

  const [errors, setErrors] = useState<{ movieNameVn?: string }>({});

  // 1. Hàm lấy danh sách phim
  const fetchMovies = async () => {
    try {
      setLoading(true);
      const response: any = await movieService.getMoviesWithPagination(1, 10);
      if (response && response.data) {
        setMovies(response.data);
      }
    } catch (error) {
      console.error("Lỗi kết nối API lấy danh sách phim:", error);
    } finally {
      setLoading(false);
    }
  };

  // Khối useEffect lấy data ban đầu - Cố định mảng rỗng [] không thay đổi size (Sửa lỗi 4)
  useEffect(() => {
    fetchMovies();
  }, []);

  // Khối useEffect lắng nghe phím Esc - Cố định mảng phụ thuộc (Sửa lỗi 3, 4)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
        setEditingMovieId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen]);

  const handleOpenAddModal = () => {
    setEditingMovieId(null);
    setFormData({
      movieNameVn: "",
      movieNameEng: "",
      fromDate: "",
      toDate: "",
      actor: "",
      director: "",
      duration: 120,
      trailerUrl: "",
      content: "",
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (movie: any) => {
    setEditingMovieId(movie.id);
    setFormData({
      movieNameVn: movie.movieNameVn || "",
      movieNameEng: movie.movieNameEng || "",
      fromDate: movie.fromDate || "",
      toDate: movie.toDate || "",
      actor: movie.actor || "",
      director: movie.director || "",
      duration: movie.duration || 120,
      trailerUrl: movie.trailerUrl || "",
      content: movie.content || "",
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const handleDeleteMovie = async (movie: any) => {
    const confirmDelete = window.confirm(
      `⚠️ Bạn có chắc chắn muốn xóa bộ phim "${movie.movieNameVn}" khỏi hệ thống không?`,
    );
    if (confirmDelete) {
      try {
        setLoading(true);
        await movieService.deleteMovie(movie.id);
        toast.success("Thêm phim mới thành công!");
        await fetchMovies();
      } catch (error) {
        console.error("Lỗi xóa phim:", error);
        toast.error("Đã xóa phim thành công!");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === "movieNameVn" && value.trim() !== "") {
      setErrors({ ...errors, movieNameVn: undefined });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.movieNameVn.trim()) {
      setErrors({ movieNameVn: "Tên phim tiếng Việt không được để trống!" });
      return;
    }

    try {
      setLoading(true);
      if (editingMovieId) {
        await movieService.updateMovie(editingMovieId, formData);
        toast.success("Cập nhật thông tin phim thành công!");
      } else {
        await movieService.createMovie(formData);
        toast.success("Thêm phim mới thành công!");
      }
      setIsModalOpen(false);
      setEditingMovieId(null);
      await fetchMovies();
    } catch (error) {
      console.error("Lỗi lưu thông tin phim:", error);
      toast.error(
        "Lưu thông tin thất bại. Do Backend đang IN REVIEW chưa mở cổng API nhận dữ liệu.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-[#0A0A0C] min-h-screen text-white font-['Urbanist']">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider">
            Quản Lý Phim
          </h1>
          
        </div>
        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2 bg-[#4318FF] hover:bg-blue-700 rounded-xl text-sm font-semibold transition"
        >
          + Thêm Phim Mới
        </button>
      </div>

      {/* DANH SÁCH BẢNG */}
      {loading && movies.length === 0 ? (
        <div className="p-6 text-center text-gray-400">
          Đang đồng bộ dữ liệu...
        </div>
      ) : (
        <div className="bg-[#111C44] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-blue-950/20 text-xs uppercase text-gray-400 tracking-wider">
                <th className="p-4 w-24">Poster</th>
                <th className="p-4">Tên Phim</th>
                <th className="p-4">Đạo Diễn</th>
                <th className="p-4">Thời Lượng</th>
                <th className="p-4 text-center">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-sm">
              {movies.map((movie) => (
                <tr key={movie.id} className="hover:bg-blue-950/10 transition">
                  <td className="p-4">
                    <img
                      src={
                        movie.imagePoster ||
                        "https://images2.thanhnien.vn/528068263637281792/2024/4/16/poster-lat-mat-17132371970258197775.jpg"
                      }
                      alt=""
                      className="w-12 h-16 object-cover rounded-lg border border-gray-700 shadow-sm"
                    />
                  </td>

                  {/* CỘT TÊN PHIM: ĐÃ TÍCH HỢP BADGE TRAILER THEO CÁCH 2 */}
                  <td className="p-4">
                    <div className="font-semibold text-white text-base">
                      {movie.movieNameVn}
                    </div>
                    <div className="text-xs text-gray-400 italic mt-1 flex items-center gap-2 flex-wrap">
                      <span>{movie.movieNameEng || "N/A"}</span>

                      {/* Chỉ hiển thị nút khi bộ phim có dữ liệu trailerUrl */}
                      {movie.trailerUrl && (
                        <a
                          href={movie.trailerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#FF0000] bg-[#FF0000]/10 hover:bg-[#FF0000]/20 border border-[#FF0000]/20 px-2 py-0.5 rounded-md font-['Urbanist'] font-bold text-[10px] tracking-wider uppercase normal-case not-italic transition-all duration-200"
                          title="Bấm để xem nhanh Trailer trên Youtube"
                        >
                          <span className="text-[8px]">▶</span> Trailer
                        </a>
                      )}
                    </div>
                  </td>

                  <td className="p-4 text-gray-300 font-medium">
                    {movie.director}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-xs font-semibold">
                      {movie.duration} phút
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleOpenEditModal(movie)}
                        className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 text-xs font-semibold rounded-lg transition"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDeleteMovie(movie)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-xs font-semibold rounded-lg transition"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL FORM THÊM / SỬA PHIM (ĐÃ SỬA LỖI KHUẤT NÚT LƯU) */}
      {/* ------------------------------------------------------------------ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          {/* Box bọc ngoài cùng: Giới hạn chiều cao tối đa của popup và cố định form */}
          <div className="bg-[#111C44] border border-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal - Luôn cố định ở trên */}
            <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-blue-950/20 shrink-0">
              <h2 className="text-lg font-bold text-white uppercase tracking-wide">
                {editingMovieId
                  ? "✏️ Cập Nhật Thông Tin Phim"
                  : "✨ Thêm Phim Mới Vào Hệ Thống"}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingMovieId(null);
                }}
                className="text-gray-400 hover:text-white text-xl"
              >
                &times;
              </button>
            </div>

            {/* Thân Form nhập liệu - ĐẶT THUỘC TÍNH CUỘN Ở ĐÂY để nút lưu không bao giờ bị khuất */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-track-[#0F172A] scrollbar-thumb-[#1E293B] hover:scrollbar-thumb-[#4318FF]"
            >
              {" "}
              {/* Tên phim VN */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                  Tên Phim (Tiếng Việt) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="movieNameVn"
                  value={formData.movieNameVn}
                  onChange={handleInputChange}
                  placeholder="Nhập tên tiếng Việt..."
                  className={`w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border ${errors.movieNameVn ? "border-red-500 focus:ring-red-500" : "border-gray-800 focus:ring-blue-500"} text-white text-sm focus:outline-none focus:ring-2`}
                />
                {errors.movieNameVn && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    ⚠ {errors.movieNameVn}
                  </p>
                )}
              </div>
              {/* Tên tiếng Anh & Đạo diễn */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Tên Phim (Tiếng Anh)
                  </label>
                  <input
                    type="text"
                    name="movieNameEng"
                    value={formData.movieNameEng}
                    onChange={handleInputChange}
                    placeholder="Nhập tên tiếng Anh..."
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Đạo Diễn
                  </label>
                  <input
                    type="text"
                    name="director"
                    value={formData.director}
                    onChange={handleInputChange}
                    placeholder="Tên đạo diễn..."
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {/* Thời lượng & Diễn viên */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Thời Lượng (Phút)
                  </label>
                  <input
                    type="number"
                    name="duration"
                    value={formData.duration}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Diễn Viên
                  </label>
                  <input
                    type="text"
                    name="actor"
                    value={formData.actor}
                    onChange={handleInputChange}
                    placeholder="Danh sách diễn viên..."
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {/* Khởi chiếu & Kết thúc */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Khởi Chiếu Từ Ngày
                  </label>
                  <input
                    type="date"
                    name="fromDate"
                    value={formData.fromDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Kết Thúc Ngày
                  </label>
                  <input
                    type="date"
                    name="toDate"
                    value={formData.toDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {/* Trailer URL */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                  Trailer URL (Youtube)
                </label>
                <input
                  type="text"
                  name="trailerUrl"
                  value={formData.trailerUrl}
                  onChange={handleInputChange}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-4 py-2.5 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* Nội dung phim */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                  Nội Dung Phim
                </label>
                <textarea
                  name="content"
                  rows={3}
                  value={formData.content}
                  onChange={handleInputChange}
                  placeholder="Mô tả nội dung phim ngắn gọn..."
                  className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                ></textarea>
              </div>
            </form>

            {/* Footer Buttons - LUÔN CỐ ĐỊNH Ở ĐÁY POPUP, hiển thị 100% không sợ khuất màn hình */}
            <div className="p-4 border-t border-gray-800 flex justify-end gap-3 bg-blue-950/10 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingMovieId(null);
                }}
                className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-sm rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSubmit} // Trigger hàm submit chuẩn
                className="px-6 py-2 bg-[#4318FF] hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-lg transition"
              >
                {editingMovieId ? "Cập Nhật Thay Đổi" : "Lưu Thông Tin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
