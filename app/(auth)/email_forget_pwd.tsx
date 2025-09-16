import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StatusBar } from "expo-status-bar";
import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from '../../firebaseConfig';

export default function EmailForgetCode() {
    const router = useRouter();
    const [email, setEmail] = useState('');

    const sendPasswordResetLink = async () => {
        if (!email) {
            Alert.alert("알림", "이메일을 입력해 주세요.");
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            
            // 성공 시, 사용자에게 링크를 보냈음을 명확히 알림
            Alert.alert(
                "링크 전송 완료",
                `비밀번호 재설정 링크가 ${email}로 전송되었습니다.`,
                [
                    {
                        text: "확인",
                        onPress: () => router.replace('/email_login') // Navigation now happens only when the user presses '확인'
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
            }
            Alert.alert("오류", errorMessage);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style='dark' />
            <View style={styles.textContainer}>
                <Text>등록할 때 사용한 이메일 주소를 입력하세요.</Text>
            </View>
            
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
            <TouchableOpacity 
                style={styles.codeSendButton}
                onPress={sendPasswordResetLink}
            >
                <Text style={styles.ButtonText}>링크 전송</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "flex-start",
        alignItems: 'flex-start',
        padding: 20,
        marginTop: 50,
    },
    textContainer: {
        marginBottom: 20,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 17,
        paddingHorizontal: 15,
        marginBottom: 40,
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
    codeSendButton: {
        width: '100%',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2196f3',
        height: 50,
    },
    ButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    }
});