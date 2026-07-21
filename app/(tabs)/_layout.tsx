import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { JournalColors } from '@/constants/theme';

function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={[styles.icon, { color }]}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: JournalColors.tabActive,
        tabBarInactiveTintColor: JournalColors.tabInactive,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon glyph="🏠" color={color} /> }}
      />
      <Tabs.Screen
        name="membership"
        options={{
          title: 'Membership',
          tabBarIcon: ({ color }) => <TabIcon glyph="⭐" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon glyph="⚙️" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: JournalColors.white,
    borderTopColor: JournalColors.gridLine,
    borderTopWidth: 1,
  },
  label: { fontSize: 11, fontWeight: '700' },
  icon: { fontSize: 20 },
});
