import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import React, { useContext, useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';
import { AuthContext } from '../../src/services/auth/authContext';

export default function EmailSignUp() {
  const router = useRouter();
 
  const { logIn } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const passwordValid = password.length >= 8;
    setIsPasswordValid(passwordValid);

    const emailValid = /\S+@\S+\.\S+/.test(email);
    setIsEmailValid(emailValid);

    setIsFormValid(passwordValid && emailValid);
  }, [email, password]);

  const getPasswordIndicatorColor = () => {
    if (password.length === 0) return '#ccc';
    return isPasswordValid ? 'green' : 'red';
  };

  const handleContinue = async () => {
    if (!isFormValid) return;
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // 회원가입 성공하면 onAuthStateChanged가 감지해서 자동 라우팅됨
      setErrorMessage(null);
      logIn();
    } catch (error: any) {
      let errorMessage = "회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.";
        
        // ✅ Firebase 에러 코드를 이용해 맞춤형 메시지 설정
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = "이미 가입된 이메일 주소입니다.";
                break;
            case 'auth/invalid-email':
                errorMessage = "유효하지 않은 이메일 형식입니다.";
                break;
            case 'auth/weak-password':
                errorMessage = "비밀번호는 최소 6자 이상이어야 합니다.";
                break;
            default:
                console.log("Firebase Signup Error:", error.code, error.message);
                break;
        }
        
        // ✅ Alert 창으로 에러 메시지 표시
        Alert.alert("회원가입 오류", errorMessage);
    }
  };

  const handleDismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback onPress={handleDismissKeyboard} accessible={false}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <Text style={styles.title}>이메일로 가입</Text>

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons style={styles.icon} name="mail-outline" size={24} />
              <TextInput
                style={styles.input}
                placeholder="이메일"
                placeholderTextColor="grey"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons style={styles.icon} name="lock-closed-outline" size={24} />
              <TextInput
                style={styles.input}
                placeholder="암호"
                placeholderTextColor="grey"
                secureTextEntry={!isPasswordVisible}
                value={password}
                onChangeText={setPassword}
              />
              <Text style={[styles.passwordIndicator, { color: getPasswordIndicatorColor() }]}>
                {password.length}/8
              </Text>
              <TouchableOpacity
                style={styles.passwordVisibilityToggle}
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              >
                <Ionicons name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'} size={24} />
              </TouchableOpacity>
            </View>
          </View>

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          <TouchableOpacity
            style={styles.loginTextContainer}
            onPress={() => router.push('/email_login')}
          >
            <Text style={styles.loginText}>
              <Text style={styles.loginPrompt}>계정이 있으신가요? </Text>
              <Text style={styles.loginLink}>로그인</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: isFormValid ? '#2196F3' : '#ccc' }]}
              onPress={handleContinue}
              disabled={!isFormValid}
              activeOpacity={0.7}
            >
              <Text style={styles.continueButtonText}>계속하기</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 20,
  },
  keyboardAvoidingView: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 40,
    marginTop: 100,
  },
  inputContainer: {
    width: '100%',
    maxWidth: 350,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 17,
    paddingHorizontal: 15,
    marginBottom: 15,
    height: 50,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
  },
  passwordIndicator: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 10,
  },
  passwordVisibilityToggle: {
    padding: 5,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginVertical: 8,
    textAlign: 'center',
  },
  loginTextContainer: {
    marginTop: 20,
  },
  loginText: {
    textAlign: 'center',
  },
  loginPrompt: {
    fontSize: 14,
    color: '#888',
  },
  loginLink: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 350,
    marginTop: 'auto',
  },
  continueButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
