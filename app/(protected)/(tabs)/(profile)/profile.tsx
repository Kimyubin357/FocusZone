import { AuthContext } from "@/src/services/auth/authContext";
import React, { useContext } from "react";
import { Button, Text, View } from "react-native";

export default function Profile() {
  const { logOut } = useContext(AuthContext);
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>프로필 페이지</Text>
      <Button title="로그아웃" onPress={() => logOut()} />
    </View>
  );
}
