import { checkAllPermissions, requestPermission } from "@/src/services/permissions/permissionChecker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

export default function PermissionScreen() {
  const router = useRouter();
  const [perm, setPerm] = useState(null);

  const load = async () => {
    const result = await checkAllPermissions();
    setPerm(result);

    if (result.allGranted) {
      router.replace("/");
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!perm) return <Text>권한 상태 확인 중...</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>앱 사용을 위해 필요한 권한이 있습니다</Text>

      <PermissionItem
        title="위치 권한"
        granted={perm.location === "GRANTED"}
        onPress={() => requestPermission("location").then(load)}
      />

      <PermissionItem
        title="다른 앱 위에 표시"
        granted={perm.overlay === "GRANTED"}
        onPress={() => {
          requestPermission("overlay");
          // 설정으로 이동하는 권한이라 1~2초 후 자동 재체크
          setTimeout(load, 2000);
        }}
      />

      <PermissionItem
        title="사용량 접근 권한"
        granted={perm.usageStats === "GRANTED"}
        onPress={() => {
          requestPermission("usageStats");
          setTimeout(load, 2000);
        }}
      />
    </View>
  );
}

function PermissionItem({ title, granted, onPress }) {
  return (
    <View style={styles.item}>
      <Text style={[styles.label, granted && styles.granted]}>{title}</Text>
      <Button title={granted ? "✅ 완료" : "허용하기"} disabled={granted} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
  },
  item: {
    gap: 10,
  },
  label: {
    fontSize: 16,
  },
  granted: {
    color: "green",
  },
});
