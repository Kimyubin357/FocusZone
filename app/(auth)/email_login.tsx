import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

export default function EmailLogin() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isPasswordValid, setIsPasswordValid] = useState(false);
    const [isEmailValid, setIsEmailValid] = useState(false);
    const [isFormValid, setIsFormValid] = useState(false);

    useEffect(() => {
        // 비밀번호 유효성 검사
        const passwordValid = password.length >= 8;
        setIsPasswordValid(passwordValid);
        
        // 이메일 유효성 검사 (간단한 정규식 사용)
        const emailValid = /\S+@\S+\.\S+/.test(email);
        setIsEmailValid(emailValid);

        // 전체 폼 유효성 검사
        setIsFormValid(passwordValid && emailValid);
    }, [email, password]);

    const handleContinue = () => {
        if (isFormValid) {
            // TODO: Implement sign-up logic
            console.log('이메일: ', email);
            console.log('비밀번호: ', password);
        }
    };
    
    // 키보드 외부를 터치하면 키보드를 닫는 함수
    const handleDismissKeyboard = () => {
        Keyboard.dismiss();
    };

    return (
        // TouchableWithoutFeedback으로 감싸서 배경 터치 시 키보드 닫기
        <TouchableWithoutFeedback onPress={handleDismissKeyboard} accessible={false}>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" />
                
                {/* KeyboardAvoidingView로 전체 콘텐츠를 감싸서 키보드에 따라 레이아웃 조정 */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardAvoidingView}
                >
                    <Text style={styles.title}>이메일로 계속하기</Text>

                    <View style={styles.inputContainer}>
                        <View style={styles.inputWrapper}>
                            <Ionicons style={styles.icon} name='mail-outline' size={24} />
                            <TextInput
                                style={styles.input}
                                placeholder="이메일"
                                placeholderTextColor={'grey'}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                            />
                        </View>
                        
                        <View style={styles.inputWrapper}>
                            <Ionicons style={styles.icon} name='lock-closed-outline' size={24} />
                            <TextInput
                                style={styles.input}
                                placeholder="암호"
                                placeholderTextColor={'grey'}
                                secureTextEntry={!isPasswordVisible}
                                value={password}
                                onChangeText={setPassword}
                            />
                        
                            <TouchableOpacity
                                style={styles.passwordVisibilityToggle}
                                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                            >
                                <Ionicons name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'} size={24} /> 
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.loginTextContainer}
                        onPress={() => router.push('/email_forget_pwd')}
                    >
                        <Text style={styles.loginText}>
                            <Text style={styles.loginPrompt}>암호 잊음 </Text>
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
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        paddingHorizontal: 20,
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
        color: '#000000'
    },
    passwordIndicator: {
        fontSize: 14,
        fontWeight: 'bold',
        marginRight: 10,
    },
    passwordVisibilityToggle: {
        padding: 5,
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
