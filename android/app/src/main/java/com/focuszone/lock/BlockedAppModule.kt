package com.focuszone.lock

import android.content.pm.PackageManager
import android.content.pm.ApplicationInfo
import com.facebook.react.bridge.*

object BlockedAppsHolder {
    var blockedApps: List<String> = emptyList() // 차단 앱 패키지명 저장 리스트
}

class BlockedAppsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "BlockedApps"

    companion object {
        private const val DEFAULT_CATEGORY = "Other"
        private const val ERROR_NO_APPS = "NO_APPS_PROVIDED"
    }

    /** ✅ RN → Kotlin : 차단할 앱 목록 설정 */
    @ReactMethod
    fun setBlockedApps(apps: ReadableArray, promise: Promise) {
        try {
            val appList = mutableListOf<String>()
            for (i in 0 until apps.size()) {
                apps.getString(i)?.let { appList.add(it) }
            }
            if (appList.isEmpty()) {
                promise.reject(ERROR_NO_APPS, "No apps provided")
                return
            }
            BlockedAppsHolder.blockedApps = appList
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_BLOCKED_APPS_ERROR", "Failed to set blocked apps: ${e.message}", e)
        }
    }

    /** ✅ RN → Kotlin : 현재 차단 앱 목록 가져오기 */
    @ReactMethod
    fun getBlockedApps(promise: Promise) {
        try {
            val resultArray = Arguments.createArray()
            BlockedAppsHolder.blockedApps.forEach { resultArray.pushString(it) }
            promise.resolve(resultArray)
        } catch (e: Exception) {
            promise.reject("GET_BLOCKED_APPS_ERROR", "Failed to get blocked apps: ${e.message}", e)
        }
    }

    /** ✅ 설치된 앱 전체 목록 반환 (시스템앱 제외 + 실행 가능한 앱만) */
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val appInfos = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            val resultArray = Arguments.createArray()

            for (appInfo in appInfos) {
                // 🚫 시스템 앱 제외
                if ((appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 ||
                    (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
                ) continue

                // 🚫 실행 불가능한 앱 제외
                val launchIntent = pm.getLaunchIntentForPackage(appInfo.packageName)
                if (launchIntent == null) continue

                // ✅ 앱 정보 구성
                val appMap = Arguments.createMap()
                appMap.putString("packageName", appInfo.packageName)
                appMap.putString("appName", pm.getApplicationLabel(appInfo).toString())

                // ✅ 카테고리 구분
                val category = when (appInfo.category) {
                    ApplicationInfo.CATEGORY_GAME -> "Game"
                    ApplicationInfo.CATEGORY_AUDIO -> "Audio"
                    ApplicationInfo.CATEGORY_VIDEO -> "Video"
                    ApplicationInfo.CATEGORY_IMAGE -> "Image"
                    ApplicationInfo.CATEGORY_SOCIAL -> "Social"
                    ApplicationInfo.CATEGORY_PRODUCTIVITY -> "Productivity"
                    else -> DEFAULT_CATEGORY
                }
                appMap.putString("category", category)

                resultArray.pushMap(appMap)
            }

            promise.resolve(resultArray)
        } catch (e: Exception) {
            promise.reject("GET_INSTALLED_APPS_ERROR", "Failed to get installed apps: ${e.message}", e)
        }
    }
}