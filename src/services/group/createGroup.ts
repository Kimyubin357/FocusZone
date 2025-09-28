// src/services/group/createGroup.ts
// Firestore에 그룹 문서를 생성하는 서비스 함수

import type { DocumentReference, Firestore } from "firebase/firestore";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

// 프로젝트 루트에 firebaseConfig.js가 있을 때의 상대경로 (src/services/group → ../../../)
import { db as defaultDb } from "../../../firebaseConfig";

export type Visibility = "public" | "private";

export interface GroupInput {
  name: string;
  description?: string;
  visibility?: Visibility;
  memberIds?: string[];
}

export interface GroupDoc {
  name: string;
  description?: string;
  visibility: Visibility;
  ownerId: string;
  memberIds: string[];
  createdAt: ReturnType<typeof serverTimestamp>;
  updatedAt: ReturnType<typeof serverTimestamp>;
}

export interface CreateGroupParams {
  ownerId: string; // 그룹장(생성자) UID
  data: GroupInput; // 그룹 입력 값
  db?: Firestore; // (선택) 주입형 Firestore 인스턴스
}

export interface CreateGroupResult {
  id: string; // 생성된 문서 ID
  ref: DocumentReference; // 생성된 문서 레퍼런스
}

function assertValid(input: CreateGroupParams) {
  if (!input?.ownerId) throw new Error("ownerId(UID)가 필요합니다.");
  if (!input?.data?.name) throw new Error("그룹 이름(name)이 필요합니다.");
}

/**
 * 그룹 생성
 * - 컬렉션: "groups"
 * - ownerId를 memberIds에 자동 포함(중복 제거)
 * - createdAt/updatedAt = serverTimestamp()
 */
export async function createGroup(
  params: CreateGroupParams
): Promise<CreateGroupResult> {
  assertValid(params);

  const firestore = params.db ?? defaultDb;
  if (!firestore) {
    throw new Error(
      "Firestore 인스턴스를 찾을 수 없습니다. firebaseConfig 경로 또는 db 주입을 확인하세요."
    );
  }

  const groupsCol = collection(firestore, "groups");

  const uniqueMembers = Array.from(
    new Set([params.ownerId, ...(params.data.memberIds ?? [])])
  );

  const payload: GroupDoc = {
    name: params.data.name.trim(),
    description: params.data.description?.trim() || undefined,
    visibility: params.data.visibility ?? "private",
    ownerId: params.ownerId,
    memberIds: uniqueMembers,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(groupsCol, payload);
  return { id: ref.id, ref };
}

// 사용 예시:
// await createGroup({ ownerId: user.uid, data: { name: "우리팀", visibility: "private" } });
// 또는 db 주입:
// await createGroup({ ownerId: user.uid, data: { name: "우리팀" }, db });
