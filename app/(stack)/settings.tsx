import React from 'react';
import { StyleSheet, View, ScrollView, Platform, Pressable } from 'react-native';
import { Text, IconButton, Divider, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isDarkTheme, setIsDarkTheme] = React.useState(true);

  const renderMenuItem = (icon: string, title: string, rightElement?: React.ReactNode, isLast?: boolean) => (
    <View>
      <Pressable style={styles.menuItem}>
        <View style={styles.menuItemLeft}>
          <MaterialCommunityIcons 
            name={icon as any} 
            size={24} 
            color={COLORS.text}
            style={styles.menuIcon}
          />
          <Text variant="bodyLarge" style={styles.menuText}>
            {title}
          </Text>
        </View>
        {rightElement}
      </Pressable>
      {!isLast && (
        <LinearGradient
          colors={['transparent', 'rgba(108, 71, 255, 0.3)', 'rgba(108, 71, 255, 0.3)', 'rgba(108, 71, 255, 0.3)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          locations={[0, 0.1, 0.5, 0.9, 1]}
          style={styles.menuItemBorder}
        />
      )}
    </View>
  );

  const safeGoBack = () => {
    router.push('/(tabs)/profile');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <IconButton
            icon="arrow-left"
            size={28}
            onPress={safeGoBack}
            iconColor={COLORS.text}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Settings</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          {renderMenuItem('bell-outline', 'Notifications')}
          {renderMenuItem('clock-outline', 'Workout Reminders')}
          {renderMenuItem('shield-outline', 'Security')}
          {renderMenuItem('watch', 'Apple Watch')}
          {renderMenuItem('heart', 'Apple Health')}
          {renderMenuItem('ruler', 'Units of Measure')}
          {renderMenuItem('volume-high', 'Smart Weight & Reps Sounds')}
          {renderMenuItem(
            'theme-light-dark',
            'Dark Theme',
            <Switch
              value={isDarkTheme}
              onValueChange={setIsDarkTheme}
              color={COLORS.primary}
            />,
            true // This is the last item
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    height: 56,
    backgroundColor: COLORS.background,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
  },
  backButton: {
    margin: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SPACING.xl,
  },
  section: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6c47ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#6c47ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 16,
  },
  menuText: {
    color: COLORS.text,
    fontSize: 16,
  },
  menuItemBorder: {
    height: 1,
    marginHorizontal: 8,
    
  },
}); 