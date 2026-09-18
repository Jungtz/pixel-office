/**
 * 前端台股代號偵測（與後端 skills/stock/index.ts 的 detectStockId 同規則）：
 * 4 碼數字可帶 1 碼英文尾綴，排除 1900–2100（年份誤判）。
 */
export function detectStockId(text: string): string | null {
  if (!text) return null;
  const matches = text.match(/\d{4}[A-Za-z]?/g) || [];
  for (const m of matches) {
    const num = parseInt(m.slice(0, 4), 10);
    if (num < 1000 || (num >= 1900 && num <= 2100)) continue;
    return m.toUpperCase();
  }
  return null;
}
