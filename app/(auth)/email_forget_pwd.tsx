import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from "expo-status-bar";
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";

export default function EmailForgetCode() {
    const [email, setEmail] = useState('');
    
    return (
    <SafeAreaView>
        <StatusBar />
        <Text>등록할 때 사용한 이메일 주소를 입력하세요.</Text>
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
    </SafeAreaView>
    )
}

const styles = StyleSheet.create({
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
})