import React, { useEffect, useState, useRef } from "react";
import { toast } from "react-toastify";
import { movieService } from "../../services/movieService";
import type { MovieData } from "../../services/movieService";

export default function ManageMovie() {
  const [allMovies, setAllMovies] = useState<MovieResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null);

  // Pagination states
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize] = useState(10);

  const [formData, setFormData] = useState({
    title: "",
    durationMinutes: 120,
    genre: "",
    language: "",
    releaseDate: "",
    ageRating: "",
    description: "",
    trailerUrl: "",
    highlight: "",
    movieStatus: "",
    director: "",
  });

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string>("");
  const [originalPosterUrl, setOriginalPosterUrl] = useState<string>("");

  const [errors, setErrors] = useState<{ title?: string; durationMinutes?: string }>({});

  // Search Filters
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchGenre, setSearchGenre] = useState("");

  // 1. Hàm lấy danh sách phim
  // Lấy danh sách phim từ backend để render bảng quản lý.
  const fetchMovies = async () => {
    try {
      setLoading(true);
      const response = await movieService.getMoviesWithPagination(1, 1000, "");
      if (response) {
        setAllMovies(response.items || []);
      }
    } catch (error) {
      console.error("Lỗi kết nối API lấy danh sách phim:", error);
    } finally {
      setLoading(false);
    }
  };

  // Khối useEffect lấy data ban đầu - Cố định mảng rỗng [] không thay đổi size (Sửa lỗi 4)
  // Tải dữ liệu lần đầu khi admin mở trang quản lý phim.
  useEffect(() => {
    void fetchGenres();
  }, []);

    return () => window.clearTimeout(loadTimer);
  }, []);



  const handleStatusFilterChange = (status: string) => {
    setSelectedStatus(status);
    setPageIndex(1);
  };

  // Khối useEffect lắng nghe phím Esc
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
      title: "",
      durationMinutes: 120,
      genre: "",
      language: "",
      releaseDate: "",
      ageRating: "P",
      description: "",
      trailerUrl: "",
      highlight: "",
      movieStatus: "",
      director: "",
    });
    setSelectedGenreIds([]);
    setPosterFile(null);
    setPosterPreview("");
    setOriginalPosterUrl("");
    setErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (movie: MovieResponse) => {
    try {
      setLoading(true);
      const detail = await movieService.getMovieById(movie.id);
      if (detail) {
        setEditingMovieId(detail.movieId);
        setFormData({
          title: detail.title || "",
          durationMinutes: detail.durationMinutes || 120,
          genre: detail.genre || "",
          language: detail.language || "",
          releaseDate: detail.releaseDate || "",
          ageRating: detail.ageRating || "P",
          description: detail.description || "",
          trailerUrl: detail.trailerUrl || "",
          highlight: detail.highlight || "",
          movieStatus: detail.movieStatus || "",
          director: detail.director || "",
        });

        // Ánh xạ thể loại từ backend (string[]) thành các IDs tương ứng từ danh sách db genres
        const matchedIds = (detail.genres ?? [])
          .map(name => genres.find(g => g.name.toLowerCase() === name.toLowerCase())?.genreId)
          .filter((id): id is number => id !== undefined);
        setSelectedGenreIds(matchedIds);

  // Xác nhận rồi gọi API xóa phim khỏi hệ thống.
  const handleDeleteMovie = async (movie: MovieData) => {
    if (!movie.id) {
      return;
    }
  };

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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
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
      const submitData = new FormData();
      submitData.append("Title", formData.title);
      submitData.append("DurationMinutes", String(formData.durationMinutes));

      // Gửi danh sách các ID thể loại đã chọn
      if (selectedGenreIds && selectedGenreIds.length > 0) {
        selectedGenreIds.forEach(id => {
          submitData.append("GenreIds", String(id));
        });
      }

      if (formData.language) submitData.append("Language", formData.language);
      if (formData.releaseDate) submitData.append("ReleaseDate", formData.releaseDate);
      if (formData.ageRating) submitData.append("AgeRating", formData.ageRating);
      if (formData.description) submitData.append("Description", formData.description);
      if (formData.trailerUrl) submitData.append("TrailerUrl", formData.trailerUrl);
      if (formData.highlight) submitData.append("Highlight", formData.highlight);
      if (formData.director) submitData.append("Director", formData.director);

      // Gửi MovieStatus cho cả create và update
      submitData.append("MovieStatus", formData.movieStatus);

      if (editingMovieId) {
        // Nếu giữ ảnh cũ, gửi lại URL để BE lưu trữ
        if (posterPreview && !posterFile) {
          submitData.append("PosterUrl", originalPosterUrl);
        }
      }

      if (posterFile) {
        submitData.append("posterFile", posterFile);
      }

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

  // Khi bấm thêm mới/sửa xong, nạp lại đúng trang và bộ lọc hiện tại
  const handleReloadAfterSave = async () => {
    await fetchMovies();
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
          className="px-4 py-2 bg-[#4318FF] hover:bg-blue-700 rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-lg"
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
        // Fix #8: wrapped in relative container for loading overlay
        <div className="space-y-4">
          {/* Fix #8: Loading overlay khi fetch dữ liệu */}
          <div className="relative">
            {loading && movies.length > 0 && (
              <div className="absolute inset-0 bg-[#0A0A0C]/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-2xl">
                <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  {TEXT.MOVIE.LOADING}
                </div>
              </div>
            )}
            <div className="bg-[#111C44] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-800 bg-blue-950/20 text-xs uppercase text-gray-400 tracking-wider">
                      <th className="p-4 w-24">{TEXT.MOVIE.TH_POSTER}</th>
                      <th className="p-4">{TEXT.MOVIE.TH_TITLE}</th>
                      <th className="p-4">{TEXT.MOVIE.TH_DIRECTOR}</th>
                      <th className="p-4">{TEXT.MOVIE.TH_GENRE}</th>
                      <th className="p-4">{TEXT.MOVIE.TH_DURATION}</th>
                      <th className="p-4">{TEXT.MOVIE.TH_AGE}</th>
                      <th className="p-4">{TEXT.MOVIE.TH_STATUS}</th>
                      <th className="p-4 text-center">{TEXT.MOVIE.TH_ACTION}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50 text-sm">
                    {movies.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-500">
                          {TEXT.MOVIE.NO_MOVIES}
                        </td>
                      </tr>
                    ) : (
                      movies.map((movie) => (
                        <tr key={movie.id} className="hover:bg-blue-950/10 transition">
                          <td className="p-4">
                            <img
                              src={
                                getMediaUrl(movie.imagePoster) ||
                                "https://images2.thanhnien.vn/528068263637281792/2024/4/16/poster-lat-mat-17132371970258197775.jpg"
                              }
                              alt=""
                              className="w-12 h-16 object-cover rounded-lg border border-gray-700 shadow-sm"
                            />
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-white text-base">
                              {movie.movieNameVn}
                            </div>
                            {movie.highlight && (
                              <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                                🔥 {movie.highlight}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-gray-300">
                            {movie.director || <span className="text-gray-500 italic">{TEXT.MOVIE.NOT_UPDATED}</span>}
                          </td>
                          <td className="p-4 text-gray-300 font-medium">
                            {movie.genres?.join(", ") || TEXT.MOVIE.NOT_UPDATED}
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-xs font-semibold">
                              {movie.duration} {TEXT.MOVIE.MINUTES}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs font-bold">
                              {movie.ageRating || "P"}
                            </span>
                          </td>
                          <td className="p-4">
                            {(() => {
                              const status = movie.movieStatus || "NOW_SHOWING";
                              let dotColor = "bg-emerald-500";
                              let text = TEXT.MOVIE.STATUS_NOW_SHOWING_TEXT;

                              if (status === "COMING_SOON") {
                                dotColor = "bg-blue-500";
                                text = TEXT.MOVIE.STATUS_COMING_SOON_TEXT;
                              } else if (status === "ENDED") {
                                dotColor = "bg-amber-500";
                                text = TEXT.MOVIE.STATUS_ENDED_TEXT;
                              } else if (status === "INACTIVE") {
                                dotColor = "bg-rose-500";
                                text = TEXT.MOVIE.STATUS_INACTIVE_TEXT;
                              } else if (status === "ARCHIVED") {
                                dotColor = "bg-purple-500";
                                text = TEXT.MOVIE.STATUS_ARCHIVED_TEXT;
                              }

                              return (
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                                  <span className="text-xs text-gray-300 font-medium">{text}</span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="p-4">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleOpenEditModal(movie)}
                                className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 text-xs font-semibold rounded-lg transition"
                              >
                                {TEXT.MOVIE.BTN_EDIT}
                              </button>
                              {/* Fix #5: Ẩn nút Xóa nếu phim đã ở trạng thái INACTIVE (soft-deleted) */}
                              {movie.movieStatus !== "INACTIVE" ? (
                                <button
                                  onClick={() => handleDeleteMovie(movie)}
                                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-xs font-semibold rounded-lg transition"
                                >
                                  {TEXT.MOVIE.BTN_HIDE}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReactivateMovie(movie)}
                                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 text-xs font-semibold rounded-lg transition"
                                >
                                  {TEXT.MOVIE.BTN_SHOW}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div> {/* end relative loading wrapper */}

          {/* Fix #9: Thông tin đếm phim luôn hiển thị, pagination chỉ hiện khi > 1 trang */}
          <div className="flex justify-between items-center bg-[#111C44] p-4 rounded-2xl border border-gray-800 shadow-xl">
            <span className="text-xs text-gray-400">
              {totalCount === 0
                ? TEXT.MOVIE.PAGINATION_NO_DATA
                : TEXT.MOVIE.PAGINATION_INFO
                  .replace("{0}", String((pageIndex - 1) * pageSize + 1))
                  .replace("{1}", String(Math.min(pageIndex * pageSize, totalCount)))
                  .replace("{2}", String(totalCount))}
            </span>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <button
                  disabled={pageIndex === 1 || loading}
                  onClick={() => setPageIndex((prev) => prev - 1)}
                  className="px-3 py-1.5 bg-[#0F172A] border border-gray-800 rounded-lg text-xs font-semibold text-gray-300 hover:bg-[#1E293B] disabled:opacity-40 transition"
                >
                  {TEXT.MOVIE.BTN_PREV}
                </button>
                <span className="px-3 py-1.5 text-xs font-semibold bg-[#4318FF]/20 text-blue-400 rounded-lg border border-blue-500/30">
                  {TEXT.MOVIE.PAGE} {pageIndex} / {totalPages}
                </span>
                <button
                  disabled={pageIndex === totalPages || loading}
                  onClick={() => setPageIndex((prev) => prev + 1)}
                  className="px-3 py-1.5 bg-[#0F172A] border border-gray-800 rounded-lg text-xs font-semibold text-gray-300 hover:bg-[#1E293B] disabled:opacity-40 transition"
                >
                  {TEXT.MOVIE.BTN_NEXT}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL FORM THÊM / SỬA PHIM */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-[#111C44] border border-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
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

            {/* Thân Form nhập liệu */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-track-[#0F172A] scrollbar-thumb-[#1E293B]"
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
                    type="number"
                    name="durationMinutes"
                    min="1"
                    value={formData.durationMinutes}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Thể loại, Đạo diễn & Ngôn ngữ */}
              <div className="grid grid-cols-3 gap-4">
                <div className="relative" ref={genreDropdownRef}>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    {TEXT.MOVIE.LABEL_GENRE}
                  </label>
                  <div
                    onClick={() => setIsGenreDropdownOpen(!isGenreDropdownOpen)}
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer flex items-center justify-between"
                  >
                    <span className={selectedGenreIds.length === 0 ? "text-gray-400" : ""}>
                      {selectedGenreIds.length > 0
                        ? genres.find(g => g.genreId === selectedGenreIds[0])?.name || TEXT.MOVIE.PLACEHOLDER_GENRE
                        : TEXT.MOVIE.PLACEHOLDER_GENRE}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isGenreDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-[#1E293B] border border-gray-700 rounded-xl shadow-2xl overflow-hidden max-h-60 flex flex-col animate-fadeIn">
                      <div className="overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#1E293B] [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
                        <div
                          onClick={() => {
                            setSelectedGenreIds([]);
                            setIsGenreDropdownOpen(false);
                          }}
                          className={`px-4 py-2.5 text-sm cursor-pointer transition-colors duration-150 ${selectedGenreIds.length === 0 ? "bg-blue-500/10 text-blue-400 font-medium" : "text-gray-300 hover:bg-[#334155]"
                            }`}
                        >
                          {TEXT.MOVIE.PLACEHOLDER_GENRE}
                        </div>
                        {genres.map((g) => {
                          const isSelected = selectedGenreIds.includes(g.genreId);
                          return (
                            <div
                              key={g.genreId}
                              onClick={() => {
                                setSelectedGenreIds([g.genreId]);
                                setIsGenreDropdownOpen(false);
                              }}
                              className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors duration-150 ${isSelected ? "bg-blue-500/10 text-blue-400 font-medium" : "text-gray-300 hover:bg-[#334155]"
                                }`}
                            >
                              <span>{g.name}</span>
                              {isSelected && (
                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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

              {/* Ngày khởi chiếu & Độ tuổi */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Thời Lượng (Phút)
                  </label>
                  <input
                    type="date"
                    name="releaseDate"
                    value={formData.releaseDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Diễn Viên
                  </label>
                  <select
                    name="ageRating"
                    value={formData.ageRating}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="P">P - Phổ biến mọi lứa tuổi</option>
                    <option value="K">K - Dưới 13 tuổi cần người giám hộ</option>
                    <option value="T13">T13 - Từ đủ 13 tuổi trở lên</option>
                    <option value="T16">T16 - Từ đủ 16 tuổi trở lên</option>
                    <option value="T18">T18 - Từ đủ 18 tuổi trở lên</option>
                  </select>
                </div>
              </div>

              {/* Nhãn nổi bật & Trạng thái phim */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Khởi Chiếu Từ Ngày
                  </label>
                  <select
                    name="highlight"
                    value={formData.highlight}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">Bình thường</option>
                    <option value="NEW">NEW – Phim mới ra mắt</option>
                    <option value="HOT">HOT – Phim đang gây bão</option>
                    <option value="TRENDING">TRENDING – Phim xu hướng</option>
                    <option value="POPULAR">POPULAR – Phim ăn khách nhất</option>
                    {/* Fix #3: Bỏ COMING_SOON khỏi highlight vì trùng tên với movieStatus */}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Kết Thúc Ngày
                  </label>
                  {/* Fix #2: Bỏ disabled → cho phép chọn status ngay khi tạo mới */}
                  <select
                    name="movieStatus"
                    value={formData.movieStatus}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="NOW_SHOWING">NOW_SHOWING – Đang chiếu</option>
                    <option value="COMING_SOON">COMING_SOON – Sắp chiếu</option>
                    <option value="ENDED">ENDED – Đã kết thúc</option>
                    <option value="INACTIVE">INACTIVE – Tạm ẩn</option>
                    <option value="ARCHIVED">ARCHIVED – Lưu trữ</option>
                  </select>
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
                  className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* Nội dung phim */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                  Nội Dung Phim
                </label>
                <textarea
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Mô tả nội dung phim ngắn gọn..."
                  className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                ></textarea>
              </div>
            </form>

            {/* Footer Buttons */}
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
                onClick={handleSubmit}
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
