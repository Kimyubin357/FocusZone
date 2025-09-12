import { useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import CustomButton from '../../components/Button';

export default function LoginMain() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>
        집중장소 {'\n'}
        시작해볼까요?
      </Text>

      <View style={styles.buttonContainer}>
        <CustomButton
          title="이메일로 계속하기"
          backgroundColor="#2196F3"
          onPress={() => router.push('/email_signup')}
        />
        <Text style={styles.orText}>또는</Text>
        <CustomButton
          title="네이버로 계속하기"
          backgroundColor="#03C75A"
          onPress={() => console.log('Naver login')}
        />
        <CustomButton
          title="카카오로 계속하기"
          backgroundColor="#FEE500"
          textColor="#000000"
          onPress={() => console.log('Kakao login')}
        />
        <CustomButton
          title="Apple로 계속하기"
          backgroundColor="#000000"
          onPress={() => console.log('Apple login')}
        />
        <CustomButton
          title="Google로 계속하기"
          backgroundColor="#F2F2F2"
          textColor="#000000"
          onPress={() => console.log('Google login')}
        />
      </View>
      <Text style={styles.termsText}>
        계속하면, 개인정보 보호정책 및 이용약관에 동의하게 됩니다
      </Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 350,
  },
  orText: {
    textAlign: 'center',
    marginVertical: 15,
    fontSize: 16,
    color: '#888',
  },
  termsText: {
    marginTop: 20,
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});

