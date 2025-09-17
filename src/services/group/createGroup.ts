// src/services/group/createGroup.ts
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../../../firebaseConfig";

export async function createGroup(name: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("로그인이 필요합니다.");

  const batch = writeBatch(db);

  // groups 문서
  const groupRef = doc(collection(db, "groups"));
  batch.set(groupRef, {
    name,
    ownerId: user.uid,
    createdAt: serverTimestamp(),
    memberCount: 1,
  });

  // 첫 멤버(소유자) 서브컬렉션
  const memberRef = doc(collection(groupRef, "members"), user.uid);
  batch.set(memberRef, {
    role: "owner",
    joinedAt: serverTimestamp(),
  });

  // users 캐시에 groupId 추가 (간단 버전)
  const userRef = doc(db, "users", user.uid);
  batch.set(
    userRef,
    { groups: [groupRef.id] }, // 추후 Functions로 배열 병합 처리 추천
    { merge: true }
  );

  await batch.commit();
  return groupRef.id;
}
