import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, ScrollView, Platform, Pressable, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Text, TextInput, IconButton, Menu, Divider } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../store/AuthContext';
import { useMeasurements } from '../store/MeasurementsContext';
import { format, isValid, subYears, isAfter, isBefore } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../services/supabase';
import { ThemedDatePicker } from '../components/ThemedDatePicker';
import { ThemedNumberPicker } from '../components/ThemedNumberPicker';

// Define types for form data
interface FormData {
  fullName: string;
  email: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other' | '';
  weight: string;
  height: string;
}

const genderOptions = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' }
];

// Gender Dropdown Component
function GenderDropdown({ 
  value, 
  onChange, 
  focused, 
  onFocus 
}: { 
  value: string; 
  onChange: (value: FormData['gender']) => void;
  focused: boolean;
  onFocus: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [inputWidth, setInputWidth] = useState(0);

  const handlePress = () => {
    setVisible(true);
    onFocus();
  };

  return (
    <View 
      style={[styles.inputContainer, focused && styles.inputContainerFocused]}
      onLayout={e => setInputWidth(e.nativeEvent.layout.width)}
    >
      <Menu
        visible={visible}
        onDismiss={() => setVisible(false)}
        anchor={
          <TextInput
            mode="flat"
            placeholder="Select Gender"
            value={genderOptions.find(g => g.value === value)?.label || ''}
            editable={false}
            style={styles.input}
            contentStyle={{ backgroundColor: '#1f222a' }}
            theme={{ 
              colors: { 
                background: '#1f222a',
                primary: COLORS.primary,
              } 
            }}
            placeholderTextColor={COLORS.text}
            textColor={focused ? COLORS.text : COLORS.text}
            left={<TextInput.Icon icon="gender-male-female" color={focused ? COLORS.primary : COLORS.text} />}
            right={
              <TextInput.Icon 
                icon="menu-down" 
                color={focused ? COLORS.primary : COLORS.text} 
                onPress={handlePress}
                forceTextInputFocus={false}
              />
            }
            onPressIn={handlePress}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
          />
        }
        contentStyle={[
          styles.menuContent,
          { width: inputWidth }
        ]}
        theme={{
          colors: {
            surface: '#1A1A1A',
            onSurface: '#fff',
            elevation: {
              level2: '#1A1A1A'
            }
          }
        }}
      >
        {genderOptions.map(option => (
          <Menu.Item
            key={option.value}
            onPress={() => {
              onChange(option.value as FormData['gender']);
              setVisible(false);
            }}
            title={option.label}
            titleStyle={[
              styles.menuItemTitle,
              value === option.value && styles.menuItemTitleSelected
            ]}
            style={[
              styles.menuItem,
              value === option.value && styles.menuItemSelected
            ]}
          />
        ))}
      </Menu>
    </View>
  );
}

// Date Picker Component
function DOBPicker({ 
  date, 
  onChange,
  focused,
  onFocus
}: { 
  date: Date; 
  onChange: (date: Date) => void;
  focused: boolean;
  onFocus: () => void;
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [error, setError] = useState<string>('');
  const [inputWidth, setInputWidth] = useState(0);

  const handleDateChange = (selectedDate: Date) => {
    // Validate date
    const minDate = subYears(new Date(), 100); // 100 years ago
    const maxDate = subYears(new Date(), 13); // Must be at least 13 years old

    if (!isValid(selectedDate)) {
      setError('Please select a valid date');
      return;
    }

    if (isAfter(selectedDate, maxDate)) {
      setError('You must be at least 13 years old');
      return;
    }

    if (isBefore(selectedDate, minDate)) {
      setError('Please select a more recent date');
      return;
    }

    setError('');
    onChange(selectedDate);
    setPickerVisible(false);
  };

  const displayDate = isValid(date) ? format(date, 'dd MMM yyyy') : 'Select Date';

  const handlePress = () => {
    setPickerVisible(true);
    onFocus();
  };

  return (
    <View>
      <View 
        style={[styles.inputContainer, focused && styles.inputContainerFocused]}
        onLayout={e => setInputWidth(e.nativeEvent.layout.width)}
      >
        <TextInput
          mode="flat"
          placeholder="Date of Birth"
          value={displayDate}
          editable={false}
          style={styles.input}
          contentStyle={{ backgroundColor: '#1f222a' }}
          theme={{ 
            colors: { 
              background: '#1A1A1A',
              primary: COLORS.primary,
            } 
          }}
          placeholderTextColor={COLORS.text}
          textColor={focused ? COLORS.text : COLORS.text}
          left={<TextInput.Icon icon="calendar" color={focused ? COLORS.primary : COLORS.text} />}
          right={
            <TextInput.Icon 
              icon="menu-down" 
              color={focused ? COLORS.primary : COLORS.text} 
              onPress={handlePress}
              forceTextInputFocus={false}
            />
          }
          error={!!error}
          onPressIn={handlePress}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
        />

        <ThemedDatePicker
          visible={pickerVisible}
          date={isValid(date) ? date : new Date()}
          onCancel={() => setPickerVisible(false)}
          onConfirm={handleDateChange}
          maximumDate={subYears(new Date(), 13)}
          minimumDate={subYears(new Date(), 100)}
          width={inputWidth}
        />
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
    </View>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateUserMetadata, refreshUser } = useAuth();
  const { measurements, addMeasurement, refreshMeasurements } = useMeasurements();
  const [focusedInput, setFocusedInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [weightPickerVisible, setWeightPickerVisible] = useState(false);
  const [heightPickerVisible, setHeightPickerVisible] = useState(false);
  const [inputWidth, setInputWidth] = useState(0);
  
  // Use refs to track if the component has mounted to prevent unnecessary state updates
  const isMounted = useRef(false);
  
  const [weightUnit, setWeightUnit] = useState<'KG' | 'LB'>(
    user?.user_metadata?.preferred_weight_unit || 'KG'
  );
  const [heightUnit, setHeightUnit] = useState<'CM' | 'INCH'>(
    user?.user_metadata?.preferred_height_unit || 'CM'
  );

  const [formData, setFormData] = useState<FormData>({
    fullName: user?.user_metadata?.name || '',
    email: user?.email || '',
    dateOfBirth: user?.user_metadata?.dateOfBirth ? new Date(user.user_metadata.dateOfBirth) : new Date('1990-01-01'),
    gender: user?.user_metadata?.gender || '',
    weight: user?.user_metadata?.weight?.toString() || '',
    height: user?.user_metadata?.height?.toString() || ''
  });

  const safeGoBack = () => {
    router.push('/(tabs)/profile');
  };
  
  // Log when component mounts
  useEffect(() => {
    console.log('EditProfileScreen mounted');
    return () => {
      console.log('EditProfileScreen unmounted');
    };
  }, []);

  // Load user preferences when component mounts
  useEffect(() => {
    // Skip the first render to prevent double initialization
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    
    // Function to load all user data
    const loadUserData = async () => {
      if (!user) return;
      
      try {
        // Refresh measurements first
        await refreshMeasurements();
        
        // Load preferences
        const { data, error } = await supabase
          .from('user_profile_details')
          .select('preferred_weight_unit, preferred_height_unit, weight_kg, height_cm')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data) {
          setWeightUnit(data.preferred_weight_unit || 'KG');
          setHeightUnit(data.preferred_height_unit || 'CM');
          
          // Update form data with latest values from database
          setFormData(prev => ({
            ...prev,
            weight: data.weight_kg?.toString() || prev.weight,
            height: data.height_cm?.toString() || prev.height
          }));
        } else if (error) {
          console.error('Error loading user preferences:', error);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [user, refreshMeasurements]);

  useEffect(() => {
    if (measurements.WEIGHT) {
      setFormData(prev => ({
        ...prev,
        weight: measurements.WEIGHT?.value.toString() || ''
      }));
    }
  }, [measurements.WEIGHT]);

  const handleSave = async () => {
    try {
      setIsLoading(true);

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Update user metadata in auth
      await updateUserMetadata({
        name: formData.fullName,
        dateOfBirth: formData.dateOfBirth.toISOString().split('T')[0],
        gender: formData.gender,
        weight: parseFloat(formData.weight),
        height: parseFloat(formData.height)
      });

      // Update profile details
      const { error: profileError } = await supabase
        .rpc('upsert_profile_details', {
          p_user_id: user.id,
          p_date_of_birth: formData.dateOfBirth.toISOString().split('T')[0],
          p_gender: formData.gender,
          p_height_cm: parseFloat(formData.height),
          p_weight_kg: parseFloat(formData.weight)
        });

      if (profileError) {
        console.error('Error updating profile details:', profileError);
        throw profileError;
      }

      // Update unit preferences separately
      const { error: preferencesError } = await supabase
        .from('user_profile_details')
        .update({
          preferred_weight_unit: weightUnit,
          preferred_height_unit: heightUnit
        })
        .eq('user_id', user.id);

      if (preferencesError) {
        console.error('Error updating unit preferences:', preferencesError);
        throw preferencesError;
      }

      // Add weight and height measurements
      try {
        await addMeasurement('WEIGHT', parseFloat(formData.weight), 'kg');
        // Note: HEIGHT may not be a valid measurement category in your app
        // Uncomment if HEIGHT is a valid category
        // await addMeasurement('HEIGHT', parseFloat(formData.height), 'cm');
      } catch (measurementError) {
        console.error('Error adding measurements:', measurementError);
        // Continue even if measurement update fails
      }

      // Refresh user auth data and measurements
      await refreshUser();
      await refreshMeasurements();
      
      // Add a small delay before navigation to ensure state is updated
      setTimeout(() => {
        router.push('/(tabs)/profile');
      }, 300);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWeightChange = (value: number) => {
    // Only update local state, without database operations
    setFormData(prev => ({ ...prev, weight: value.toString() }));
    setWeightPickerVisible(false);
    setFocusedInput('');
  };

  const handleHeightChange = (value: number) => {
    // Value is already in CM from the picker
    setFormData(prev => ({ ...prev, height: value.toString() }));
    setHeightPickerVisible(false);
    setFocusedInput('');
  };

  const kgToLbs = (kg: number): number => {
    return kg * 2.20462;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
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
              <Text style={styles.title}>Edit Profile</Text>
            </View>
            <View style={styles.headerRight} />
          </View>
          <Divider style={styles.divider} />
          
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { flexGrow: 1, justifyContent: 'flex-end' }
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.inputContainer, focusedInput === 'fullName' && styles.inputContainerFocused]}>
              <TextInput
                mode="flat"
                placeholder="Full Name"
                value={formData.fullName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))}
                style={styles.input}
                contentStyle={{ backgroundColor: '#1f222a' }}
                theme={{ 
                  colors: { 
                    background: '#1A1A1A',
                    primary: COLORS.primary,
                  } 
                }}
                placeholderTextColor={COLORS.text}
                textColor={focusedInput === 'fullName' ? COLORS.text : COLORS.text}
                cursorColor={COLORS.primary}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                selectionColor="rgba(108, 71, 255, 0.3)"
                left={<TextInput.Icon icon="account" color={focusedInput === 'fullName' ? COLORS.primary : COLORS.text} />}
                onFocus={() => setFocusedInput('fullName')}
                onBlur={() => setFocusedInput('')}
              />
            </View>

            <View style={[styles.inputContainer, focusedInput === 'email' && styles.inputContainerFocused]}>
              <TextInput
                mode="flat"
                placeholder="Email"
                value={formData.email}
                editable={false}
                style={styles.input}
                contentStyle={{ backgroundColor: '#1f222a' }}
                theme={{ 
                  colors: { 
                    background: '#1A1A1A',
                    primary: COLORS.primary,
                  } 
                }}
                placeholderTextColor={COLORS.text}
                textColor={COLORS.text}
                cursorColor={COLORS.primary}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                selectionColor="rgba(108, 71, 255, 0.3)"
                left={<TextInput.Icon icon="email" color={COLORS.text} />}
              />
            </View>

            <GenderDropdown
              value={formData.gender}
              onChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
              focused={focusedInput === 'gender'}
              onFocus={() => setFocusedInput('gender')}
            />

            <View 
              style={[styles.inputContainer, focusedInput === 'weight' && styles.inputContainerFocused]}
              onLayout={e => setInputWidth(e.nativeEvent.layout.width)}
            >
              <TextInput
                mode="flat"
                placeholder={`Weight (${weightUnit.toLowerCase()})`}
                value={weightUnit === 'KG' ? 
                  formData.weight ? `${parseFloat(formData.weight).toFixed(1)} kg` : '' : 
                  formData.weight ? `${kgToLbs(parseFloat(formData.weight)).toFixed(1)} lb` : ''}
                editable={false}
                style={styles.input}
                contentStyle={{ backgroundColor: '#1f222a' }}
                theme={{ 
                  colors: { 
                    background: '#1A1A1A',
                    primary: COLORS.primary,
                  } 
                }}
                placeholderTextColor="#fff"
                textColor={focusedInput === 'weight' ? COLORS.text : COLORS.text}
                left={<TextInput.Icon icon="weight-kilogram" color={focusedInput === 'weight' ? COLORS.primary : COLORS.text} />}
                right={
                  <TextInput.Icon 
                    icon="menu-down" 
                    color={focusedInput === 'weight' ? COLORS.primary : COLORS.text} 
                    onPress={() => {
                      setWeightPickerVisible(true);
                      setFocusedInput('weight');
                    }}
                    forceTextInputFocus={false}
                  />
                }
                onPressIn={() => {
                  setWeightPickerVisible(true);
                  setFocusedInput('weight');
                }}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
              />

              <ThemedNumberPicker
                visible={weightPickerVisible}
                onCancel={() => {
                  setWeightPickerVisible(false);
                  setFocusedInput('');
                }}
                onConfirm={handleWeightChange}
                value={parseFloat(formData.weight) || 70}
                width={inputWidth}
                type="weight"
                onUnitChange={(unit) => setWeightUnit(unit as 'KG' | 'LB')}
                initialUnit={weightUnit}
              />
            </View>

            <View 
              style={[styles.inputContainer, focusedInput === 'height' && styles.inputContainerFocused]}
              onLayout={e => setInputWidth(e.nativeEvent.layout.width)}
            >
              <TextInput
                mode="flat"
                placeholder={`Height (${heightUnit.toLowerCase()})`}
                value={heightUnit === 'CM' ? 
                  formData.height ? `${parseFloat(formData.height).toFixed(1)} cm` : '' : 
                  formData.height ? `${(parseFloat(formData.height) / 2.54).toFixed(1)} in` : ''}
                editable={false}
                style={styles.input}
                contentStyle={{ backgroundColor: '#1f222a' }}
                theme={{ 
                  colors: { 
                    background: '#1A1A1A',
                    primary: '#6c47ff',
                  } 
                }}
                placeholderTextColor="#fff"
                textColor={focusedInput === 'height' ? COLORS.text : COLORS.text}
                left={<TextInput.Icon icon="human-male-height" color={focusedInput === 'height' ? COLORS.primary : COLORS.text} />}
                right={
                  <TextInput.Icon 
                    icon="menu-down" 
                    color={focusedInput === 'height' ? COLORS.primary : COLORS.text} 
                    onPress={() => {
                      setHeightPickerVisible(true);
                      setFocusedInput('height');
                    }}
                    forceTextInputFocus={false}
                  />
                }
                onPressIn={() => {
                  setHeightPickerVisible(true);
                  setFocusedInput('height');
                }}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
              />

              <ThemedNumberPicker
                visible={heightPickerVisible}
                onCancel={() => {
                  setHeightPickerVisible(false);
                  setFocusedInput('');
                }}
                onConfirm={handleHeightChange}
                value={parseFloat(formData.height) || 170}
                width={inputWidth}
                type="height"
                onUnitChange={(unit) => setHeightUnit(unit as 'CM' | 'INCH')}
                initialUnit={heightUnit}
              />
            </View>

            <DOBPicker
              date={formData.dateOfBirth}
              onChange={(date) => setFormData(prev => ({ ...prev, dateOfBirth: date }))}
              focused={focusedInput === 'dateOfBirth'}
              onFocus={() => setFocusedInput('dateOfBirth')}
            />

            <Pressable
              style={[styles.updateButton, isLoading && styles.updateButtonDisabled]}
              onPress={handleSave}
              disabled={isLoading}
            >
              <Text style={styles.updateButtonText}>
                {isLoading ? 'Updating...' : 'Update Profile'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  innerContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: SPACING.md,
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
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  inputContainer: {
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputContainerFocused: {
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  input: {
    backgroundColor: '#1f222a',
    overflow: "hidden",
    height: 56,
  },
  menuContent: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.xs,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.2)',
    minWidth: 360,
  },
  menuItem: {
    height: 48,
    maxWidth: '100%',
    paddingHorizontal: SPACING.lg,
  },
  menuItemSelected: {
    maxWidth: '100%',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
  },
  menuItemTitle: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '400',
  },
  menuItemTitleSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  updateButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: BORDER_RADIUS.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl * 2,
  },
  updateButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    color: '#ff4d4d',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  divider: {
    backgroundColor: COLORS.primary,
    height: 0.2,
  },
});
