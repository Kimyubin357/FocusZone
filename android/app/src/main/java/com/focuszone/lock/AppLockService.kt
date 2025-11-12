// AppLockService.kt
package com.focuszone.lock

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.app.usage.UsageStatsManager
import android.content.Context
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.focuszone.R // R을 import 해야 합니다 (e.g., R.mipmap.ic_launcher)

class AppLockService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var isRunning = false
    private lateinit var usageStatsManager: UsageStatsManager

    // 0.5초마다 전경 앱 확인
    private val POLLING_INTERVAL: Long = 500
    private val NOTIFICATION_CHANNEL_ID = "AppLockChannel"
    private val NOTIFICATION_ID = 1

    private val pollingRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return

            val foregroundApp = getForegroundApp()
            
            // BlockedAppModule의 static 변수에서 차단 목록을 읽어옴
            if (foregroundApp != null && BlockedAppsModule.blockedAppsSet.contains(foregroundApp)) {
                // 차단 로직 실행 (LockActivity 띄우기)
                showLockScreen(foregroundApp)
            }
            
            // 다음 폴링 예약
            handler.postDelayed(this, POLLING_INTERVAL)
        }
    }

    override fun onCreate() {
        super.onCreate()
        usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (isRunning) return START_STICKY

        isRunning = true
        Log.d("AppLockService", "Starting Foreground Service...")
        startForeground(NOTIFICATION_ID, createNotification()) // Foreground Service 시작
        handler.post(pollingRunnable) // 폴링 루프 시작

        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        handler.removeCallbacks(pollingRunnable) // 폴링 루프 중지
        Log.d("AppLockService", "Stopping Foreground Service.")
        super.onDestroy()
    }

    // 현재 전경 앱 패키지 가져오기
    private fun getForegroundApp(): String? {
        val time = System.currentTimeMillis()
        // 최근 10초간 사용 내역 조회
        val usageStatsList = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY, time - 1000 * 10, time
        )
        
        if (usageStatsList != null && usageStatsList.isNotEmpty()) {
            // 가장 최근에 사용된(lastTimeUsed) 앱을 찾음
            return usageStatsList.sortedBy { it.lastTimeUsed }.lastOrNull()?.packageName
        }
        return null
    }

    // 잠금 화면 띄우기
    private fun showLockScreen(packageName: String?) {
        val intent = Intent(this, LockActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        // (선택) 어떤 앱이 차단되었는지 LockActivity로 전달
        intent.putExtra("BLOCKED_APP_NAME", packageName) 
        intent.putExtra("BLOCKED_APP_PACKAGE", packageName)
        startActivity(intent)
    }

    // 포그라운드 서비스 알림 생성
    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("Focus Zone")
            .setContentText("앱 차단 기능이 실행 중입니다.")
            .setSmallIcon(R.mipmap.ic_launcher) // ❗️ app/src/main/res/mipmap... 에 아이콘이 있는지 확인
            .setPriority(NotificationCompat.PRIORITY_MIN) // 알림 중요도 낮춤
            .build()
    }

    // 알림 채널 생성 (Android 8.0 이상)
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "App Lock Service Channel",
                NotificationManager.IMPORTANCE_MIN // 최소 중요도로 설정
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
}