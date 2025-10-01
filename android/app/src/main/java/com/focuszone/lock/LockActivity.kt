package com.focuszone.lock

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import android.widget.TextView

class LockActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val textView = TextView(this).apply {
            text = "잠금된 앱입니다 🔒"
            textSize = 24f
            setPadding(50, 200, 50, 200)
        }
        setContentView(textView)
    }
}
