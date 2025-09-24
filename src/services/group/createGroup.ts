// src/services/group/createGroup.ts
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../../../firebaseConfig";

export async function createGroup(name: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("로그인이 필요합니다.");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("그룹 이름을 입력해 주세요.");

  // ✅ 같은 오너가 같은 이름의 그룹을 만들지 못하게 사전 검사
  const dupQ = query(
    collection(db, "groups"),
    where("ownerId", "==", user.uid),
    where("name", "==", trimmed)
  );
  const dupSnap = await getDocs(dupQ);
  if (!dupSnap.empty) {
    throw new Error("이미 같은 이름의 그룹이 있습니다.");
  }

  const batch = writeBatch(db);

  // groups 문서 생성
  const groupRef = doc(collection(db, "groups"));
  batch.set(groupRef, {
    name: trimmed,
    ownerId: user.uid,
    createdAt: serverTimestamp(),
    memberCount: 1,
  });

  // groups/{groupId}/members/{uid} (오너 등록)
  const memberRef = doc(collection(groupRef, "members"), user.uid);
  batch.set(memberRef, {
    role: "owner",
    joinedAt: serverTimestamp(),
  });

  // users/{uid}.groups 에 그룹ID 누적 (덮어쓰기 대신 arrayUnion)
  const userRef = doc(collection(db, "users"), user.uid);
  batch.set(userRef, { groups: arrayUnion(groupRef.id) }, { merge: true });

  await batch.commit();
  return groupRef.id;
}
