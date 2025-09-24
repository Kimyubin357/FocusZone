// src/services/group/getGroup.ts
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebaseConfig";

export type Group = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: any;
  memberCount: number;
};

export async function getGroup(groupId: string): Promise<Group> {
  const ref = doc(db, "groups", groupId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("해당 그룹이 존재하지 않습니다.");
  }
  return { id: snap.id, ...(snap.data() as Omit<Group, "id">) };
}
