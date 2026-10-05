/**
 * API 基址：Vite `base` 即為 BASE_PATH（`/` 或 `/pixel/`）。
 * 生產反代子路徑下，`/api/*` 會打到網域根而 404，
 * 故所有前端 fetch 統一經此 helper 加上 base 前綴。
 * 開發時 BASE_URL 為 `/`，行為與原本寫死 `/api/*` 一致。
 */
export function apiPath(p: string): string {
  const base: string = import.meta.env.BASE_URL || '/';
  const normBase = base === '/' ? '' : base.replace(/\/+$/, '');
  const suffix = p.startsWith('/') ? p : `/${p}`;
  return `${normBase}${suffix}`;
}
