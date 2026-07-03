/**
 * Chuyển đổi URL media (poster, ảnh, v.v.) từ backend sang URL có thể dùng trực tiếp trong <img src>.
 *
 * - Nếu URL là absolute (http/https/blob/data) → giữ nguyên.
 * - Nếu URL là relative (bắt đầu bằng /) → prefix bằng API base URL của backend.
 * - Nếu rỗng → trả về chuỗi rỗng.
 */
const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7122';

export function getMediaUrl(url?: string | null): string {
  if (!url || !url.trim()) return '';

  const trimmed = url.trim();

  // Absolute URL (http/https/blob/data) → dùng nguyên
  if (/^(https?:|blob:|data:)/i.test(trimmed)) {
    return trimmed;
  }

  // Relative path bắt đầu bằng / → prefix API origin
  if (trimmed.startsWith('/')) {
    return `${API_ORIGIN}${trimmed}`;
  }

  // Trường hợp còn lại (e.g. "uploads/posters/...") → cũng prefix
  return `${API_ORIGIN}/${trimmed}`;
}
