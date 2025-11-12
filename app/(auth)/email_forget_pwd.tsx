import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar, // ✅ react-native의 StatusBar로 변경
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from '../../firebaseConfig';

// 앱 테마 색상 정의
const THEME_COLOR = "#0D4093";

export default function EmailForgetCode() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  
  // ✅ 로딩, 포커스, 유효성 상태 추가
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);

  // ✅ 이메일 유효성 검사
  useEffect(() => {
    const emailValid = /\S+@\S+\.\S+/.test(email);
    setIsEmailValid(emailValid);
  }, [email]);

  const handleSendLink = async () => {
    // ✅ 유효성 및 로딩 상태 검사
    if (!isEmailValid || loading) {
      if (!email) {
        Alert.alert("알림", "이메일을 입력해 주세요.");
      }
      return;
    }
    setLoading(true); // ✅ 로딩 시작

    try {
      await sendPasswordResetEmail(auth, email.trim());
      
      Alert.alert(
        "링크 전송 완료",
        `비밀번호 재설정 링크가 ${email}로 전송되었습니다.`,
        [
          {
            text: "확인",
            onPress: () => router.replace('/email_login')
          },
        ]
      );
      
    } catch(error: any) {
      let errorMessage = "오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = "유효하지 않은 이메일 형식입니다.";
          break;
        case 'auth/user-not-found':
          errorMessage = "해당 이메일로 등록된 사용자가 없습니다.";
          break;
        default:
          console.log("Password Reset Error:", error.code, error.message);
      }
      Alert.alert("전송 오류", errorMessage);
    } finally {
      setLoading(false); // ✅ 로딩 종료
    }
  };

  const handleDismissKeyboard = () => Keyboard.dismiss();

  return (
    <TouchableWithoutFeedback onPress={handleDismissKeyboard} accessible={false}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle='dark-content' />
        
        {/* ✅ KAV + space-between 레이아웃 적용 */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          {/* 상단 컨테이너 */}
          <View style={styles.topContainer}>
            <Text style={styles.title}>암호 재설정</Text>
            <Text style={styles.subtitle}>
              등록할 때 사용한 이메일 주소를 입력하세요.
            </Text>
            
            {/* ✅ Input Wrapper (pill-shape 적용) */}
            <View style={[
              styles.inputWrapper,
              { borderColor: emailFocused ? THEME_COLOR : "#E0E0E0" }
            ]}>
              <Ionicons
                style={styles.icon}
                name='mail-outline'
                size={22}
                color={emailFocused ? THEME_COLOR : "grey"}
              />
              <TextInput
                style={styles.input}
                placeholder="이메일"
                placeholderTextColor={'grey'}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

           
          </View>

          {/* 하단 버튼 컨테이너 */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.continueButton,
                // ✅ 테마 색상 및 로딩 상태 적용
                { backgroundColor: isEmailValid && !loading ? THEME_COLOR : '#ccc' }
              ]}
              onPress={handleSendLink}
              disabled={!isEmailValid || loading}
              activeOpacity={0.7}
            >
              <Text style={styles.continueButtonText}>
                {loading ? "전송 중..." : "링크 전송"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

// ✅ email_login / email_signup과 동일한 스타일 구조
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  keyboardAvoidingView: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
  },
  topContainer: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 15,
    marginTop: 60,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
    maxWidth: 300,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 25, // pill-shape
    paddingHorizontal: 15,
    height: 50,
    width: '100%',
    maxWidth: 350,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#000000',
    fontSize: 16,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
    paddingBottom: 20,
  },
  continueButton: {
    width: '100%',
    height: 50,
    borderRadius: 25, // pill-shape
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196f3',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});