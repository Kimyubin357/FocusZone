package com.focuszone.lock

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BlockedAppsPackage : ReactPackage { //BlockedAppModule을 RN이 인식 할 수 있도록
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> { //BlckedAppsModule을 리스트로 반환해서 RN이 이 모듈을 인식
        return listOf(BlockedAppsModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}

// MainApplication에서 getPackage를 등록해서 사용