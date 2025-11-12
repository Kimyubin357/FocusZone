import { checkAllPermissions, requestPermission } from "@/src/services/permissions/permissionChecker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// ✅ Ionicons import 추가
import { Ionicons } from "@expo/vector-icons";

// ✅ 앱 테마 색상 정의
const THEME_COLOR = "#0D4093";

export default function PermissionScreen() {
  const router = useRouter();
  const [perm, setPerm] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await checkAllPermissions();
      setPerm(result);

      if (result.allGranted) {
        router.replace("/");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!perm) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME_COLOR} />
        <Text style={styles.loadingText}>권한 상태 확인 중...</Text>
      </View>
    );
  }

  // ✅ [수정] Icon 이모지를 Ionicons 이름으로 변경
  const permissions = [
    {
      key: "location",
      icon: "location-outline",
      title: "위치 권한",
      description: "집중 장소를 자동으로 감지합니다",
      granted: perm.location === "GRANTED",
    },
    {
      key: "notification",
      icon: "notifications-outline",
      title: "알림 권한",
      description: "집중 모드 상태를 알려드립니다",
      granted: perm.notification === "GRANTED",
    },
    {
      key: "overlay",
      icon: "lock-closed-outline",
      title: "다른 앱 위에 표시",
      description: "집중 시간에 앱을 차단합니다",
      granted: perm.overlay === "GRANTED",
    },
    {
      key: "usageStats",
      icon: "stats-chart-outline",
      title: "사용량 접근 권한",
      description: "현재 사용 중인 앱을 확인합니다",
      granted: perm.usageStats === "GRANTED",
    },
  ];

  const grantedCount = permissions.filter((p) => p.granted).length;
  const progress = (grantedCount / permissions.length) * 100;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        {/* ✅ [수정] 이모지를 Ionicons로 변경 및 스타일 적용 */}
        <Ionicons
          name="shield-checkmark-outline"
          size={56}
          color={THEME_COLOR}
          style={styles.headerIcon}
        />
        <Text style={styles.title}>Focus Zone 시작하기</Text>
        <Text style={styles.subtitle}>
          원활한 사용을 위해{"\n"}아래 권한을 허용해주세요
        </Text>
      </View>

      {/* 진행률 바 */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          {/* ✅ [수정] progressFill 스타일의 backgroundColor를 THEME_COLOR로 변경 */}
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {grantedCount} / {permissions.length} 완료
        </Text>
      </View>

      {/* 권한 목록 */}
      <View style={styles.permissionList}>
        {permissions.map((permission) => (
          <PermissionCard
            key={permission.key}
            icon={permission.icon}
            title={permission.title}
            description={permission.description}
            granted={permission.granted}
            onPress={async () => {
              if (permission.granted) return;

              if (permission.key === "overlay" || permission.key === "usageStats") {
                requestPermission(permission.key);
                setTimeout(load, 2000);
              } else {
                await requestPermission(permission.key);
                await load();
              }
            }}
            loading={loading}
          />
        ))}
      </View>

      {/* 하단 안내 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 모든 권한은 앱의 핵심 기능을 위해 필요합니다
        </Text>
      </View>
    </ScrollView>
  );
}

function PermissionCard({ icon, title, description, granted, onPress, loading }) {
  return (
    <TouchableOpacity
      style={[styles.card, granted && styles.cardGranted]}
      onPress={onPress}
      disabled={granted || loading}
      activeOpacity={0.7}
    >
      <View style={styles.cardLeft}>
        <View
          style={[styles.iconContainer, granted && styles.iconContainerGranted]}
        >
          {/* ✅ [수정] Text 이모지를 Ionicons 컴포넌트로 변경 */}
          <Ionicons
            name={icon}
            size={24}
            color={granted ? THEME_COLOR : "#6B7280"}
          />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, granted && styles.cardTitleGranted]}>
            {title}
          </Text>
          <Text style={styles.cardDescription}>{description}</Text>
        </View>
      </View>

      <View style={styles.cardRight}>
        {granted ? (
          <View style={styles.badge}>
            {/* ✅ [수정] Text "✓"를 Ionicons로 변경 */}
            <Ionicons name="checkmark-outline" size={18} color="white" />
          </View>
        ) : (
          <View style={styles.arrowButton}>
            {/* ✅ [수정] Text "→"를 Ionicons로 변경 */}
            <Ionicons name="arrow-forward-outline" size={18} color="white" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  contentContainer: {
    padding: 24,
    paddingTop: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },

  // 헤더
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  // ✅ [추가] 헤더 아이콘 스타일
  headerIcon: {
    marginBottom: 16,
  },
  // ✅ [삭제] emoji 스타일 제거
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
  },

  // 진행률
  progressContainer: {
    marginBottom: 32,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: THEME_COLOR, // ✅ [수정] 테마 색상으로 변경
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    fontWeight: "600",
  },

  // 권한 카드
  permissionList: {
    gap: 12,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardGranted: {
    backgroundColor: "#E9EFFF", // ✅ [수정] 테마에 맞는 연한 파란색
    borderColor: THEME_COLOR, // ✅ [수정] 테마 색상 테두리
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  iconContainerGranted: {
    backgroundColor: "#D6DFFF", // ✅ [수정] 테마에 맞는 아이콘 배경
  },
  // ✅ [삭제] icon 스타일 제거
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  cardTitleGranted: {
    color: THEME_COLOR, // ✅ [수정] 테마 색상
  },
  cardDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  cardRight: {
    marginLeft: 12,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#10B981", // ✅ [유지] 초록색 (허용됨)
    justifyContent: "center",
    alignItems: "center",
  },
  // ✅ [삭제] badgeText 스타일 제거
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME_COLOR, // ✅ [수정] 테마 색상
    justifyContent: "center",
    alignItems: "center",
  },
  // ✅ [삭제] arrowText 스타일 제거

  // 하단
  footer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: "#E9EFFF", // ✅ [수정] 테마에 맞는 연한 파란색
    borderRadius: 12,
  },
  footerText: {
    fontSize: 14,
    color: THEME_COLOR, // ✅ [수정] 테마 색상
    textAlign: "center",
    lineHeight: 20,
  },
});