package com.focuszone.lock

import android.content.pm.PackageManager
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.util.Base64
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream
import android.provider.Settings
import android.text.TextUtils
import android.content.Intent
import com.focuszone.lock.AppLockService

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

    /*RN → Kotlin : 차단할 앱 목록 설정 */
    @ReactMethod
    fun setBlockedApps(apps: ReadableArray, promise: Promise) {
        try {
            val appList = mutableListOf<String>()
            for (i in 0 until apps.size()) {
                apps.getString(i)?.let { appList.add(it) }
            }
            
            // 빈 배열도 허용 (차단 해제 목적)
            BlockedAppsHolder.blockedApps = appList
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_BLOCKED_APPS_ERROR", "Failed to set blocked apps: ${e.message}", e)
        }
    }

    /*RN → Kotlin : 현재 차단 앱 목록 가져오기 */
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

    /* 설치된 앱 전체 목록 반환 */
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val appInfos = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            val resultArray = Arguments.createArray()

            for (appInfo in appInfos) {
        
                if ((appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 ||
                    (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
                ) continue

              
                val launchIntent = pm.getLaunchIntentForPackage(appInfo.packageName)
                if (launchIntent == null) continue

               
                val appMap = Arguments.createMap()
                appMap.putString("packageName", appInfo.packageName)
                appMap.putString("appName", pm.getApplicationLabel(appInfo).toString())

                // 아이콘을 Base64로 변환하여 추가
                try {
                    val icon = pm.getApplicationIcon(appInfo.packageName)
                    val iconBase64 = drawableToBase64(icon)
                    appMap.putString("icon", iconBase64)
                } catch (e: Exception) {
                    appMap.putString("icon", "") // 아이콘 로드 실패 시 빈 문자열
                }

            
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

    //접근성 설정 화면 열기
    @ReactMethod
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        
        reactApplicationContext.getCurrentActivity()?.startActivity(intent)
    }

    // 2. ✅ [수정] 접근성 권한 상태 확인 함수
    @ReactMethod
    fun isAccessibilityServiceEnabled(promise: Promise) {
        try {
            var accessibilityEnabled = 0
            
            // ⭐️⭐️⭐️ 이 부분이 수정되었습니다 ⭐️⭐️⭐️
            val serviceName = reactApplicationContext.packageName + "/" + AppLockService::class.java.canonicalName
            // ⭐️⭐️⭐️ 
            
            try {
                accessibilityEnabled = Settings.Secure.getInt(
                    reactApplicationContext.contentResolver,
                    Settings.Secure.ACCESSIBILITY_ENABLED
                )
            } catch (e: Settings.SettingNotFoundException) {
                promise.resolve(false)
                return
            }

            if (accessibilityEnabled == 1) {
                val settingValue = Settings.Secure.getString(
                    reactApplicationContext.contentResolver,
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
                )
                if (settingValue != null) {
                    val mStringColonSplitter = TextUtils.SimpleStringSplitter(':')
                    mStringColonSplitter.setString(settingValue)
                    while (mStringColonSplitter.hasNext()) {
                        val accessibilityService = mStringColonSplitter.next()
                        if (accessibilityService.equals(serviceName, ignoreCase = true)) {
                            promise.resolve(true) // 우리 서비스(AppLockService)가 활성화됨
                            return
                        }
                    }
                }
            }
            
            promise.resolve(false) // 서비스가 활성화되지 않음
        } catch (e: Exception) {
            promise.reject("ACCESSIBILITY_CHECK_ERROR", "Failed to check accessibility service: ${e.message}", e)
        }
    }

    // Drawable을 Base64로 변환
    private fun drawableToBase64(drawable: Drawable): String {
        val bitmap = drawableToBitmap(drawable)
        val outputStream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
        val byteArray = outputStream.toByteArray()
        return Base64.encodeToString(byteArray, Base64.NO_WRAP)
    }

    // Drawable을 Bitmap으로 변환
    private fun drawableToBitmap(drawable: Drawable): Bitmap {
        if (drawable is BitmapDrawable) {
            return drawable.bitmap
        }

        val bitmap = Bitmap.createBitmap(
            drawable.intrinsicWidth,
            drawable.intrinsicHeight,
            Bitmap.Config.ARGB_8888
        )
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, canvas.width, canvas.height)
        drawable.draw(canvas)
        return bitmap
    }
}