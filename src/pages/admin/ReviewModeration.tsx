import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FaCheck, FaExclamationTriangle, FaRegStar, FaStar, FaTimes } from 'react-icons/fa';
import { reviewService, type ReviewQueueItem } from '../../services/reviewService';

type ActionType = 'approve' | 'reject';

// Chuan hoa message loi tu Axios/backend thanh text gon de hien thi toast.
const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error ? error.message : fallback;
};

// Format ngay tao review theo locale Viet Nam.
const formatReviewDate = (value: string) => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return 'Dang cap nhat';
  }

  return new Date(timestamp).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
};

// Render sao danh gia bang icon de admin scan nhanh muc do hai long.
const RatingStars = ({ rating }: { rating: number }) => {
  const safeRating = Math.max(0, Math.min(5, Math.round(rating || 0)));

  return (
    <div className="flex items-center gap-1 text-[#FFD166]" aria-label={`${safeRating} sao`}>
      {Array.from({ length: 5 }, (_, index) =>
        index < safeRating ? (
          <FaStar key={index} className="h-4 w-4" />
        ) : (
          <FaRegStar key={index} className="h-4 w-4 text-slate-600" />
        ),
      )}
      <span className="ml-2 text-xs font-black text-slate-300">{safeRating}/5</span>
    </div>
  );
};

// Badge trang thai review de phan biet pending voi flagged/rejected can can thiep.
const StatusBadge = ({ status }: { status: string }) => {
  const normalizedStatus = (status || 'PENDING').toUpperCase();
  const badgeClass =
    normalizedStatus === 'FLAGGED'
      ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
      : normalizedStatus === 'REJECTED'
        ? 'border-rose-400/40 bg-rose-500/10 text-rose-200'
        : 'border-blue-400/40 bg-blue-500/10 text-blue-200';

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase ${badgeClass}`}>
      {normalizedStatus}
    </span>
  );
};

// Trang admin dung de duyet nhanh cac review dang cho kiem duyet.
export default function ReviewModeration() {
  const [reviews, setReviews] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState<Record<string, ActionType>>({});

  const flaggedCount = useMemo(
    () => reviews.filter((review) => (review.status || '').toUpperCase() === 'FLAGGED').length,
    [reviews],
  );

  // Tai hang doi moi nhat tu backend khi admin vao trang.
  useEffect(() => {
    let mounted = true;

    const fetchQueue = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await reviewService.getModerationQueue();

        if (!mounted) {
          return;
        }

        if (!response.success) {
          const statusSuffix = response.statusCode ? ` (HTTP ${response.statusCode})` : '';
          setReviews([]);
          setError(`${response.message || 'Khong tai duoc hang doi danh gia.'}${statusSuffix}`);
          return;
        }

        setReviews(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        if (mounted) {
          setError(getErrorMessage(err, 'Khong tai duoc hang doi danh gia.'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void fetchQueue();

    return () => {
      mounted = false;
    };
  }, []);

  // Xu ly duyet/tu choi va remove item khoi queue sau khi API thanh cong.
  const handleModeration = async (reviewId: string, action: ActionType) => {
    setProcessing((current) => ({ ...current, [reviewId]: action }));

    try {
      const response =
        action === 'approve'
          ? await reviewService.approveReview(reviewId)
          : await reviewService.rejectReview(reviewId);

      if (!response.success) {
        throw new Error(
          `${response.message || 'Khong cap nhat duoc danh gia.'}${
            response.statusCode ? ` (HTTP ${response.statusCode})` : ''
          }`,
        );
      }

      setReviews((current) => current.filter((review) => review.reviewId !== reviewId));
      toast.success(action === 'approve' ? 'Da duyet danh gia.' : 'Da tu choi danh gia.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Khong cap nhat duoc danh gia.'));
    } finally {
      setProcessing((current) => {
        const next = { ...current };
        delete next[reviewId];
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] p-6 text-white font-['Urbanist']">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#FFD166]">
            Reviews
          </p>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">
            Hang doi kiem duyet
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Cac danh gia moi nhat dang cho admin xu ly.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:w-[360px]">
          <div className="rounded-lg border border-slate-800 bg-[#111C44] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Trong hang doi
            </p>
            <p className="mt-1 text-2xl font-black text-white">{reviews.length}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#111C44] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Can chu y
            </p>
            <p className="mt-1 text-2xl font-black text-amber-200">{flaggedCount}</p>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#111C44] shadow-2xl">
        <div className="grid grid-cols-[1.1fr_180px_160px_220px] border-b border-slate-800 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-500">
          <span>Noi dung</span>
          <span>So sao</span>
          <span>Trang thai</span>
          <span className="text-right">Thao tac</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm font-bold text-slate-400">
            Dang tai hang doi kiem duyet...
          </div>
        ) : error ? (
          <div className="m-5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-5 text-sm font-bold text-rose-200">
            {error}
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-200">
              <FaCheck />
            </div>
            <p className="text-lg font-black">Khong con review nao can kiem duyet</p>
            <p className="text-sm text-slate-400">Hang doi hien dang trong.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {reviews.map((review) => {
              const currentAction = processing[review.reviewId];
              const isBusy = Boolean(currentAction);

              return (
                <article
                  key={review.reviewId}
                  className="grid gap-4 px-5 py-4 transition hover:bg-white/[0.03] lg:grid-cols-[1.1fr_180px_160px_220px] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-bold text-[#FFD166]">
                        {review.movieTitle || review.movieId}
                      </span>
                      <span>•</span>
                      <span>{review.customerName || review.customerProfileId}</span>
                      <span>•</span>
                      <span>{formatReviewDate(review.createdAt)}</span>
                    </div>
                    <p className="line-clamp-3 text-sm leading-6 text-slate-100">
                      {review.comment?.trim() || 'Khong co noi dung binh luan.'}
                    </p>
                    {review.rejectedReason ? (
                      <p className="mt-2 flex items-center gap-2 text-xs font-bold text-amber-200">
                        <FaExclamationTriangle />
                        {review.rejectedReason}
                      </p>
                    ) : null}
                  </div>

                  <RatingStars rating={review.rating} />
                  <StatusBadge status={review.status} />

                  <div className="flex justify-start gap-2 lg:justify-end">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleModeration(review.reviewId, 'approve')}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-xs font-black uppercase text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FaCheck />
                      {currentAction === 'approve' ? 'Dang duyet' : 'Duyet'}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleModeration(review.reviewId, 'reject')}
                      className="inline-flex items-center gap-2 rounded-md bg-rose-500 px-4 py-2 text-xs font-black uppercase text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FaTimes />
                      {currentAction === 'reject' ? 'Dang tu choi' : 'Tu choi'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
