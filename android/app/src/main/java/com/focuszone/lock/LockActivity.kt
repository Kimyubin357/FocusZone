// LockActivity.kt
package com.focuszone.lock

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.focuszone.R // R.id. ... 등을 위해 import

class LockActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // layout/activity_lock.xml 파일을 레이아웃으로 설정
        setContentView(R.layout.activity_lock) 
        
        // (선택) 어떤 앱이 차단되었는지 표시
        val appName = intent.getStringExtra("BLOCKED_APP_NAME") ?: "앱"
        val messageView = findViewById<TextView>(R.id.lock_message)
        messageView.text = "지금은 $appName 을 사용할 수 없습니다."

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