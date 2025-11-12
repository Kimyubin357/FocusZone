// LockActivity.kt
package com.focuszone.lock

import android.content.Intent
import android.os.Bundle
import android.content.pm.PackageManager
import android.widget.Button
import android.widget.TextView
import android.widget.ImageView
import androidx.appcompat.app.AppCompatActivity
import com.focuszone.R // R.id. ... 등을 위해 import

class LockActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // layout/activity_lock.xml 파일을 레이아웃으로 설정
        setContentView(R.layout.activity_lock) 
        
        val packageName = intent.getStringExtra("BLOCKED_APP_PACKAGE")

        // 앱 이름 가져오기
        val appName = if (packageName != null) {
            try {
                val appInfo = packageManager.getApplicationInfo(packageName, 0)
                packageManager.getApplicationLabel(appInfo).toString()
            } catch (e: PackageManager.NameNotFoundException) {
                "앱" // 앱을 찾을 수 없음
            }
        } else {
            "앱" // 패키지 이름이 전달되지 않음
        }

        val messageView = findViewById<TextView>(R.id.lock_message) // ✅ XML ID와 일치
        messageView.text = "$appName 이(가) 차단되었습니다." // 앱 이름 동적 설정

        // [추가] 앱 아이콘 표시 (XML ID: blocked_app_icon)
        val iconView = findViewById<ImageView>(R.id.blocked_app_icon)
        if (packageName != null) {
            try {
                val icon = packageManager.getApplicationIcon(packageName)
                iconView.setImageDrawable(icon)
            } catch (e: PackageManager.NameNotFoundException) {
                // 아이콘을 찾을 수 없으면 기본 아이콘
                iconView.setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
            }
        } else {
            iconView.setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
        }

        // "돌아가기" 버튼 (홈 화면으로 이동)
        val backButton = findViewById<Button>(R.id.back_button)
        backButton.setOnClickListener {
            val homeIntent = Intent(Intent.ACTION_MAIN)
            homeIntent.addCategory(Intent.CATEGORY_HOME)
            homeIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            startActivity(homeIntent)
            
            // 현재 잠금 화면 종료
            finish()
        }
    }

    // 뒤로가기 버튼 무시 (필수)
    override fun onBackPressed() {
        // 아무것도 하지 않음
    }
}