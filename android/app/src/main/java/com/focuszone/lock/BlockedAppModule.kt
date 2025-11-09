package com.focuszone.lock

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Base64
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream

class BlockedAppsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "BlockedApps"

    companion object {
        var blockedAppsSet: Set<String> = emptySet()
        private const val DEFAULT_CATEGORY = "Other"
    }

    // ✅ 알림 권한 체크
    @ReactMethod
    fun checkNotificationPermission(promise: Promise) {
        try {
            val enabled = NotificationManagerCompat.from(reactApplicationContext).areNotificationsEnabled()
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.reject("CHECK_NOTIFICATION_ERROR", e)
        }
    }

    // ✅ 알림 권한 요청
    @ReactMethod
    fun requestNotificationPermission() {
        val activity = currentActivity ?: return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                1001
            )
        }
    }

    // ✅ 사용량 접근 권한 체크
    @ReactMethod
    fun checkUsageStatsPermission(promise: Promise) {
        val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            reactApplicationContext.packageName
        )
        promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    }

    // ✅ 사용량 접근 권한 요청
    @ReactMethod
    fun requestUsageStatsPermission() {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        reactApplicationContext.startActivity(intent)
    }

    // ✅ Overlay 권한 체크
    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
    }

    // ✅ Overlay 권한 요청
    @ReactMethod
    fun requestOverlayPermission() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${reactApplicationContext.packageName}")
        )
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        reactApplicationContext.startActivity(intent)
    }

    // ✅ 앱 차단 리스트 설정
    @ReactMethod
    fun setBlockedApps(apps: ReadableArray, promise: Promise) {
        try {
            val appSet = mutableSetOf<String>()
            for (i in 0 until apps.size()) {
                apps.getString(i)?.let { appSet.add(it) }
            }

            blockedAppsSet = appSet
            Log.d("BlockedAppModule", "Blocked apps updated: $blockedAppsSet")

            if (blockedAppsSet.isNotEmpty()) {
                startAppLockService()
            } else {
                stopAppLockService()
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_BLOCKED_APPS_ERROR", e)
        }
    }

    @ReactMethod
    fun getBlockedApps(promise: Promise) {
        val array = Arguments.createArray()
        blockedAppsSet.forEach { array.pushString(it) }
        promise.resolve(array)
    }

    // ✅ 설치된 앱 목록
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

                try {
                    val icon = pm.getApplicationIcon(appInfo.packageName)
                    val iconBase64 = drawableToBase64(icon)
                    appMap.putString("icon", iconBase64)
                } catch (_: Exception) {
                    appMap.putString("icon", "")
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
            promise.reject("GET_INSTALLED_APPS_ERROR", e)
        }
    }

    // ✅ Foreground service 시작
    @ReactMethod
    fun startAppLockService() {
        val intent = Intent(reactApplicationContext, AppLockService::class.java)
        ContextCompat.startForegroundService(reactApplicationContext, intent)
    }

    @ReactMethod
    fun stopAppLockService() {
        val intent = Intent(reactApplicationContext, AppLockService::class.java)
        reactApplicationContext.stopService(intent)
    }

    private fun drawableToBase64(drawable: Drawable): String {
        val bitmap = drawableToBitmap(drawable)
        val outputStream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
        return Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
    }

    private fun drawableToBitmap(drawable: Drawable): Bitmap {
        if (drawable is BitmapDrawable) return drawable.bitmap

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
