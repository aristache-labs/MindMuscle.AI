import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { GestureResponderEvent, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Divider, IconButton, Menu, Text } from 'react-native-paper';
import { COLORS } from '../constants/theme';
import { GeneralHeader } from './GeneralHeader';
import * as Sentry from '@sentry/react-native';

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

  // Track component lifecycle
  React.useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'MenuHeader component mounted',
      category: 'component.lifecycle',
      level: 'info',
      data: {
        currentOption,
        hasOnOptionSelect: !!onOptionSelect,
        availableOptions: options.length,
      },
    });

    return () => {
      Sentry.addBreadcrumb({
        message: 'MenuHeader component unmounted',
        category: 'component.lifecycle',
        level: 'info',
        data: { currentOption },
      });
    };
  }, [currentOption, onOptionSelect]);

  // Track current option changes
  React.useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'MenuHeader current option changed',
      category: 'ui.state',
      level: 'info',
      data: {
        newCurrentOption: currentOption,
        isValidOption: options.some((opt) => opt.label === currentOption),
      },
    });
  }, [currentOption]);

  // Track menu visibility changes
  React.useEffect(() => {
    if (menuVisible) {
      Sentry.addBreadcrumb({
        message: 'MenuHeader dropdown menu opened',
        category: 'ui.menu',
        level: 'info',
        data: {
          currentOption,
          availableOptions: options.map((opt) => opt.label),
        },
      });
    } else {
      Sentry.addBreadcrumb({
        message: 'MenuHeader dropdown menu closed',
        category: 'ui.menu',
        level: 'info',
        data: { currentOption },
      });
    }
  }, [menuVisible, currentOption]);

  const showMenu = (event: GestureResponderEvent) => {
    try {
      const { pageX, pageY } = event.nativeEvent;

      Sentry.addBreadcrumb({
        message: 'MenuHeader dropdown button pressed',
        category: 'ui.interaction',
        level: 'info',
        data: {
          currentOption,
          menuPosition: { x: pageX, y: pageY },
        },
      });

      setMenuAnchor({ x: pageX - 10, y: pageY + 10 });
      setMenuVisible(true);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MenuHeader',
          action: 'show_menu',
        },
        extra: {
          currentOption,
          eventData: event.nativeEvent,
        },
      });
    }
  };

  const handleOptionSelect = (option: (typeof options)[0]) => {
    try {
      Sentry.addBreadcrumb({
        message: 'MenuHeader option selected',
        category: 'ui.interaction',
        level: 'info',
        data: {
          selectedOption: option.label,
          selectedRoute: option.route,
          isTab: option.isTab,
          previousOption: currentOption,
          isSameOption: option.label === currentOption,
        },
      });

      setMenuVisible(false);

      // Always navigate to the selected route regardless of current state
      // This ensures navigation works correctly from any screen
      if (option.label !== currentOption) {
        Sentry.addBreadcrumb({
          message: 'MenuHeader initiating navigation',
          category: 'navigation.start',
          level: 'info',
          data: {
            from: currentOption,
            to: option.label,
            route: option.route,
            isTab: option.isTab,
          },
        });

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

        Sentry.addBreadcrumb({
          message: 'MenuHeader navigation completed',
          category: 'navigation.complete',
          level: 'info',
          data: {
            selectedOption: option.label,
            route: option.route,
          },
        });

        // Also call the callback if provided (for UI state updates)
        if (onOptionSelect) {
          try {
            onOptionSelect(option.label);
          } catch (callbackError) {
            Sentry.captureException(callbackError, {
              tags: {
                component: 'MenuHeader',
                action: 'option_select_callback',
              },
              extra: {
                selectedOption: option.label,
                currentOption,
              },
            });
          }
        }
      } else {
        Sentry.addBreadcrumb({
          message: 'MenuHeader same option selected, no navigation needed',
          category: 'ui.interaction',
          level: 'debug',
          data: { option: option.label },
        });
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MenuHeader',
          action: 'handle_option_select',
        },
        extra: {
          selectedOption: option,
          currentOption,
        },
      });
    }
  };

  const handleMenuDismiss = React.useCallback(() => {
    try {
      Sentry.addBreadcrumb({
        message: 'MenuHeader menu dismissed',
        category: 'ui.interaction',
        level: 'info',
        data: { currentOption },
      });
      setMenuVisible(false);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MenuHeader',
          action: 'menu_dismiss',
        },
        extra: { currentOption },
      });
    }
  }, [currentOption]);

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
        onDismiss={handleMenuDismiss}
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
