import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { GestureResponderEvent, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Divider, IconButton, Menu, Text } from 'react-native-paper';
import { COLORS } from '../constants/theme';
import { GeneralHeader } from './GeneralHeader';

const options = [
  { label: 'My Plan', icon: 'calendar-today', route: '/(tabs)', isTab: true },
  { label: 'Single Workout', icon: 'dumbbell', route: '/(stack)/single-workout', isTab: false },
  { label: 'AI Coaching', icon: 'robot', route: '/(stack)/ai-coaching', isTab: false },
  { label: 'Custom', icon: 'tune', route: '/(stack)/custom', isTab: false },
];

interface MenuHeaderProps {
  currentOption: string;
  onOptionSelect?: (option: string) => void;
}

export function MenuHeader({ currentOption, onOptionSelect }: MenuHeaderProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });

  const showMenu = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuAnchor({ x: pageX - 10, y: pageY + 10 });
    setMenuVisible(true);
  };

  const handleOptionSelect = (option: (typeof options)[0]) => {
    setMenuVisible(false);

    // Always navigate to the selected route regardless of current state
    // This ensures navigation works correctly from any screen
    if (option.label !== currentOption) {
      // Handle tab navigation differently
      if (option.isTab) {
        // For My Plan, navigate to the tabs index with a parameter
        router.replace({
          pathname: option.route,
          params: { selectedOption: option.label },
        });
      } else {
        // For other options, navigate directly to their stack routes
        router.replace(option.route);
      }

      // Also call the callback if provided (for UI state updates)
      if (onOptionSelect) {
        onOptionSelect(option.label);
      }
    }
  };

  return (
    <>
      <GeneralHeader
        title={currentOption}
        icon={
          <TouchableOpacity style={styles.dropdownButton} onPress={showMenu}>
            <MaterialIcons
              name={menuVisible ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={24}
              color={COLORS.text}
            />
          </TouchableOpacity>
        }
        rightElement={
          <View style={styles.premiumButton}>
            <View style={styles.premiumIconColumn}>
              <IconButton icon="crown" iconColor="#f9e009" size={26} style={styles.premiumIcon} />
              <Text style={styles.premiumText}>PREMIUM</Text>
            </View>
          </View>
        }
      />
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={menuAnchor}
        style={styles.menuContent}
        contentStyle={styles.menuInner}
      >
        {options.map((option, index) => (
          <React.Fragment key={option.label}>
            <Menu.Item
              onPress={() => handleOptionSelect(option)}
              title={option.label}
              titleStyle={[
                styles.menuItemTitle,
                option.label === currentOption && styles.menuItemTitleActive,
              ]}
              leadingIcon={option.icon}
            />
            {index < options.length - 1 && <Divider style={styles.menuDivider} />}
          </React.Fragment>
        ))}
      </Menu>
    </>
  );
}

const styles = StyleSheet.create({
  dropdownButton: {
    padding: 2,
  },
  premiumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  premiumIconColumn: {
    alignItems: 'center',
  },
  premiumIcon: {
    margin: 0,
    padding: 0,
  },
  premiumText: {
    color: '#f9e009',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -8,
  },
  menuContent: {
    marginTop: 0,
  },
  menuInner: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 0.4,
    borderColor: '#6B4EFF',
    paddingVertical: 8,
    elevation: 4,
  },
  menuItemTitle: {
    color: COLORS.text,
    fontSize: 15,
  },
  menuItemTitleActive: {
    color: '#6B4EFF',
    fontWeight: 'bold',
  },
  menuDivider: {
    backgroundColor: 'rgba(107, 78, 255, 0.3)',
    height: 0.5,
    marginVertical: 4,
  },
});

// Add default export to fix the warning
export default MenuHeader;
