//firebaseConfig.js
// Import the functions you need from the SDKs you need
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Storage 임포트

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAUDs4ZJE5VUxEEsqrlS7eR52FWG6_46kI",
  authDomain: "focuszone-568cc.firebaseapp.com",
  projectId: "focuszone-568cc",
  storageBucket: "focuszone-568cc.firebasestorage.app",
  messagingSenderId: "374303258798",
  appId: "1:374303258798:web:7dad116748dbddcea3953f",
  measurementId: "G-2WWSHJFNR8"
};


// Firebase 앱 초기화
export const app = initializeApp(firebaseConfig);

// Cloud Firestore 초기화
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

// React Native용 Auth 초기화 (AsyncStorage 기반)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const storage = getStorage(app); // Storage 익스포트 추가

