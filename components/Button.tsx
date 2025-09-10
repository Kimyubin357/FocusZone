import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  title: string;
  backgroundColor: string;//버튼 색
  textColor?: string;//글자 색
  onPress: () => void;
}

const Button: React.FC<Props> = ({
  title,
  backgroundColor,
  textColor = 'white',
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.contentContainer}>
        <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 15,//수직 길이
    paddingHorizontal: 20,
    borderRadius: 17,
    marginBottom: 15,//
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flexDirection: 'row',//요소들끼리 정렬을 수평으로 
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 20,
  },
  buttonText: {
    fontSize: 19,
    fontWeight: 'bold',
  },
});

export default Button;