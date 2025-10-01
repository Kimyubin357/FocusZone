package com.focuszone.lock

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.Arguments

object BlockedAppsHolder { //싱글 톤
    var blockedApps: List<String> = emptyList() // 차단할 앱 패키지명 저장 리스트
}

class BlockedAppsModule(reactContext: ReactApplicationContext) : // reactnative에서 nativemoduels.BlockApps로 접근
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String { //rn 에서 호출할때 쓰는 이름
        return "BlockedApps"
    }

    @ReactMethod
    fun setBlockedApps(apps: ReadableArray, promise: Promise) { // 배열형태로 넘어온 패키지명을 kotlin리스트로 변환
        try {
            val appList = mutableListOf<String>()
            for (i in 0 until apps.size()) {
                val appName = apps.getString(i)
                if (appName != null) {
                    appList.add(appName)
                }
            }
            BlockedAppsHolder.blockedApps = appList
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_BLOCKED_APPS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getBlockedApps(promise: Promise) {
        try {
            val writableArray = Arguments.createArray()
            for (app in BlockedAppsHolder.blockedApps) { // rn쪽에서 가져오는값? BlockedAppHolder.blockedApps 차단앱들 실제 있는 곳 
                writableArray.pushString(app) // js에서 읽을 수 있는 배열생
            }
            promise.resolve(writableArray) //rn쪽으로 반환
        } catch (e: Exception) {
            promise.reject("GET_BLOCKED_APPS_ERROR", e.message, e)
        }
    }
}
