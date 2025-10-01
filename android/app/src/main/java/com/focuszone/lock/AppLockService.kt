package com.focuszone.lock

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.content.Intent
import android.util.Log

class AppLockService : AccessibilityService() { // androidManifest에서 먼저 등록 

    override fun onAccessibilityEvent(event: AccessibilityEvent?) { // 접근성 이벤트 등록 
        Log.d("AppLockService", "Accessibility event received: ${event?.eventType}")
        
        if (event?.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) { // 포그라운드 앱 감지
            val packageName = event.packageName?.toString() ?: return
            Log.d("AppLockService", "Foreground app: $packageName")
            Log.d("AppLockService", "Blocked apps list: ${BlockedAppsHolder.blockedApps}")

            // 지정된 앱만 차단
            if (BlockedAppsHolder.blockedApps.contains(packageName)) {
                Log.d("AppLockService", "BLOCKING APP: $packageName")
                try {
                    // 방법 1: 글로벌 액션으로 즉시 홈 이동
                    performGlobalAction(GLOBAL_ACTION_HOME)

                    // 방법 2(보조): 홈 인텐트 실행 (디바이스별 보완)
                    /*
                    val homeIntent = Intent(Intent.ACTION_MAIN).apply {
                        addCategory(Intent.CATEGORY_HOME)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(homeIntent)
                    */

                    Log.d("AppLockService", "Sent user to HOME to block app")
                } catch (e: Exception) {
                    Log.e("AppLockService", "Failed to go HOME", e)
                }
            } else {
                Log.d("AppLockService", "App $packageName is not in blocked list")
            }
        }
    }

    override fun onInterrupt() {
        // 서비스 중단 시 처리 로직 (필요 시 구현)
    }
}