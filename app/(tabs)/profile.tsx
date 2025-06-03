import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Avatar, IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GeneralHeader } from '../components/GeneralHeader';
import OptimizedImage from '../components/OptimizedImage';
import { BORDER_RADIUS, COLORS, HEADER_HEIGHT, SPACING } from '../constants/theme';
import useImagePreloader from '../hooks/useImagePreloader';
import { useSentryAuthTracking } from '../hooks/useSentryDataCollection';
import firebaseAvatarService from '../services/firebaseAvatarService';
import { useAuth } from '../store/AuthContext';
import { safeAsyncFireAndForget } from '../utils/asyncErrorHandler';
import { markAsImportantImage } from '../utils/imagePreloader';

interface MenuItemProps {
  icon: string;
  title: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  isLast?: boolean;
}

const MenuItem = ({ icon, title, onPress, rightElement, isLast }: MenuItemProps) => (
  <View>
    <Pressable onPress={onPress} style={styles.menuItem}>
      <View style={styles.menuItemLeft}>
        <MaterialCommunityIcons
          name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={24}
          color={title === 'Logout' ? COLORS.error : COLORS.text}
          style={styles.menuIcon}
        />
        <Text
          variant="bodyLarge"
          style={[styles.menuText, { color: title === 'Logout' ? COLORS.error : COLORS.text }]}
        >
          {title}
        </Text>
      </View>
      {rightElement}
    </Pressable>
    {!isLast && (
      <LinearGradient
        colors={[
          'transparent',
          'rgba(108, 71, 255, 0.3)',
          'rgba(108, 71, 255, 0.3)',
          'rgba(108, 71, 255, 0.3)',
          'transparent',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.1, 0.5, 0.9, 1]}
        style={styles.menuItemBorder}
      />
    )}
  </View>
);

