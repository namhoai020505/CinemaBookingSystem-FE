import React, { useEffect, useState, useRef } from "react";
import { toast } from "react-toastify";
import { movieService } from "../../services/movieService";
import type { MovieResponse } from "../../services/movieService";
import { getMediaUrl } from "../../lib/media";

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
    language: "Tiếng Việt",
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

  // States for DB-backed Genre Selection
  const [genres, setGenres] = useState<{ genreId: number; name: string }[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const [genreSearch, setGenreSearch] = useState("");
  const genreDropdownRef = useRef<HTMLDivElement>(null);

  // 1. Hàm lấy danh sách phim (Fetch tất cả để xử lý client-side)
  const fetchMovies = async () => {
    try {
      setLoading(true);
      const response = await movieService.getMoviesWithPagination(1, 1000, "");
      if (response) {
        setAllMovies(response.items || []);
      }
    } catch (error) {
      toast.error("Không thể tải danh sách phim.");
    } finally {
      setLoading(false);
    }
  };

  const filteredMovies = React.useMemo(() => {
    return allMovies.filter(movie => {
      if (selectedStatus && movie.movieStatus !== selectedStatus) return false;
      if (searchGenre && (!movie.genres || !movie.genres.includes(searchGenre))) return false;
      if (searchTerm && !movie.movieNameVn.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [allMovies, selectedStatus, searchGenre, searchTerm]);

  const totalCount = filteredMovies.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const movies = filteredMovies.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);

  const fetchGenres = async () => {
    try {
      const data = await movieService.getGenres();
      setGenres(data || []);
    } catch (error) {
      toast.error("Không thể tải danh sách thể loại.");
    }
  };

  useEffect(() => {
    void fetchGenres();
  }, []);

  useEffect(() => {
    void fetchMovies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        genreDropdownRef.current &&
        !genreDropdownRef.current.contains(event.target as Node)
      ) {
        setIsGenreDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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
      language: "Tiếng Việt",
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
          language: detail.language || "Tiếng Việt",
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

        setPosterFile(null);
        setPosterPreview(getMediaUrl(detail.posterUrl) || "");
        setOriginalPosterUrl(detail.posterUrl || "");
        setErrors({});
        setIsModalOpen(true);
      }
    } catch (error) {
      toast.error("Không thể tải chi tiết phim để chỉnh sửa.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMovie = async (movie: MovieResponse) => {
    const confirmDelete = window.confirm(
      `⚠️ Bạn có chắc chắn muốn ẩn bộ phim "${movie.movieNameVn}" khỏi hệ thống không?\n\nPhim sẽ được chuyển sang trạng thái "Tạm Ẩn" (Soft Delete). Các suất chiếu đang mở sẽ bị hủy và hoàn tiền vé nếu có.`,
    );
    if (confirmDelete) {
      try {
        setLoading(true);
        await movieService.deleteMovie(movie.id);
        toast.success("Đã ẩn phim thành công! Phim chuyển sang trạng thái Tạm Ẩn.");
        await handleReloadAfterSave();
      } catch (error) {
        toast.error("Không thể ẩn phim. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleReactivateMovie = async (movie: MovieResponse) => {
    const confirmReactivate = window.confirm(
      `🔄 Bạn có muốn kích hoạt lại bộ phim "${movie.movieNameVn}" không?\n\nPhim sẽ chuyển sang trạng thái "Sắp Chiếu" và có thể xếp lịch chiếu.`
    );
    if (confirmReactivate) {
      try {
        setLoading(true);
        // Tải chi tiết phim để xây dựng FormData đầy đủ
        const detail = await movieService.getMovieById(movie.id);
        if (!detail) {
          toast.error("Không thể tải chi tiết phim để kích hoạt.");
          return;
        }

        const submitData = new FormData();
        submitData.append("Title", detail.title);
        submitData.append("DurationMinutes", String(detail.durationMinutes));

        // Ánh xạ các thể loại hiện tại thành IDs
        const matchedIds = (detail.genres ?? [])
          .map(name => genres.find(g => g.name.toLowerCase() === name.toLowerCase())?.genreId)
          .filter((id): id is number => id !== undefined);

        if (matchedIds.length > 0) {
          matchedIds.forEach(id => {
            submitData.append("GenreIds", String(id));
          });
        }

        if (detail.language) submitData.append("Language", detail.language);
        if (detail.releaseDate) submitData.append("ReleaseDate", detail.releaseDate);
        if (detail.ageRating) submitData.append("AgeRating", detail.ageRating);
        if (detail.description) submitData.append("Description", detail.description);
        if (detail.trailerUrl) submitData.append("TrailerUrl", detail.trailerUrl);
        if (detail.highlight) submitData.append("Highlight", detail.highlight);
        if (detail.director) submitData.append("Director", detail.director);

        // Thiết lập trạng thái mới là COMING_SOON để kích hoạt lại phim
        submitData.append("MovieStatus", "COMING_SOON");

        // Gửi URL ảnh hiện có
        if (detail.posterUrl) {
          submitData.append("PosterUrl", detail.posterUrl);
        }

        await movieService.updateMovie(detail.movieId, submitData);
        toast.success("Kích hoạt lại phim thành công!");
        await handleReloadAfterSave();
      } catch (error: any) {
        const errorMsg = error?.response?.data?.message || "Không thể kích hoạt lại phim.";
        toast.error(errorMsg);
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
    if (name === "title" && value.trim() !== "") {
      setErrors({ ...errors, title: undefined });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ảnh poster quá lớn! Vui lòng chọn ảnh dưới 5MB.");
        e.target.value = "";
        return;
      }
      setPosterFile(file);
      setPosterPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setErrors({ title: "Tên phim không được để trống!" });
      return;
    }
    if (formData.durationMinutes <= 0) {
      setErrors({ durationMinutes: "Thời lượng phim phải lớn hơn 0!" });
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
        await movieService.updateMovie(editingMovieId, submitData);
        toast.success("Cập nhật thông tin phim thành công!");
      } else {
        await movieService.createMovie(submitData);
        toast.success("Thêm phim mới thành công!");
      }

      setIsModalOpen(false);
      setEditingMovieId(null);
      setPosterFile(null);
      setPosterPreview("");
      setOriginalPosterUrl("");
      await handleReloadAfterSave();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || "Lưu thông tin thất bại.";
      toast.error(errorMsg);
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
          <p className="text-xs text-gray-400 mt-1">Quản lý kho phim, tải ảnh poster và đồng bộ lịch chiếu của rạp</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2 bg-[#4318FF] hover:bg-blue-700 rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-lg"
        >
          <span>+</span> Thêm Phim Mới
        </button>
      </div>

      {/* BỘ LỌC VÀ TÌM KIẾM */}
      <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
        {/* BỘ LỌC PHÂN LOẠI TRẠNG THÁI */}
        <div className="flex gap-2 bg-[#111C44] p-3 rounded-2xl border border-gray-800 shadow-xl overflow-x-auto scrollbar-none">
          {[
            { key: "", label: "🎬 Tất Cả Phim" },
            { key: "NOW_SHOWING", label: "🟢 Đang Chiếu" },
            { key: "COMING_SOON", label: "🔵 Sắp Chiếu" },
            { key: "ENDED", label: "🟡 Đã Kết Thúc" },
            { key: "INACTIVE", label: "🔴 Tạm Ẩn" },
            { key: "ARCHIVED", label: "🟣 Lưu Trữ" },
          ].map((tab) => {
            const isActive = selectedStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleStatusFilterChange(tab.key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0 ${isActive
                  ? "bg-[#4318FF] text-white shadow-lg shadow-[#4318FF]/20"
                  : "bg-[#0F172A] hover:bg-[#1E293B] text-gray-400 hover:text-white"
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* SEARCH BAR */}
        <div className="flex gap-2 bg-[#111C44] p-3 rounded-2xl border border-gray-800 shadow-xl">
          <input
            type="text"
            placeholder="Tìm theo tên phim..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearchTerm(searchInput);
                setPageIndex(1);
              }
            }}
            className="w-full lg:w-48 bg-[#0F172A] border border-gray-700 text-sm text-white px-4 py-2 rounded-xl focus:outline-none focus:border-[#4318FF] transition"
          />
          <select
            value={searchGenre}
            onChange={(e) => {
              setSearchGenre(e.target.value);
              setPageIndex(1);
            }}
            className="bg-[#0F172A] border border-gray-700 text-sm text-white px-4 py-2 rounded-xl focus:outline-none focus:border-[#4318FF] transition"
          >
            <option value="">Tất cả thể loại</option>
            {genres.map(g => (
              <option key={g.genreId} value={g.name}>{g.name}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearchTerm(searchInput);
              setPageIndex(1);
            }}
            className="px-4 py-2 bg-[#4318FF] hover:bg-blue-700 rounded-xl text-sm font-semibold transition text-white shadow-lg"
          >
            Tìm Kiếm
          </button>
        </div>
      </div>

      {/* DANH SÁCH BẢNG */}
      {loading && movies.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-[#111C44] border border-gray-800 rounded-2xl">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          Đang đồng bộ dữ liệu phim từ máy chủ...
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
                  Đang tải...
                </div>
              </div>
            )}
            <div className="bg-[#111C44] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-800 bg-blue-950/20 text-xs uppercase text-gray-400 tracking-wider">
                      <th className="p-4 w-24">Poster</th>
                      <th className="p-4">Tên Phim</th>
                      <th className="p-4">Đạo Diễn</th>
                      <th className="p-4">Thể Loại</th>
                      <th className="p-4">Thời Lượng</th>
                      <th className="p-4">Độ Tuổi</th>
                      <th className="p-4">Trạng Thái</th>
                      <th className="p-4 text-center">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50 text-sm">
                    {movies.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-500">
                          Chưa có bộ phim nào trong danh sách.
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
                            {movie.director || <span className="text-gray-500 italic">Chưa cập nhật</span>}
                          </td>
                          <td className="p-4 text-gray-300 font-medium">
                            {movie.genres?.join(", ") || "Chưa cập nhật"}
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-xs font-semibold">
                              {movie.duration} phút
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
                              let text = "Đang chiếu";

                              if (status === "COMING_SOON") {
                                dotColor = "bg-blue-500";
                                text = "Sắp chiếu";
                              } else if (status === "ENDED") {
                                dotColor = "bg-amber-500";
                                text = "Đã kết thúc";
                              } else if (status === "INACTIVE") {
                                dotColor = "bg-rose-500";
                                text = "Tạm ẩn";
                              } else if (status === "ARCHIVED") {
                                dotColor = "bg-purple-500";
                                text = "Lưu trữ";
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
                                Sửa
                              </button>
                              {/* Fix #5: Ẩn nút Xóa nếu phim đã ở trạng thái INACTIVE (soft-deleted) */}
                              {movie.movieStatus !== "INACTIVE" ? (
                                <button
                                  onClick={() => handleDeleteMovie(movie)}
                                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-xs font-semibold rounded-lg transition"
                                >
                                  Ẩn Phim
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReactivateMovie(movie)}
                                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 text-xs font-semibold rounded-lg transition"
                                >
                                  Hiện Phim
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
                ? "Không có phim nào trong danh sách"
                : `Hiển thị ${(pageIndex - 1) * pageSize + 1}–${Math.min(pageIndex * pageSize, totalCount)} trong số ${totalCount} phim`}
            </span>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <button
                  disabled={pageIndex === 1 || loading}
                  onClick={() => setPageIndex((prev) => prev - 1)}
                  className="px-3 py-1.5 bg-[#0F172A] border border-gray-800 rounded-lg text-xs font-semibold text-gray-300 hover:bg-[#1E293B] disabled:opacity-40 transition"
                >
                  ◀ Trang trước
                </button>
                <span className="px-3 py-1.5 text-xs font-semibold bg-[#4318FF]/20 text-blue-400 rounded-lg border border-blue-500/30">
                  Trang {pageIndex} / {totalPages}
                </span>
                <button
                  disabled={pageIndex === totalPages || loading}
                  onClick={() => setPageIndex((prev) => prev + 1)}
                  className="px-3 py-1.5 bg-[#0F172A] border border-gray-800 rounded-lg text-xs font-semibold text-gray-300 hover:bg-[#1E293B] disabled:opacity-40 transition"
                >
                  Trang sau ▶
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
              {/* Tên phim & Thời lượng */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Tên Phim (Tiếng Việt) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Nhập tên tiếng Việt..."
                    className={`w-full px-4 py-2 bg-[#0F172A] border ${errors.title ? "border-red-500 focus:ring-red-500" : "border-gray-800 focus:ring-blue-500"} text-white text-sm focus:outline-none focus:ring-2 rounded-xl`}
                  />
                  {errors.title && (
                    <p className="text-red-500 text-xs mt-1 font-medium">
                      ⚠ {errors.title}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Thời Lượng (Phút)
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
                    Thể Loại
                  </label>
                  <div
                    onClick={() => setIsGenreDropdownOpen(!isGenreDropdownOpen)}
                    className="min-h-[38px] w-full px-3 py-1.5 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer flex flex-wrap gap-1.5 items-center select-none"
                  >
                    {selectedGenreIds.length === 0 ? (
                      <span className="text-gray-500">Chọn thể loại...</span>
                    ) : (
                      selectedGenreIds.map((id) => {
                        const g = genres.find((item) => item.genreId === id);
                        if (!g) return null;
                        return (
                          <span
                            key={id}
                            className="flex items-center gap-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-md text-xs font-semibold"
                          >
                            {g.name}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGenreIds(selectedGenreIds.filter((x) => x !== id));
                              }}
                              className="text-blue-400 hover:text-blue-200 focus:outline-none font-bold"
                            >
                              &times;
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>

                  {isGenreDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-[#1E293B] border border-gray-700 rounded-xl shadow-2xl overflow-hidden max-h-60 flex flex-col animate-fadeIn">
                      <div className="p-2 border-b border-gray-800 bg-[#0F172A]">
                        <input
                          type="text"
                          placeholder="Tìm thể loại..."
                          value={genreSearch}
                          onChange={(e) => setGenreSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-3 py-1 bg-[#1E293B] border border-gray-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {genres
                          .filter((g) =>
                            g.name.toLowerCase().includes(genreSearch.toLowerCase())
                          )
                          .map((g) => {
                            const isSelected = selectedGenreIds.includes(g.genreId);
                            return (
                              <div
                                key={g.genreId}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isSelected) {
                                    setSelectedGenreIds(
                                      selectedGenreIds.filter((x) => x !== g.genreId)
                                    );
                                  } else {
                                    setSelectedGenreIds([...selectedGenreIds, g.genreId]);
                                  }
                                }}
                                className={`px-4 py-2 text-sm text-gray-200 hover:bg-[#334155] cursor-pointer flex items-center justify-between transition-colors duration-150 ${isSelected ? "bg-blue-500/10 text-blue-400" : ""
                                  }`}
                              >
                                <span>{g.name}</span>
                                {isSelected && (
                                  <svg
                                    className="w-4 h-4 text-blue-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                )}
                              </div>
                            );
                          })}
                        {genres.filter((g) =>
                          g.name.toLowerCase().includes(genreSearch.toLowerCase())
                        ).length === 0 && (
                            <div className="px-4 py-3 text-xs text-gray-500 text-center">
                              Không tìm thấy thể loại
                            </div>
                          )}
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
                    placeholder="Nhập tên đạo diễn..."
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Ngôn Ngữ
                  </label>
                  <input
                    type="text"
                    name="language"
                    value={formData.language}
                    onChange={handleInputChange}
                    placeholder="Tiếng Việt, Phụ đề Tiếng Anh..."
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Ngày khởi chiếu & Độ tuổi */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Khởi Chiếu Từ Ngày
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
                    Độ Tuổi Cho Phép
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
                    Nhãn nổi bật (Highlight)
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
                    Trạng Thái Phân Phối
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

              {/* Tải ảnh poster trực quan */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                  Ảnh Poster Phim
                </label>
                <div className="flex gap-4 items-center mt-2">
                  {posterPreview ? (
                    <div className="relative w-24 h-32 rounded-xl overflow-hidden border border-gray-700 shadow-md">
                      <img src={posterPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setPosterFile(null);
                          setPosterPreview("");
                        }}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-[10px] shadow"
                      >
                        &times;
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-32 rounded-xl bg-[#0F172A] border border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-500 text-xs text-center p-2">
                      <span>No poster</span>
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="border border-dashed border-gray-700 rounded-xl p-4 text-center hover:border-blue-500 transition cursor-pointer relative bg-[#0F172A]">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <span className="text-xs text-gray-400">
                        {posterFile ? `📂 ${posterFile.name}` : "📥 Click hoặc kéo thả ảnh để tải lên Poster"}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">Định dạng hỗ trợ: JPG, PNG, WEBP. Dung lượng tối đa 5MB.</p>
                  </div>
                </div>
              </div>

              {/* Mô tả nội dung */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                  Nội Dung Mô Tả Phim
                </label>
                <textarea
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Mô tả tóm tắt nội dung cốt truyện..."
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
                {editingMovieId ? "Cập Nhật" : "Lưu Thông Tin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
