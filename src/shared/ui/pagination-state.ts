export interface PageState {
  page: number;
  size: number;
}
export function pageWindow(total: number, state: PageState) {
  const pages = Math.max(1, Math.ceil(total / state.size));
  const page = Math.max(1, Math.min(state.page, pages));
  const start = (page - 1) * state.size;
  return { page, pages, start, end: Math.min(total, start + state.size) };
}