export default function ProfileScreen() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const _insets = useSafeAreaInsets();
  const { user, refreshUser, signOut } = useAuth();
  const sentry = useSentryAuthTracking('ProfileScreen');

  // Preload avatar image when URL is available
  const { loaded: _avatarPreloaded } = useImagePreloader(avatarUrl ? [avatarUrl] : [], {
    priority: 'high',
    debugLabel: 'ProfileAvatar',
  });

  // Load user avatar with caching
  const loadUserAvatar = useCallback(async () => {
    if (!user?.id) return;

    try {
      setImageLoadError(false);

      // First check if it's in the user metadata (fastest)
      if (user.user_metadata?.avatar_url) {
        const avatarUri = user.user_metadata.avatar_url;
        // Only update if the URL has changed
        if (avatarUrl !== avatarUri) {
          setAvatarUrl(avatarUri);

          // Just mark as important - no need to preload again
          markAsImportantImage(avatarUri);
        }
        return;
      }

      // Otherwise fetch from the service
      const userAvatar = await firebaseAvatarService.getUserAvatar(user.id);
      if (userAvatar) {
        const avatarUri = userAvatar.url;
        // Only update if the URL has changed
        if (avatarUrl !== avatarUri) {
          setAvatarUrl(avatarUri);

          // Just mark as important - no need to preload again
          markAsImportantImage(avatarUri);
        }
      } else {
        // Only update if the URL has changed
        if (avatarUrl !== null) {
          setAvatarUrl(null);
        }
      }
    } catch (error) {
      console.error('Error loading user avatar:', error);
      // Only update if the URL has changed
      if (avatarUrl !== null) {
        setAvatarUrl(null);
      }
    }
  }, [user, avatarUrl]);

  // Refresh user data when screen is mounted or becomes active
  const refreshData = useCallback(async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes

    setIsRefreshing(true);
    try {
      await Promise.all([loadUserAvatar(), refreshUser()]);
    } catch (error) {
      console.error('Error refreshing profile data:', error);
      console.error('Profile refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, loadUserAvatar, refreshUser, pathname]);

  useEffect(() => {
    // Only refresh when the screen becomes active and we're not already refreshing
    if (pathname === '/profile') {
      safeAsyncFireAndForget(() => refreshData(), {
        errorPrefix: 'Profile data refresh failed',
        context: { pathname },
      });
    }
  }, [pathname, refreshData]);

  // Get user's full name and email from metadata, fallback to defaults if not set
  const userFullName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';

  const _handleEditProfile = () => {
    router.push('/(auth)/edit-profile');
  };

  const _handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUser();
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle avatar upload
  const handleAvatarPress = async () => {
    if (!user?.id) {
      Alert.alert('Authentication Required', 'Please sign in to update your avatar');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to make this work!',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        try {
          setLoadingAvatar(true);
          const uploadedAvatar = await firebaseAvatarService.uploadAvatar(
            user.id,
            result.assets[0].uri,
          );

          setAvatarUrl(uploadedAvatar.url);
          console.log('Avatar updated successfully');

          // Update local user object to reflect changes immediately
          await refreshUser();
        } catch (uploadError) {
          console.error('Error uploading avatar:', uploadError);

          Alert.alert('Upload Failed', 'Failed to upload avatar. Please try again.');
        } finally {
          setLoadingAvatar(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      console.error('Image picker failed:', error);
      Alert.alert('Selection Failed', 'Failed to select image. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <GeneralHeader
        title="Profile"
        icon={<MaterialCommunityIcons name="account" size={24} color={COLORS.text} />}
        rightElement={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable style={styles.premiumButton} onPress={() => {}}>
              <View style={styles.premiumIconColumn}>
                <IconButton icon="crown" iconColor="#f9e009" size={26} style={styles.premiumIcon} />
                <Text style={styles.premiumText}>PREMIUM</Text>
              </View>
            </Pressable>
          </View>
        }
      />
      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: HEADER_HEIGHT,
          paddingBottom: 100,
        }}
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          {/* Avatar with upload functionality */}
          <Pressable
            onPress={handleAvatarPress}
            style={styles.avatarContainer}
            disabled={loadingAvatar}
          >
            {loadingAvatar ? (
              <View style={styles.avatarPlaceholder}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : avatarUrl && !imageLoadError ? (
              <OptimizedImage
                source={{ uri: avatarUrl }}
                style={styles.avatar}
                priority="high"
                cachePolicy="immutable"
                isImportant={true}
                debugLabel="ProfileAvatar"
                showLoader={true}
                loaderColor={COLORS.primary}
                resizeMode="cover"
                fallback={require('../../assets/placeholder.jpg')}
                onError={(error) => {
                  console.error('Error loading avatar image:', error);
                  setImageLoadError(true);
                }}
              />
            ) : (
              <Avatar.Icon
                size={100}
                icon="account"
                style={styles.avatarPlaceholder}
                color={COLORS.disabled}
              />
            )}
            <View style={styles.avatarEditBadge}>
              <MaterialCommunityIcons name="camera" size={18} color="#fff" />
            </View>
          </Pressable>
          <Text variant="titleLarge" style={styles.name}>
            {userFullName}
          </Text>
          <Text variant="bodyMedium" style={styles.email}>
            {userEmail}
          </Text>

          <Pressable style={styles.premiumCard} onPress={() => {}}>
            <LinearGradient
              colors={['#7E4AFA', '#5727B0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumGradient}
            >
              <View style={styles.premiumContent}>
                <View style={styles.premiumLeft}>
                  <View style={styles.premiumTitleContainer}>
                    <MaterialCommunityIcons
                      name="crown"
                      size={26}
                      color="#FFD700"
                      style={styles.crownIcon}
                    />
                    <Text style={styles.premiumTitle}>Upgrade to Premium</Text>
                  </View>
                  <Text style={styles.premiumDescription}>
                    Enjoy workout access without ads and restrictions
                  </Text>
                </View>
                <IconButton
                  icon="chevron-right"
                  iconColor="#7E4AFA"
                  size={16}
                  style={styles.arrowButton}
                />
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.menuSection}>
          <MenuItem icon="account-edit" title="Edit Profile" onPress={_handleEditProfile} />
          <MenuItem icon="cog" title="Settings" onPress={() => router.push('/(stack)/settings')} />
          <MenuItem icon="crown" title="Subscription Membership" />
          <MenuItem
            icon="logout"
            title="Logout"
            onPress={async () => {
              try {
                sentry.trackLogout();
                await signOut();
                router.replace('/(auth)/login');
              } catch (error) {
                console.error('Error signing out:', error);
                sentry.captureException(error as Error, {
                  context: 'profile_logout_navigation',
                  attempted_route: '/(auth)/login',
                });
                alert('Failed to sign out. Please try again.');
              }
            }}
            isLast
          />
        </View>

        <View style={[styles.menuSection, styles.secondMenuSection]}>
          <MenuItem icon="help-circle" title="Help" />
          <MenuItem icon="new-box" title="What's New" />
          <MenuItem icon="star" title="Rate the App" />
          <MenuItem icon="facebook" title="Our Facebook" />
          <MenuItem icon="instagram" title="Our Instagram" />
          <MenuItem icon="share-variant" title="Share with Friends" isLast />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: COLORS.background,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    backgroundColor: COLORS.primary,
    margin: 0,
  },
  headerTitle: {
    marginLeft: SPACING.sm,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    backgroundColor: COLORS.primary,
    height: 0.2,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: SPACING.lg,
    marginTop: SPACING.md,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  avatarPlaceholder: {
    backgroundColor: '#2A2A2A',
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(107, 78, 255, 0.3)',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  name: {
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: SPACING.xs,
    fontSize: 24,
  },
  email: {
    color: COLORS.disabled,
    marginBottom: SPACING.xs,
    fontSize: 14,
  },
  premiumCard: {
    width: '100%',
    marginVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  premiumGradient: {
    width: '100%',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  premiumLeft: {
    flex: 1,
  },
  premiumTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  crownIcon: {
    marginRight: 8,
  },
  premiumTitle: {
    color: 'white',
    fontWeight: '600',
    fontSize: 18,
  },
  premiumDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  arrowButton: {
    margin: 0,
    opacity: 0.8,
    backgroundColor: COLORS.text,
  },
  menuSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
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
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: SPACING.md,
  },
  menuText: {
    color: COLORS.text,
    fontSize: 16,
  },
  chevron: {
    marginLeft: SPACING.md,
  },
  secondMenuSection: {
    marginTop: 0,
  },
  menuItemBorder: {
    height: 1,
    marginHorizontal: 8,
  },
  premiumButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  premiumIcon: {
    margin: 0,
    marginTop: 0,
    marginLeft: 0,
  },
  premiumText: {
    color: '#f9e009',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -10,
  },
  premiumIconColumn: {
    flexDirection: 'column',
    alignItems: 'center',
  },
});
