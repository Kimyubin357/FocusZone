// src/types/domain.ts
// 앱 전역에서 공통으로 쓰는 타입 및 권한(역할) 정의

export type UUID = string; // 식별자 타입(문자열 UUID 가정)

/** 멤버 역할 (권한 레벨) */
export type MembershipRole = "OWNER" | "ADMIN" | "MEMBER"; // 그룹 내 역할 종류

export const RoleWeight = {
  // 역할 비교용 가중치(권한 크기 판단)
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
} as const;

export interface User {
  // 사용자 기본 정보
  id: UUID;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: string; // ISO
}

export interface Group {
  // 그룹 기본 정보
  id: UUID;
  name: string;
  ownerId: UUID;
  createdAt: string; // ISO
}

export interface GroupMember {
  // 그룹 멤버십(사용자+역할)
  id: UUID;
  groupId: UUID;
  userId: UUID;
  role: MembershipRole;
  joinedAt: string; // ISO
  user?: User; // API가 유저 프로필을 포함해서 줄 수도 있음(옵션)
}

/** 초대 상태 */
export type InviteStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"; // 초대장의 상태

export interface Invite {
  // 초대장 정보
  id: UUID;
  groupId: UUID;
  inviterId: UUID;
  code: string; // 가입 코드(링크/문자)
  expiresAt: string; // ISO                                 // 만료 시각
  status: InviteStatus; // 현재 상태
}

/** 집중장소 차단 모드
 * BLOCK: 목록의 앱을 '차단'
 * ALLOW: 목록의 앱만 '허용'(나머지 차단)
 */
export type ZoneMode = "BLOCK" | "ALLOW"; // 정책 모드 정의

export interface LatLng {
  // 좌표 타입
  lat: number;
  lng: number;
}

export interface FocusZone {
  // 집중장소(지오펜스) 엔티티
  id: UUID;
  groupId: UUID;
  name: string;
  center: LatLng; // 중심 좌표
  radiusM: number; // 반경(미터)
  mode: ZoneMode; // BLOCK/ALLOW
  apps: string[]; // 패키지명 목록 (e.g., "com.facebook.katana")
  active?: boolean; // 비활성화 가능(관리자가 끌 수 있음)
  createdAt: string; // ISO
  updatedAt?: string; // ISO(옵션)
}

/** 온라인 상태 표시 */
export type PresenceStatus = "ONLINE" | "OFFLINE"; // 멤버 온라인 여부

export interface Presence {
  // 프레즌스(하트비트 기반)
  groupId: UUID;
  userId: UUID;
  lastSeenAt: string; // ISO                              // 마지막 접속 시각
  status: PresenceStatus;
  deviceId?: string; // 기기 식별자(옵션)
}

/** 감사 로그 (선택) */
export interface AuditLog {
  // 주요 액션 이력 저장용
  id: UUID;
  groupId: UUID;
  actorId: UUID; // 수행자
  action: string; // e.g., "INVITE_CREATED", "ZONE_UPDATED"
  meta?: Record<string, unknown>; // 부가 데이터
  createdAt: string; // ISO
}

/** API 응답 표준(권장) */
export interface ApiSuccess<T> {
  // 성공 응답 형태
  ok: true;
  data: T;
}
export interface ApiFail {
  // 실패 응답 형태
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
export type ApiResult<T> = ApiSuccess<T> | ApiFail; // 성공/실패 유니온 타입

/* ----------------------------
   권한 헬퍼 (간단 ACL)
   - UI에서 버튼 노출/비활성 조건에 사용
----------------------------- */
export const ACL = {
  // 권한 판단 유틸(프런트 가드)
  canInvite(role: MembershipRole) {
    // 초대 가능? (OWNER/ADMIN만)
    return role === "OWNER" || role === "ADMIN";
  },
  canManageMembers(
    currentUserRole: MembershipRole,
    targetUserRole: MembershipRole
  ) {
    // OWNER는 모두 관리 가능 (단, 자기 자신 OWNER 보호는 별도 정책 권장)
    if (currentUserRole === "OWNER") return true;
    // ADMIN은 MEMBER만 관리 가능(= ADMIN/OWNER는 불가)
    if (currentUserRole === "ADMIN")
      return RoleWeight[targetUserRole] < RoleWeight.ADMIN;
    return false; // MEMBER는 관리 권한 없음
  },
  canEditZone(role: MembershipRole) {
    // 집중장소 수정 가능? (OWNER/ADMIN)
    return role === "OWNER" || role === "ADMIN";
  },
  canDeleteGroup(role: MembershipRole) {
    // 그룹 삭제 가능? (OWNER만)
    return role === "OWNER";
  },
};
