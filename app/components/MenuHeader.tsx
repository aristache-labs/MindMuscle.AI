import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, IconButton, Menu, Divider } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { router, usePathname } from 'expo-router';
import { GeneralHeader } from './GeneralHeader';

const options = [
  { label: 'My Plan', icon: 'calendar-today', route: '/(stack)/my-plan' },
  { label: 'Single Workout', icon: 'dumbbell', route: '/(stack)/single-workout' },
  { label: 'AI Coaching', icon: 'robot', route: '/(stack)/ai-coaching' },
  { label: 'Custom', icon: 'tune', route: '/(stack)/custom' }
];

interface MenuHeaderProps {
  currentOption: string;
  onOptionSelect?: (option: string) => void;
}

export function MenuHeader({ currentOption, onOptionSelect }: MenuHeaderProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });
  const pathname = usePathname();

  const showMenu = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuAnchor({ x: pageX - 10, y: pageY + 10 });
    setMenuVisible(true);
  };

  const handleOptionSelect = (option: typeof options[0]) => {
    setMenuVisible(false);
    
    if (onOptionSelect) {
      // If callback provided, use it to handle selection
      onOptionSelect(option.label);
    } else if (option.route !== pathname) {
      // Otherwise navigate to the route if it's different from current
      router.push(option.route);
    }
  };

  return (
    <>
      <GeneralHeader
        title={currentOption}
        icon={
          <TouchableOpacity 
            style={styles.dropdownButton}
            onPress={showMenu}
          >
            <MaterialIcons 
              name={menuVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
              size={24} 
              color={COLORS.text}
            />
          </TouchableOpacity>
        }
        rightElement={
          <View style={styles.premiumButton}>
            <View style={styles.premiumIconColumn}>
              <IconButton
                icon="crown"
                iconColor="#f9e009"
                size={26}
                style={styles.premiumIcon}
              />
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
                option.label === currentOption && styles.menuItemTitleActive
              ]}
              leadingIcon={option.icon}
              disabled={option.label === currentOption}
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