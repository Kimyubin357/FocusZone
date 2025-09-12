// src/lib/api.ts
// Lightweight fetch 래퍼: 토큰 자동첨부, 타임아웃, 에러 표준화

import AsyncStorage from "@react-native-async-storage/async-storage"; // 기기에 토큰 저장/읽기 위해 AsyncStorage 사용

const AUTH_TOKEN_KEY = "auth:token"; // 토큰을 저장할 키 이름
let BASE_URL = "https://api.your-backend.com"; // 기본 API 서버 주소(프로젝트에 맞게 변경)
const DEFAULT_TIMEOUT_MS = 15000; // 기본 요청 타임아웃(ms)

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; // 허용 HTTP 메서드 타입

export class ApiError extends Error {
  // API 에러 래퍼(상태코드/코드/세부정보 포함)
  status: number; // HTTP 상태 코드(200, 401, 500 등)
  code?: string; // 서버가 내려주는 에러 코드(선택)
  details?: unknown; // 추가 디테일(선택)
  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown
  ) {
    super(message); // 기본 Error에 메시지 전달
    this.name = "ApiError"; // 에러 이름 지정
    this.status = status; // 상태 코드 저장
    this.code = code; // 에러 코드 저장
    this.details = details; // 디테일 저장
  }
}

export function configureApi(opts: { baseURL?: string }) {
  // 런타임에 BASE_URL 바꾸고 싶을 때 사용
  if (opts.baseURL) BASE_URL = opts.baseURL; // baseURL 옵션이 있으면 교체
}

export async function setAuthToken(token: string) {
  // 로그인 후 토큰 저장
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}
export async function clearAuthToken() {
  // 로그아웃 시 토큰 제거
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}
export async function getAuthToken() {
  // 현재 저장된 토큰 읽기
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

type RequestOptions = {
  // request 유틸 함수의 옵션 타입
  method?: HttpMethod; // HTTP 메서드
  body?: unknown; // 요청 바디(객체 또는 FormData)
  headers?: Record<string, string>; // 추가 헤더
  auth?: boolean; // Authorization 헤더 자동 첨부 여부(기본 true)
  timeoutMs?: number; // 요청 타임아웃(기본 DEFAULT_TIMEOUT_MS)
  baseURLOverride?: string; // 특정 요청만 다른 베이스 URL 사용
};

export async function request<T = unknown>( // 제네릭 T: 응답 data 타입
  path: string, // "/groups" 같은 경로 또는 절대 URL
  {
    method = "GET", // 기본 메서드 GET
    body,
    headers = {},
    auth = true, // 기본적으로 Authorization 첨부
    timeoutMs = DEFAULT_TIMEOUT_MS,
    baseURLOverride,
  }: RequestOptions = {}
): Promise<{ data: T; status: number; headers: Headers }> {
  const controller = new AbortController(); // 타임아웃/취소 제어용 컨트롤러
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs); // 타임아웃 도달 시 요청 중단

  const finalHeaders: Record<string, string> = {
    Accept: "application/json", // 기본적으로 JSON 응답 기대
    ...headers, // 사용자 지정 헤더 병합
  };

  // 자동 JSON 직렬화
  let fetchBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    // body가 있으면
    if (!(body instanceof FormData)) {
      // FormData가 아니면
      finalHeaders["Content-Type"] =
        finalHeaders["Content-Type"] ?? "application/json"; // Content-Type 기본 설정
      fetchBody = JSON.stringify(body); // 객체를 JSON 문자열로 직렬화
    } else {
      // FormData일 때는 Content-Type 자동 설정 금지(브라우저가 경계(boundary) 붙임)
      fetchBody = body as unknown as BodyInit; // FormData 그대로 사용
    }
  }

  // 토큰 자동 첨부
  if (auth) {
    // auth 플래그가 true면
    const token = await getAuthToken(); // 저장된 토큰 읽기
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`; // Authorization 헤더 추가
  }

  const base = baseURLOverride ?? BASE_URL; // 요청별 baseURL 오버라이드가 있으면 우선
  const url = path.startsWith("http") ? path : `${base}${path}`; // 절대URL이면 그대로, 상대면 base + path

  try {
    const res = await fetch(url, {
      // fetch 호출
      method,
      headers: finalHeaders,
      body: fetchBody,
      signal: controller.signal, // AbortController 연결(타임아웃/취소)
    });

    clearTimeout(timeoutId); // 성공/실패와 무관하게 타이머 정리

    // No Content
    if (res.status === 204) {
      // 바디 없는 성공 응답 처리
      return {
        data: undefined as unknown as T,
        status: res.status,
        headers: res.headers,
      };
    }

    // JSON/텍스트 응답 처리
    const ct = res.headers.get("content-type") || ""; // 응답 Content-Type 확인
    const isJson = ct.includes("application/json"); // JSON 여부 판정
    const payload = isJson
      ? await res.json().catch(() => ({})) // JSON 파싱(실패하면 빈 객체)
      : await res.text(); // 텍스트로 수신

    if (!res.ok) {
      // 상태코드 200~299가 아닌 경우
      // 백엔드가 {error:{code,message,details}} 형태를 준다면 그대로 반영
      if (isJson && (payload as any)?.error) {
        // 표준 에러 형태면
        const err = (payload as any).error;
        throw new ApiError(
          err.message ?? "Request failed",
          res.status,
          err.code,
          err.details
        );
      }
      throw new ApiError(
        typeof payload === "string" ? payload : "Request failed",
        res.status
      ); // 그 외 일반 에러
    }

    return { data: payload as T, status: res.status, headers: res.headers }; // 성공 시 data/상태/헤더 반환
  } catch (err: any) {
    clearTimeout(timeoutId); // 에러 시에도 타이머 정리
    if (err?.name === "AbortError") {
      // Abort(타임아웃 포함)면
      throw new ApiError("Request timeout", 408, "TIMEOUT");
    }
    if (err instanceof ApiError) throw err; // 이미 ApiError면 그대로 던짐
    throw new ApiError(err?.message ?? "Network error", 0, "NETWORK_ERROR"); // 기타 네트워크 에러
  }
}

// 편의 메서드(HTTP 메서드별 래퍼)
export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "GET" }), // GET 호출 단축
  post: <T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, "method">
  ) => request<T>(path, { ...opts, method: "POST", body }), // POST 호출 단축
  put: <T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, "method">
  ) => request<T>(path, { ...opts, method: "PUT", body }), // PUT 호출 단축
  patch: <T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, "method">
  ) => request<T>(path, { ...opts, method: "PATCH", body }), // PATCH 호출 단축
  delete: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "DELETE" }), // DELETE 호출 단축
};

// 사용 예시:
// await setAuthToken(loginResult.token);                   // 로그인 후 토큰 저장
// const { data } = await api.get<Group[]>("/groups");      // 그룹 목록 GET
