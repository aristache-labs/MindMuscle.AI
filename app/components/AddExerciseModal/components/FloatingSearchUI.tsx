import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { COLORS } from '../../../constants/theme';
import { useSearchState } from '../hooks/useSearch';
import { styles } from '../styles';

// Floating Search UI Component
interface FloatingSearchUIProps {
  searchState: ReturnType<typeof useSearchState>;
  stepTitle: string;
  currentStep?: number;
}

export const FloatingSearchUI = ({
  searchState,
  stepTitle,
  currentStep,
}: FloatingSearchUIProps) => {
  const getPlaceholder = () => {
    if (currentStep === 1) {
      return 'Search muscle groups...';
    }
    return 'Search exercises...';
  };

  return (
    <>
      {/* Floating Search */}
      <View style={styles.floatingSearchRow}>
        <Animated.View
          style={[
            styles.searchContainer,
            {
              width: searchState.isSearchActive ? searchState.searchWidthAnim : 40,
              flex: searchState.isSearchActive ? 1 : undefined,
            },
          ]}
        >
          {!searchState.isSearchActive ? (
            <TouchableOpacity
              style={styles.searchIconButton}
              onPress={
                currentStep === 1 ? searchState.openSearchWithNavigation : searchState.openSearch
              }
            >
              <MaterialIcons
                name="search"
                size={22}
                color={searchState.searchQuery.trim() ? COLORS.primary : COLORS.text}
              />
              {searchState.searchQuery.trim() !== '' && (
                <View style={styles.activeFilterIndicator} />
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.activeSearchContainer}>
              <TouchableOpacity onPress={searchState.handleSearchIconPress}>
                <MaterialIcons
                  name="search"
                  size={24}
                  color={COLORS.text}
                  style={styles.searchIconActive}
                />
              </TouchableOpacity>
              <TextInput
                ref={searchState.searchInputRef}
                style={styles.searchInput}
                placeholder={getPlaceholder()}
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={searchState.searchQuery}
                onChangeText={searchState.setSearchQuery}
                autoFocus={searchState.isSearchActive}
                returnKeyType="search"
                onSubmitEditing={searchState.handleSearchSubmit}
              />
              <TouchableOpacity onPress={searchState.clearSearch}>
                <MaterialIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>

      {/* Background Overlay to collapse search */}
      {searchState.isSearchActive && (
        <TouchableWithoutFeedback onPress={searchState.collapseSearchUI}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Floating search results header */}
      {!searchState.isSearchActive && searchState.searchQuery.trim() !== '' && (
        <Animated.View
          style={[
            styles.searchResultsHeader,
            {
              opacity: searchState.searchResultsOpacity,
              transform: [
                {
                  translateY: searchState.searchResultsOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.searchResultsText} numberOfLines={1}>
            Results for "
            <Text style={styles.queryHighlight} numberOfLines={1} ellipsizeMode="middle">
              {searchState.searchQuery.length > 15
                ? searchState.searchQuery.substring(0, 15) + '...'
                : searchState.searchQuery}
            </Text>
            " in {stepTitle}
          </Text>
          <TouchableOpacity
            onPress={searchState.clearSearch}
            style={styles.clearSearchResultsButton}
          >
            <MaterialIcons name="close" size={18} color={COLORS.text} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );
};
