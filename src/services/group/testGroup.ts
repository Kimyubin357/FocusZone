import { createGroup } from "../../services/group/createGroup";
import { getGroup } from "../../services/group/getGroup";

export async function testGroup() {
  try {
    // 1. 그룹 생성
    const groupId = await createGroup("테스트 그룹");
    console.log("✅ 그룹 생성됨:", groupId);

    // 2. 그룹 조회
    const group = await getGroup(groupId);
    console.log("📌 그룹 데이터:", group);
  } catch (err: any) {
    console.error("⚠️ 오류 발생:", err.message);
  }
}
