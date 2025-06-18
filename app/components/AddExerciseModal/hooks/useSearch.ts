import { captureUIError } from '../../../services/sentry';
import * as Sentry from '@sentry/react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Keyboard, TextInput } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Search operations helper
interface SearchOperationsParams {
  isSearchActive: boolean;
  searchWidthAnim: Animated.Value;
  contentOffsetAnim: Animated.Value;
  searchInputRef: React.RefObject<TextInput | null>;
  setIsSearchActive: (active: boolean) => void;
  setSearchQuery: (query: string) => void;
  SCREEN_WIDTH: number;
}

const handleSearchOperations = ({
  isSearchActive,
  searchWidthAnim,
  contentOffsetAnim,
  searchInputRef,
  setIsSearchActive,
  setSearchQuery,
  SCREEN_WIDTH,
}: SearchOperationsParams) => {
  const openSearch = () => {
    try {
      // Track search activation
      Sentry.addBreadcrumb({
        message: 'Search Bar Opened',
        category: 'user.interaction',
        level: 'info',
        data: {
          trigger: 'search_icon_click',
          screenWidth: SCREEN_WIDTH,
        },
      });

      setIsSearchActive(true);
      Animated.timing(searchWidthAnim, {
        toValue: SCREEN_WIDTH - 32,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      });

      Animated.timing(contentOffsetAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } catch (error) {
      captureUIError(error as Error, 'SearchOperations.openSearch', 'add-exercise-modal');
    }
  };

  const collapseSearchUI = () => {
    Animated.timing(searchWidthAnim, {
      toValue: 40,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setIsSearchActive(false);
    });

    Animated.timing(contentOffsetAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const clearSearch = () => {
    setSearchQuery('');
    collapseSearchUI();
  };

  const handleSearchIconPress = () => {
    if (isSearchActive) {
      collapseSearchUI();
    } else {
      openSearch();
    }
  };

  const handleSearchSubmit = () => {
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  };

  return {
    openSearch,
    collapseSearchUI,
    clearSearch,
    handleSearchIconPress,
    handleSearchSubmit,
  };
};

// Custom hook for search state management
export const useSearchState = (onSearchFromStep1?: () => void) => {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [shouldActivateSearchOnStep2, setShouldActivateSearchOnStep2] = useState(false);
  const searchWidthAnim = useRef(new Animated.Value(40)).current;
  const contentOffsetAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);
  const searchResultsOpacity = useRef(new Animated.Value(0)).current;

  const searchOperations = handleSearchOperations({
    isSearchActive,
    searchWidthAnim,
    contentOffsetAnim,
    searchInputRef,
    setIsSearchActive,
    setSearchQuery,
    SCREEN_WIDTH,
  });

  // Override openSearch for step 1 to navigate to step 2 with all exercises
  const openSearchWithNavigation = () => {
    if (onSearchFromStep1) {
      setShouldActivateSearchOnStep2(true);
      onSearchFromStep1();
    } else {
      searchOperations.openSearch();
    }
  };

  // Search results header animation
  useEffect(() => {
    if (!isSearchActive && searchQuery.trim() !== '') {
      Animated.timing(searchResultsOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(searchResultsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isSearchActive, searchQuery]);

  // Keyboard dismiss listener
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      if (isSearchActive && searchQuery.trim() !== '') {
        searchOperations.collapseSearchUI();
      }
    });

    return () => {
      keyboardDidHideListener.remove();
    };
  }, [isSearchActive, searchQuery]);

  // Auto-activate search when navigating from step 1 search
  const activateSearchOnStep2 = () => {
    if (shouldActivateSearchOnStep2) {
      setShouldActivateSearchOnStep2(false);
      // Delay to ensure the component is mounted
      setTimeout(() => {
        searchOperations.openSearch();
      }, 100);
    }
  };

  return {
    isSearchActive,
    setIsSearchActive,
    searchQuery,
    setSearchQuery,
    searchWidthAnim,
    contentOffsetAnim,
    searchInputRef,
    searchResultsOpacity,
    shouldActivateSearchOnStep2,
    setShouldActivateSearchOnStep2,
    activateSearchOnStep2,
    ...searchOperations,
    openSearchWithNavigation,
  };
};
