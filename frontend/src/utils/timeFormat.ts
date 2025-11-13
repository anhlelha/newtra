/**
 * Format date/time to GMT+7 (Vietnam timezone)
 */

const GMT7_OFFSET = 7 * 60; // 7 hours in minutes

/**
 * Convert UTC date to GMT+7
 */
export function toGMT7(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return new Date(utc + (GMT7_OFFSET * 60000));
}

/**
 * Format date to GMT+7 date only (YYYY-MM-DD)
 */
export function formatDateGMT7(date: Date | string): string {
  const d = toGMT7(date);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD format
}

/**
 * Format date to GMT+7 time only (HH:MM:SS)
 */
export function formatTimeGMT7(date: Date | string): string {
  const d = toGMT7(date);
  return d.toLocaleTimeString('en-GB'); // HH:MM:SS format
}

/**
 * Format date to full GMT+7 datetime (YYYY-MM-DD HH:MM:SS)
 */
export function formatDateTimeGMT7(date: Date | string): string {
  const d = toGMT7(date);
  return `${formatDateGMT7(d)} ${formatTimeGMT7(d)}`;
}

/**
 * Format date to GMT+7 with short format (DD/MM/YYYY HH:MM)
 */
export function formatShortDateTimeGMT7(date: Date | string): string {
  const d = toGMT7(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Format relative time with GMT+7 awareness
 */
export function formatRelativeTimeGMT7(date: Date | string): string {
  const d = toGMT7(date);
  const now = toGMT7(new Date());
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatShortDateTimeGMT7(d);
}
