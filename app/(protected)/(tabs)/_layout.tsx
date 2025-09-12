import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from "expo-router";



export default function TabsLayout() {
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#000000',//탭바 포커스 될 때 바뀌는 색깔
      }}
    >
      <Tabs.Screen 
        name="index"      
        options={{
          title : '집중장소',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'location-sharp' : 'location-outline'} color={color} size={24} />
          ),
        }} 
      />
      <Tabs.Screen
        name="stats"
        options={{
          title : '통계',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'stats-chart-sharp' : 'stats-chart-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="group_zone"
        options={{
          title : '그룹장소',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people-sharp' : 'people-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen 
        name="profile"    
        options={{ 
          title : '프로필',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person-circle-sharp' : 'person-circle-outline'} color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
