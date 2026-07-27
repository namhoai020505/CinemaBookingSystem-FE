import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { movieService } from "../../services/movieService";
import type { MovieResponse } from "../../services/movieService";
import { getMediaUrl } from "../../lib/media";
import { TEXT } from "../../constants/vi";
import { confirmWithPopup } from "../../services/confirmDialogService";

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

export default function ManageMovie() {
  const [allMovies, setAllMovies] = useState<MovieResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null);
  const [autofillUrl, setAutofillUrl] = useState("");
  const [isAutofilling, setIsAutofilling] = useState(false);

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
    bannerUrl: "",
    highlight: "",
    movieStatus: "",
    director: "",
  });

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string>("");
  const [originalPosterUrl, setOriginalPosterUrl] = useState<string>("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string>("");
  const [isUploadingBanner, setIsUploadingBanner] = useState<boolean>(false);

  const [errors, setErrors] = useState<{ title?: string; durationMinutes?: string }>({});

  // Search Filters
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchGenres, setSearchGenres] = useState<string[]>([]);

  // States for DB-backed Genre Selection
  const [genres, setGenres] = useState<{ genreId: number; name: string }[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const [genreSearchInput, setGenreSearchInput] = useState("");
  const genreDropdownRef = useRef<HTMLDivElement>(null);

  // States for external filter genre search
  const [isFilterGenreDropdownOpen, setIsFilterGenreDropdownOpen] = useState(false);
  const [filterGenreSearchInput, setFilterGenreSearchInput] = useState("");
  const filterGenreDropdownRef = useRef<HTMLDivElement>(null);

  const closeGenreDropdown = useCallback(() => {
    setIsGenreDropdownOpen(false);
    setGenreSearchInput("");
  }, []);

  const closeFilterGenreDropdown = useCallback(() => {
    setIsFilterGenreDropdownOpen(false);
    setFilterGenreSearchInput("");
  }, []);

  // 1. Hàm lấy danh sách phim (Fetch tất cả để xử lý client-side)
  const fetchMovies = useCallback(async () => {
    try {
      setLoading(true);
      const response = await movieService.getMoviesWithPagination(1, 1000, "");
      if (response) {
        setAllMovies(response.items || []);
      }
    } catch {
      toast.error(TEXT.MOVIE.ERR_FETCH_MOVIES);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredMovies = React.useMemo(() => {
    return allMovies.filter(movie => {
      // Khi chọn Tất cả (selectedStatus là rỗng): chỉ hiện phim Đang chiếu (NOW_SHOWING) và Sắp chiếu (COMING_SOON)
      if (selectedStatus === "") {
        if (movie.movieStatus !== "NOW_SHOWING" && movie.movieStatus !== "COMING_SOON") return false;
      } else {
        // Khi chọn một trạng thái cụ thể: chỉ hiện phim có trạng thái đó
        if (movie.movieStatus !== selectedStatus) return false;
      }
      const movieGenres = movie.genres ?? [];
      if (searchGenres.length > 0 && !searchGenres.some(sg => movieGenres.includes(sg))) return false;
      if (searchTerm && !movie.movieNameVn.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [allMovies, selectedStatus, searchGenres, searchTerm]);

  const totalCount = filteredMovies.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const movies = filteredMovies.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);

  const fetchGenres = useCallback(async () => {
    try {
      const data = await movieService.getGenres();
      setGenres(data || []);
    } catch {
      toast.error(TEXT.MOVIE.ERR_FETCH_GENRES);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchGenres();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchGenres]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        genreDropdownRef.current &&
        !genreDropdownRef.current.contains(event.target as Node)
      ) {
        closeGenreDropdown();
      }
      if (
        filterGenreDropdownRef.current &&
        !filterGenreDropdownRef.current.contains(event.target as Node)
      ) {
        closeFilterGenreDropdown();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeFilterGenreDropdown, closeGenreDropdown]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchMovies();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchMovies]);



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
      bannerUrl: "",
      highlight: "",
      movieStatus: "",
      director: "",
    });
    setSelectedGenreIds([]);
    setPosterFile(null);
    setPosterPreview("");
    setOriginalPosterUrl("");
    setBannerFile(null);
    setBannerPreview("");
    setErrors({});
    setAutofillUrl("");
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
          bannerUrl: detail.bannerUrl || "",
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
        setBannerFile(null);
        setBannerPreview((detail.bannerUrl && detail.bannerUrl !== "none") ? getMediaUrl(detail.bannerUrl) : "");
        setErrors({});
        setAutofillUrl("");
        setIsModalOpen(true);
      }
    } catch {
      toast.error(TEXT.MOVIE.ERR_FETCH_DETAIL_EDIT);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMovie = async (movie: MovieResponse) => {
    const confirmDelete = await confirmWithPopup({
      title: "Ẩn phim?",
      message: TEXT.MOVIE.CONFIRM_HIDE.replace("{0}", movie.movieNameVn),
      confirmLabel: "Ẩn phim",
      cancelLabel: "Giữ lại",
    });
    if (confirmDelete) {
      try {
        setLoading(true);
        await movieService.deleteMovie(movie.id);
        toast.success(TEXT.MOVIE.SUCCESS_HIDE);
        await handleReloadAfterSave();
      } catch {
        toast.error(TEXT.MOVIE.ERR_HIDE);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleReactivateMovie = async (movie: MovieResponse) => {
    const confirmReactivate = await confirmWithPopup({
      title: "Kích hoạt lại phim?",
      message: TEXT.MOVIE.CONFIRM_REACTIVATE.replace("{0}", movie.movieNameVn),
      confirmLabel: "Kích hoạt",
      cancelLabel: "Quay lại",
    });
    if (confirmReactivate) {
      try {
        setLoading(true);
        // Tải chi tiết phim để xây dựng FormData đầy đủ
        const detail = await movieService.getMovieById(movie.id);
        if (!detail) {
          toast.error(TEXT.MOVIE.ERR_FETCH_DETAIL_ACTIVATE);
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
        toast.success(TEXT.MOVIE.SUCCESS_REACTIVATE);
        await handleReloadAfterSave();
      } catch (error) {
        toast.error(getApiErrorMessage(error, TEXT.MOVIE.ERR_REACTIVATE));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAutofillClick = async () => {
    if (!autofillUrl) return;
    setIsAutofilling(true);
    try {
      const data = await movieService.autofillMovie(autofillUrl);
      
      setFormData(prev => ({
        ...prev,
        title: data.title || prev.title,
        durationMinutes: data.durationMinutes || prev.durationMinutes,
        language: data.language || prev.language,
        releaseDate: data.releaseDate || prev.releaseDate,
        ageRating: data.ageRating || prev.ageRating,
        description: data.description || prev.description,
        trailerUrl: data.trailerUrl || prev.trailerUrl,
        bannerUrl: data.bannerUrl || prev.bannerUrl,
        director: data.director || prev.director,
      }));

      // Set poster preview to the extracted URL
      if (data.posterUrl) {
        setPosterPreview(data.posterUrl);
      }
      if (data.bannerUrl && data.bannerUrl !== "none") {
        setBannerPreview(data.bannerUrl);
      }

      if (data.genres && data.genres.length > 0) {
        const matchedIds = data.genres
          .map(name => genres.find(g => g.name.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(g.name.toLowerCase()))?.genreId)
          .filter((id): id is number => id !== undefined);
        setSelectedGenreIds(matchedIds);
      }

      toast.success("Tự động trích xuất thông tin phim thành công!");
    } catch {
      toast.error("Không thể đọc thông tin phim từ link này. Vui lòng kiểm tra lại!");
    } finally {
      setIsAutofilling(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    const parsed = name === "durationMinutes" ? (value === "" ? 0 : Number(value)) : value;
    setFormData({ ...formData, [name]: parsed });
    if (name === "title" && value.trim() !== "") {
      setErrors({ ...errors, title: undefined });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(TEXT.MOVIE.ERR_POSTER_SIZE);
        e.target.value = "";
        return;
      }
      setPosterFile(file);
      setPosterPreview(URL.createObjectURL(file));
    }
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error("File banner không được vượt quá 8MB.");
        e.target.value = "";
        return;
      }
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadBanner = async () => {
    if (!editingMovieId) {
      toast.error("Vui lòng lưu thông tin phim trước khi tải banner.");
      return;
    }
    if (!bannerFile && !formData.bannerUrl) {
      toast.error("Vui lòng chọn file banner hoặc nhập banner URL.");
      return;
    }

    try {
      setIsUploadingBanner(true);
      const updatedBannerUrl = await movieService.uploadMovieBanner(
        editingMovieId,
        bannerFile || undefined,
        bannerFile ? undefined : formData.bannerUrl
      );
      
      setFormData(prev => ({ ...prev, bannerUrl: updatedBannerUrl }));
      setBannerPreview(getMediaUrl(updatedBannerUrl));
      setBannerFile(null);
      toast.success("Tải banner phim lên thành công!");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải banner lên."));
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleDeleteBanner = async () => {
    if (!editingMovieId) {
      setBannerFile(null);
      setBannerPreview("");
      setFormData(prev => ({ ...prev, bannerUrl: "" }));
      return;
    }

    const confirmed = await confirmWithPopup({
      title: "Xóa banner phim?",
      message: "Bạn có chắc chắn muốn xóa banner của phim này?",
      confirmLabel: "Xóa banner",
      cancelLabel: "Giữ lại",
    });
    if (!confirmed) {
      return;
    }

    try {
      setIsUploadingBanner(true);
      await movieService.deleteMovieBanner(editingMovieId);
      setFormData(prev => ({ ...prev, bannerUrl: "none" }));
      setBannerPreview("");
      setBannerFile(null);
      toast.success("Xóa banner phim thành công!");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa banner."));
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setErrors({ title: TEXT.MOVIE.ERR_TITLE_EMPTY });
      return;
    }
    if (formData.durationMinutes <= 0) {
      setErrors({ durationMinutes: TEXT.MOVIE.ERR_DURATION_INVALID });
      return;
    }

    try {
      setLoading(true);
      const submitData = new FormData();
      submitData.append("Title", formData.title);
      submitData.append("DurationMinutes", String(formData.durationMinutes));
      submitData.append("IsDurationConfirmed", "true");

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
      if (formData.bannerUrl) submitData.append("BannerUrl", formData.bannerUrl);
      if (formData.highlight) submitData.append("Highlight", formData.highlight);
      if (formData.director) submitData.append("Director", formData.director);

      // Gửi MovieStatus cho cả create và update
      submitData.append("MovieStatus", formData.movieStatus);

      // Nếu không upload file mới, gửi URL poster cũ hoặc URL poster trích xuất từ Gemini
      if (!posterFile && posterPreview) {
        submitData.append("PosterUrl", originalPosterUrl || posterPreview);
      }

      if (posterFile) {
        submitData.append("posterFile", posterFile);
      }

      if (editingMovieId) {
        await movieService.updateMovie(editingMovieId, submitData);
        toast.success(TEXT.MOVIE.SUCCESS_UPDATE);
      } else {
        await movieService.createMovie(submitData);
        toast.success(TEXT.MOVIE.SUCCESS_CREATE);
      }

      setIsModalOpen(false);
      setEditingMovieId(null);
      setPosterFile(null);
      setPosterPreview("");
      setOriginalPosterUrl("");
      setBannerFile(null);
      setBannerPreview("");
      await handleReloadAfterSave();
    } catch (error) {
      toast.error(getApiErrorMessage(error, TEXT.MOVIE.ERR_SAVE));
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
            {TEXT.MOVIE.TITLE}
          </h1>
          <p className="text-xs text-gray-400 mt-1">{TEXT.MOVIE.SUBTITLE}</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2 bg-[#4318FF] hover:bg-blue-700 rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-lg"
        >
          <span>+</span> {TEXT.MOVIE.ADD_MOVIE}
        </button>
      </div>

      {/* BỘ LỌC VÀ TÌM KIẾM */}
      <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
        {/* BỘ LỌC PHÂN LOẠI TRẠNG THÁI */}
        <div className="flex gap-2 bg-[#111C44] p-3 rounded-2xl border border-gray-800 shadow-xl overflow-x-auto scrollbar-none">
          {[
            { key: "", label: TEXT.MOVIE.STATUS_ALL },
            { key: "NOW_SHOWING", label: TEXT.MOVIE.STATUS_NOW_SHOWING },
            { key: "COMING_SOON", label: TEXT.MOVIE.STATUS_COMING_SOON },
            { key: "ENDED", label: TEXT.MOVIE.STATUS_ENDED },
            { key: "INACTIVE", label: TEXT.MOVIE.STATUS_INACTIVE },
            { key: "ARCHIVED", label: TEXT.MOVIE.STATUS_ARCHIVED },
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
            placeholder={TEXT.MOVIE.SEARCH_PLACEHOLDER}
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
          <div className="relative min-w-[180px]" ref={filterGenreDropdownRef}>
            <div className="relative flex items-center">
              <input
                type="text"
                value={isFilterGenreDropdownOpen ? filterGenreSearchInput : searchGenres.join(", ")}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterGenreSearchInput(val);
                  if (val === "") {
                    setSearchGenres([]);
                    setPageIndex(1);
                  }
                  setIsFilterGenreDropdownOpen(true);
                }}
                onFocus={() => {
                  setFilterGenreSearchInput("");
                  setIsFilterGenreDropdownOpen(true);
                }}
                placeholder={TEXT.MOVIE.ALL_GENRES}
                className="bg-[#0F172A] border border-gray-700 text-sm text-white px-4 py-2 pr-10 rounded-xl focus:outline-none focus:border-[#4318FF] transition w-full min-h-[38px] truncate"
              />
              <div
                className="absolute right-3 cursor-pointer"
                onClick={() => {
                  if (isFilterGenreDropdownOpen) {
                    closeFilterGenreDropdown();
                  } else {
                    setIsFilterGenreDropdownOpen(true);
                  }
                }}
              >
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {isFilterGenreDropdownOpen && (
              <div className="absolute right-0 z-50 mt-1 w-56 bg-[#1E293B] border border-gray-700 rounded-xl shadow-2xl overflow-hidden max-h-60 flex flex-col animate-fadeIn">
                <div className="overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#1E293B] [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
                  <div
                    onClick={() => {
                      setSearchGenres([]);
                      setPageIndex(1);
                      closeFilterGenreDropdown();
                    }}
                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors duration-150 ${searchGenres.length === 0 ? "bg-blue-500/10 text-blue-400 font-medium" : "text-gray-300 hover:bg-[#334155]"
                      }`}
                  >
                    {TEXT.MOVIE.ALL_GENRES}
                  </div>
                  {genres
                    .filter((g) => g.name.toLowerCase().includes(filterGenreSearchInput.toLowerCase()))
                    .map((g) => {
                      const isSelected = searchGenres.includes(g.name);
                      return (
                        <div
                          key={g.genreId}
                          onClick={() => {
                            let nextGenres: string[];
                            if (isSelected) {
                              nextGenres = searchGenres.filter(name => name !== g.name);
                            } else {
                              nextGenres = [...searchGenres, g.name];
                            }
                            setSearchGenres(nextGenres);
                            setPageIndex(1);
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
                  {genres.filter((g) => g.name.toLowerCase().includes(filterGenreSearchInput.toLowerCase())).length === 0 && (
                    <div className="px-4 py-3 text-xs text-gray-500 italic text-center">
                      Không tìm thấy thể loại nào
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setSearchTerm(searchInput);
              setPageIndex(1);
            }}
            className="px-4 py-2 bg-[#4318FF] hover:bg-blue-700 rounded-xl text-sm font-semibold transition text-white shadow-lg"
          >
            {TEXT.MOVIE.BTN_SEARCH}
          </button>
        </div>
      </div>

      {/* DANH SÁCH BẢNG */}
      {loading && movies.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-[#111C44] border border-gray-800 rounded-2xl">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          {TEXT.MOVIE.SYNCING}
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
                  ? TEXT.MOVIE.MODAL_UPDATE_TITLE
                  : TEXT.MOVIE.MODAL_ADD_TITLE}
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
              {/* Tự động điền với Gemini */}
              <div className="bg-[#1e293b]/40 p-4 rounded-xl border border-gray-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                    Tự động điền thông tin phim
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Nhập link IMDb, Wikipedia... rồi ấn Trích xuất để Gemini điền form
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Ví dụ: https://www.imdb.com/title/tt11858890/"
                    value={autofillUrl}
                    onChange={(e) => setAutofillUrl(e.target.value)}
                    className="flex-1 px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    disabled={isAutofilling || !autofillUrl}
                    onClick={handleAutofillClick}
                    className="px-4 py-2 bg-[#4318FF] hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 shadow-md text-white"
                  >
                    {isAutofilling ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Đang trích xuất...</span>
                      </>
                    ) : (
                      <>
                        <span>Trích xuất</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Tên phim & Thời lượng */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    {TEXT.MOVIE.LABEL_TITLE} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder={TEXT.MOVIE.PLACEHOLDER_TITLE}
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
                    {TEXT.MOVIE.LABEL_DURATION}
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
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={isGenreDropdownOpen ? genreSearchInput : selectedGenreIds.map(id => genres.find(g => g.genreId === id)?.name).filter(Boolean).join(", ")}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGenreSearchInput(val);
                        if (val === "") {
                          setSelectedGenreIds([]);
                        }
                        setIsGenreDropdownOpen(true);
                      }}
                      onFocus={() => {
                        setGenreSearchInput("");
                        setIsGenreDropdownOpen(true);
                      }}
                      placeholder={TEXT.MOVIE.PLACEHOLDER_GENRE}
                      className="w-full px-4 py-2 pr-10 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[38px] truncate"
                    />
                      <div
                        className="absolute right-3 cursor-pointer"
                        onClick={() => {
                          if (isGenreDropdownOpen) {
                            closeGenreDropdown();
                          } else {
                            setIsGenreDropdownOpen(true);
                          }
                        }}
                      >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {isGenreDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-[#1E293B] border border-gray-700 rounded-xl shadow-2xl overflow-hidden max-h-60 flex flex-col animate-fadeIn">
                      <div className="overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#1E293B] [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
                        <div
                          onClick={() => {
                            setSelectedGenreIds([]);
                            closeGenreDropdown();
                          }}
                          className={`px-4 py-2.5 text-sm cursor-pointer transition-colors duration-150 ${selectedGenreIds.length === 0 ? "bg-blue-500/10 text-blue-400 font-medium" : "text-gray-300 hover:bg-[#334155]"
                            }`}
                        >
                          {TEXT.MOVIE.PLACEHOLDER_GENRE}
                        </div>
                        {genres
                          .filter((g) => g.name.toLowerCase().includes(genreSearchInput.toLowerCase()))
                          .map((g) => {
                            const isSelected = selectedGenreIds.includes(g.genreId);
                            return (
                              <div
                                key={g.genreId}
                                onClick={() => {
                                  let nextIds: number[];
                                  if (isSelected) {
                                    nextIds = selectedGenreIds.filter(id => id !== g.genreId);
                                  } else {
                                    nextIds = [...selectedGenreIds, g.genreId];
                                  }
                                  setSelectedGenreIds(nextIds);
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
                        {genres.filter((g) => g.name.toLowerCase().includes(genreSearchInput.toLowerCase())).length === 0 && (
                          <div className="px-4 py-3 text-xs text-gray-500 italic text-center">
                            Không tìm thấy thể loại nào
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    {TEXT.MOVIE.LABEL_DIRECTOR}
                  </label>
                  <input
                    type="text"
                    name="director"
                    value={formData.director}
                    onChange={handleInputChange}
                    placeholder={TEXT.MOVIE.PLACEHOLDER_DIRECTOR}
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    {TEXT.MOVIE.LABEL_LANGUAGE}
                  </label>
                  <select
                    name="language"
                    value={formData.language}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">Chọn ngôn ngữ...</option>
                    <option value="VN">Tiếng Việt</option>
                    <option value="EN_SUB_VN">Tiếng Anh phụ đề tiếng Việt</option>
                    <option value="EN_DUB_VN">Tiếng Anh lồng tiếng Việt</option>
                    <option value="KR_SUB_VN">Tiếng Hàn phụ đề tiếng Việt</option>
                    <option value="JP_SUB_VN">Tiếng Nhật phụ đề tiếng Việt</option>
                    <option value="TH_SUB_VN">Tiếng Thái phụ đề tiếng Việt</option>
                    <option value="CN_SUB_VN">Tiếng Trung phụ đề tiếng Việt</option>
                  </select>
                </div>
              </div>

              {/* Ngày khởi chiếu & Độ tuổi */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    {TEXT.MOVIE.LABEL_RELEASE_DATE}
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
                    {TEXT.MOVIE.LABEL_AGE}
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
                    {TEXT.MOVIE.LABEL_HIGHLIGHT}
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
                    {TEXT.MOVIE.LABEL_STATUS}
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
                  {TEXT.MOVIE.LABEL_TRAILER}
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

              {/* Banner URL & Upload */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                  Banner (Ảnh ngang hiển thị trang chủ, khuyên dùng tỉ lệ ngang rộng 2:1 hoặc 16:9, ví dụ: 1920x620)
                </label>
                
                {/* Cách 1: URL Link */}
                <input
                  type="text"
                  name="bannerUrl"
                  value={formData.bannerUrl}
                  onChange={handleInputChange}
                  placeholder="https://example.com/banner.jpg hoặc để trống nếu tải file"
                  className="w-full px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                />

                {/* Cách 2: File Upload */}
                <div className="flex gap-4 items-center">
                  {bannerPreview ? (
                    <div className="relative w-32 h-20 rounded-xl overflow-hidden border border-gray-700 shadow-md bg-[#0F172A]">
                      <img src={bannerPreview} alt="Banner Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={handleDeleteBanner}
                        disabled={isUploadingBanner}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-[10px] shadow"
                        title="Xóa Banner"
                      >
                        &times;
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-20 rounded-xl bg-[#0F172A] border border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-500 text-xs text-center p-2">
                      <span>Chưa có Banner</span>
                    </div>
                  )}

                  <div className="flex-1 flex gap-2">
                    <div className="flex-1 border border-dashed border-gray-700 rounded-xl p-2 text-center hover:border-blue-500 transition cursor-pointer relative bg-[#0F172A]">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBannerFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <span className="text-xs text-gray-400">Chọn file ảnh</span>
                    </div>
                    {(bannerFile || (formData.bannerUrl && editingMovieId)) && (
                      <button
                        type="button"
                        onClick={handleUploadBanner}
                        disabled={isUploadingBanner}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow transition"
                      >
                        {isUploadingBanner ? "Đang tải..." : "Tải lên"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tải ảnh poster trực quan */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                  {TEXT.MOVIE.LABEL_POSTER}
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
                      <span>{TEXT.MOVIE.NO_POSTER}</span>
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
                        {posterFile ? `📂 ${posterFile.name}` : TEXT.MOVIE.POSTER_UPLOAD_DESC}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">{TEXT.MOVIE.POSTER_HINT}</p>
                  </div>
                </div>
              </div>

              {/* Mô tả nội dung */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                  {TEXT.MOVIE.LABEL_DESC}
                </label>
                <textarea
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder={TEXT.MOVIE.PLACEHOLDER_DESC}
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
                {TEXT.MOVIE.BTN_CANCEL_FORM}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-6 py-2 bg-[#4318FF] hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-lg transition"
              >
                {editingMovieId ? TEXT.MOVIE.BTN_UPDATE_FORM : TEXT.MOVIE.BTN_SAVE_FORM}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
