import { checkAllPermissions, requestPermission } from "@/src/services/permissions/permissionChecker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>권한 상태 확인 중...</Text>
      </View>
    );
  }

  const permissions = [
    {
      key: "location",
      icon: "📍",
      title: "위치 권한",
      description: "집중 장소를 자동으로 감지합니다",
      granted: perm.location === "GRANTED",
    },
    {
      key: "notification",
      icon: "🔔",
      title: "알림 권한",
      description: "집중 모드 상태를 알려드립니다",
      granted: perm.notification === "GRANTED",
    },
    {
      key: "overlay",
      icon: "🔒",
      title: "다른 앱 위에 표시",
      description: "집중 시간에 앱을 차단합니다",
      granted: perm.overlay === "GRANTED",
    },
    {
      key: "usageStats",
      icon: "📊",
      title: "사용량 접근 권한",
      description: "현재 사용 중인 앱을 확인합니다",
      granted: perm.usageStats === "GRANTED",
    },
  ];

  const grantedCount = permissions.filter((p) => p.granted).length;
  const progress = (grantedCount / permissions.length) * 100;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.emoji}>🎯</Text>
        <Text style={styles.title}>Focus Zone 시작하기</Text>
        <Text style={styles.subtitle}>
          원활한 사용을 위해{"\n"}아래 권한을 허용해주세요
        </Text>
      </View>

      {/* 진행률 바 */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
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
        <View style={[styles.iconContainer, granted && styles.iconContainerGranted]}>
          <Text style={styles.icon}>{icon}</Text>
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
            <Text style={styles.badgeText}>✓</Text>
          </View>
        ) : (
          <View style={styles.arrowButton}>
            <Text style={styles.arrowText}>→</Text>
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
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
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
    backgroundColor: "#4A90E2",
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
    backgroundColor: "#F0F9FF",
    borderColor: "#BAE6FD",
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
    backgroundColor: "#DBEAFE",
  },
  icon: {
    fontSize: 24,
  },
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
    color: "#1E40AF",
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
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4A90E2",
    justifyContent: "center",
    alignItems: "center",
  },
  arrowText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },

  // 하단
  footer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
  },
  footerText: {
    fontSize: 14,
    color: "#92400E",
    textAlign: "center",
    lineHeight: 20,
  },
});