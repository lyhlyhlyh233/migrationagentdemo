import { ServiceError } from "../errors";
export type Fetcher = typeof fetch;
export function createHttpClient(baseUrl: string, fetcher: Fetcher = fetch) {
  return async function request<T>(
    path: string,
    init: RequestInit = {},
    decode: (value: unknown) => T,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetcher(
        `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`,
        { credentials: "same-origin", ...init },
      );
    } catch {
      throw new ServiceError(
        init.signal?.aborted ? "ABORTED" : "NETWORK",
        init.signal?.aborted ? "操作已取消" : "网络连接失败，请重试",
      );
    }
    if (!response.ok)
      throw new ServiceError(
        "HTTP",
        `请求失败（${response.status}）`,
        response.status,
      );
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ServiceError(
        init.signal?.aborted ? "ABORTED" : "HTTP",
        init.signal?.aborted ? "操作已取消" : "接口返回内容格式不正确",
      );
    }
    return decode(body);
  };
}
