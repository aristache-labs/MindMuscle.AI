import { format, isAfter, isBefore, isValid, subYears } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { IconButton, Menu, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedDatePicker } from '../components/ThemedDatePicker';
import { ThemedNumberPicker } from '../components/ThemedNumberPicker';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import supabase from '../services/supabase';
import { validationService } from '../services/validationService';
import { useAuth, UserProfile } from '../store/AuthContext';
import { useMeasurements } from '../store/MeasurementsContext';
import { logger } from '../utils/logger';
import { ProfileUpdateSchema } from '../validation/schemas';

// Define types for form data
interface FormData {
  fullName: string;
  email: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other' | '';
  weight: string;
  height: string;
}

// Helper function to safely get user metadata values
function getUserMetadataValue<T>(user: UserProfile | null, key: string, defaultValue: T): T {
  if (!user?.user_metadata) return defaultValue;
  const value = user.user_metadata[key];
  return value !== undefined && value !== null ? (value as T) : defaultValue;
}

const genderOptions = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

// Custom hook for form data management
function useFormData(user: UserProfile | null) {
  const [formData, setFormData] = useState<FormData>({
    fullName: getUserMetadataValue(user, 'name', ''),
    email: user?.email || '',
    dateOfBirth: getUserMetadataValue(user, 'dateOfBirth', null)
      ? new Date(getUserMetadataValue(user, 'dateOfBirth', ''))
      : new Date('1990-01-01'),
    gender: getUserMetadataValue(user, 'gender', '') as FormData['gender'],
    weight: getUserMetadataValue(user, 'weight', 0).toString() || '',
    height: getUserMetadataValue(user, 'height', 0).toString() || '',
  });

  return { formData, setFormData };
}

// Custom hook for unit preferences
function useUnitPreferences(user: UserProfile | null) {
  const [weightUnit, setWeightUnit] = useState<'KG' | 'LB'>(
    getUserMetadataValue(user, 'preferred_weight_unit', 'KG') as 'KG' | 'LB',
  );
  const [heightUnit, setHeightUnit] = useState<'CM' | 'INCH'>(
    getUserMetadataValue(user, 'preferred_height_unit', 'CM') as 'CM' | 'INCH',
  );

  return { weightUnit, setWeightUnit, heightUnit, setHeightUnit };
}

// Custom hook for UI state management
function useUIState() {
  const [focusedInput, setFocusedInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [weightPickerVisible, setWeightPickerVisible] = useState(false);
  const [heightPickerVisible, setHeightPickerVisible] = useState(false);
  const [inputWidth, setInputWidth] = useState(0);

  return {
    focusedInput,
    setFocusedInput,
    isLoading,
    setIsLoading,
    weightPickerVisible,
    setWeightPickerVisible,
    heightPickerVisible,
    setHeightPickerVisible,
    inputWidth,
    setInputWidth,
  };
}

// Custom hook for data loading
function useDataLoading(user: UserProfile | null, refreshMeasurements: () => Promise<void>) {
  const isMounted = useRef(false);

  useEffect(() => {
    console.log('EditProfileScreen mounted');
    return () => {
      console.log('EditProfileScreen unmounted');
    };
  }, []);

  const loadUserData = async (
    setWeightUnit: (unit: 'KG' | 'LB') => void,
    setHeightUnit: (unit: 'CM' | 'INCH') => void,
    setFormData: React.Dispatch<React.SetStateAction<FormData>>,
  ) => {
    if (!user) return;

    try {
      await refreshMeasurements();

      const { data, error } = await supabase
        .from('user_profile_details')
        .select('preferred_weight_unit, preferred_height_unit, weight_kg, height_cm')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setWeightUnit(data.preferred_weight_unit || 'KG');
        setHeightUnit(data.preferred_height_unit || 'CM');

        setFormData((prev) => ({
          ...prev,
          weight: data.weight_kg?.toString() || prev.weight,
          height: data.height_cm?.toString() || prev.height,
        }));
      } else if (error) {
        console.error('Error loading user preferences:', error);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  return { isMounted, loadUserData };
}

// Custom hook for save functionality
function useSaveProfile() {
  const { user, updateUserMetadata, refreshUser } = useAuth();
  const { addMeasurement, refreshMeasurements } = useMeasurements();
  const router = useRouter();

  const handleSave = async (
    formData: FormData,
    weightUnit: 'KG' | 'LB',
    heightUnit: 'CM' | 'INCH',
    setIsLoading: (loading: boolean) => void,
  ) => {
    try {
      setIsLoading(true);

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Validate form data before processing
      const profileUpdateData = {
        full_name: formData.fullName,
        avatar_url: undefined, // Optional field
        preferences: {
          preferred_weight_unit: weightUnit,
          preferred_height_unit: heightUnit,
        },
      };

      const validationResult = validationService.validateWithSchema(
        ProfileUpdateSchema,
        profileUpdateData,
        'profile update',
      );

      if (!validationResult.success) {
        const errorMessage = `Profile validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
        logger.error('Profile update validation failed', new Error(errorMessage), {
          context: { profileUpdateData, errors: validationResult.errors },
        });
        throw new Error(errorMessage);
      }

      // Validate user preferences separately
      const preferencesData = {
        preferred_weight_unit: weightUnit,
        preferred_height_unit: heightUnit,
        notifications_enabled: true, // Default values for validation
        workout_reminders: true,
        dark_theme: true,
        sound_enabled: true,
      };

      const preferencesValidationResult =
        validationService.validateUserPreferences(preferencesData);

      if (!preferencesValidationResult.success) {
        const errorMessage = `Preferences validation failed: ${preferencesValidationResult.errors.map((e) => e.message).join(', ')}`;
        logger.error('Preferences validation failed', new Error(errorMessage), {
          context: { preferencesData, errors: preferencesValidationResult.errors },
        });
        throw new Error(errorMessage);
      }

      // Validate numeric values
      if (isNaN(parseFloat(formData.weight)) || parseFloat(formData.weight) <= 0) {
        throw new Error('Please enter a valid weight');
      }

      if (isNaN(parseFloat(formData.height)) || parseFloat(formData.height) <= 0) {
        throw new Error('Please enter a valid height');
      }

      // Validate date of birth
      if (!isValid(formData.dateOfBirth)) {
        throw new Error('Please select a valid date of birth');
      }

      const minDate = subYears(new Date(), 100);
      const maxDate = subYears(new Date(), 13);

      if (isAfter(formData.dateOfBirth, maxDate)) {
        throw new Error('You must be at least 13 years old');
      }

      if (isBefore(formData.dateOfBirth, minDate)) {
        throw new Error('Please select a more recent date');
      }

      await updateUserMetadata({
        name: formData.fullName,
        dateOfBirth: formData.dateOfBirth.toISOString().split('T')[0],
        gender: formData.gender,
        weight: parseFloat(formData.weight),
        height: parseFloat(formData.height),
      });

      const { error: profileError } = await supabase.rpc('upsert_profile_details', {
        p_user_id: user.id,
        p_date_of_birth: formData.dateOfBirth.toISOString().split('T')[0],
        p_gender: formData.gender,
        p_height_cm: parseFloat(formData.height),
        p_weight_kg: parseFloat(formData.weight),
      });

      if (profileError) {
        console.error('Error updating profile details:', profileError);
        throw profileError;
      }

      const { error: preferencesError } = await supabase
        .from('user_profile_details')
        .update({
          preferred_weight_unit: weightUnit,
          preferred_height_unit: heightUnit,
        })
        .eq('user_id', user.id);

      if (preferencesError) {
        console.error('Error updating unit preferences:', preferencesError);
        throw preferencesError;
      }

      try {
        await addMeasurement('WEIGHT', parseFloat(formData.weight), 'kg');
      } catch (measurementError) {
        console.error('Error adding measurements:', measurementError);
      }

      await refreshUser();
      await refreshMeasurements();

      setTimeout(() => {
        router.push('/(tabs)/profile');
      }, 300);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { handleSave };
}

// Gender Dropdown Component
function GenderDropdown({
  value,
  onChange,
  focused,
  onFocus,
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
      onLayout={(e) => setInputWidth(e.nativeEvent.layout.width)}
    >
      <Menu
        visible={visible}
        onDismiss={() => setVisible(false)}
        anchor={
          <TextInput
            mode="flat"
            placeholder="Select Gender"
            value={genderOptions.find((g) => g.value === value)?.label || ''}
            editable={false}
            style={styles.input}
            contentStyle={{ backgroundColor: '#1f222a' }}
            theme={{
              colors: {
                background: '#1f222a',
                primary: COLORS.primary,
              },
            }}
            placeholderTextColor={COLORS.text}
            textColor={focused ? COLORS.text : COLORS.text}
            left={
              <TextInput.Icon
                icon="gender-male-female"
                color={focused ? COLORS.primary : COLORS.text}
              />
            }
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
        contentStyle={[styles.menuContent, { width: inputWidth }]}
        theme={{
          colors: {
            surface: '#1A1A1A',
            onSurface: '#fff',
            elevation: {
              level2: '#1A1A1A',
            },
          },
        }}
      >
        {genderOptions.map((option) => (
          <Menu.Item
            key={option.value}
            onPress={() => {
              onChange(option.value as FormData['gender']);
              setVisible(false);
            }}
            title={option.label}
            titleStyle={[
              styles.menuItemTitle,
              value === option.value && styles.menuItemTitleSelected,
            ]}
            style={[styles.menuItem, value === option.value && styles.menuItemSelected]}
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
  onFocus,
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
    const minDate = subYears(new Date(), 100);
    const maxDate = subYears(new Date(), 13);

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
        onLayout={(e) => setInputWidth(e.nativeEvent.layout.width)}
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
            },
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
          onPressIn={handlePress}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
        />

        <ThemedDatePicker
          visible={pickerVisible}
          onCancel={() => {
            setPickerVisible(false);
          }}
          onConfirm={handleDateChange}
          date={date}
          width={inputWidth}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// Weight Input Component
function WeightInput({
  formData,
  weightUnit,
  focusedInput,
  setFocusedInput,
  weightPickerVisible,
  setWeightPickerVisible,
  inputWidth,
  setInputWidth,
  onWeightChange,
  onUnitChange,
}: {
  formData: FormData;
  weightUnit: 'KG' | 'LB';
  focusedInput: string;
  setFocusedInput: (input: string) => void;
  weightPickerVisible: boolean;
  setWeightPickerVisible: (visible: boolean) => void;
  inputWidth: number;
  setInputWidth: (width: number) => void;
  onWeightChange: (value: number) => void;
  onUnitChange: (unit: 'KG' | 'LB') => void;
}) {
  const kgToLbs = (kg: number): number => kg * 2.20462;

  const handlePress = () => {
    setWeightPickerVisible(true);
    setFocusedInput('weight');
  };

  return (
    <View
      style={[styles.inputContainer, focusedInput === 'weight' && styles.inputContainerFocused]}
      onLayout={(e) => setInputWidth(e.nativeEvent.layout.width)}
    >
      <TextInput
        mode="flat"
        placeholder={`Weight (${weightUnit.toLowerCase()})`}
        value={
          weightUnit === 'KG'
            ? formData.weight
              ? `${parseFloat(formData.weight).toFixed(1)} kg`
              : ''
            : formData.weight
              ? `${kgToLbs(parseFloat(formData.weight)).toFixed(1)} lb`
              : ''
        }
        editable={false}
        style={styles.input}
        contentStyle={{ backgroundColor: '#1f222a' }}
        theme={{
          colors: {
            background: '#1A1A1A',
            primary: COLORS.primary,
          },
        }}
        placeholderTextColor="#fff"
        textColor={focusedInput === 'weight' ? COLORS.text : COLORS.text}
        left={
          <TextInput.Icon
            icon="weight-kilogram"
            color={focusedInput === 'weight' ? COLORS.primary : COLORS.text}
          />
        }
        right={
          <TextInput.Icon
            icon="menu-down"
            color={focusedInput === 'weight' ? COLORS.primary : COLORS.text}
            onPress={handlePress}
            forceTextInputFocus={false}
          />
        }
        onPressIn={handlePress}
        underlineColor="transparent"
        activeUnderlineColor="transparent"
      />

      <ThemedNumberPicker
        visible={weightPickerVisible}
        onCancel={() => {
          setWeightPickerVisible(false);
          setFocusedInput('');
        }}
        onConfirm={onWeightChange}
        value={parseFloat(formData.weight) || 70}
        width={inputWidth}
        type="weight"
        onUnitChange={(unit) => onUnitChange(unit as 'KG' | 'LB')}
        initialUnit={weightUnit}
      />
    </View>
  );
}

// Height Input Component
function HeightInput({
  formData,
  heightUnit,
  focusedInput,
  setFocusedInput,
  heightPickerVisible,
  setHeightPickerVisible,
  inputWidth,
  setInputWidth,
  onHeightChange,
  onUnitChange,
}: {
  formData: FormData;
  heightUnit: 'CM' | 'INCH';
  focusedInput: string;
  setFocusedInput: (input: string) => void;
  heightPickerVisible: boolean;
  setHeightPickerVisible: (visible: boolean) => void;
  inputWidth: number;
  setInputWidth: (width: number) => void;
  onHeightChange: (value: number) => void;
  onUnitChange: (unit: 'CM' | 'INCH') => void;
}) {
  const handlePress = () => {
    setHeightPickerVisible(true);
    setFocusedInput('height');
  };

  return (
    <View
      style={[styles.inputContainer, focusedInput === 'height' && styles.inputContainerFocused]}
      onLayout={(e) => setInputWidth(e.nativeEvent.layout.width)}
    >
      <TextInput
        mode="flat"
        placeholder={`Height (${heightUnit.toLowerCase()})`}
        value={
          heightUnit === 'CM'
            ? formData.height
              ? `${parseFloat(formData.height).toFixed(1)} cm`
              : ''
            : formData.height
              ? `${(parseFloat(formData.height) / 2.54).toFixed(1)} in`
              : ''
        }
        editable={false}
        style={styles.input}
        contentStyle={{ backgroundColor: '#1f222a' }}
        theme={{
          colors: {
            background: '#1A1A1A',
            primary: '#6c47ff',
          },
        }}
        placeholderTextColor="#fff"
        textColor={focusedInput === 'height' ? COLORS.text : COLORS.text}
        left={
          <TextInput.Icon
            icon="human-male-height"
            color={focusedInput === 'height' ? COLORS.primary : COLORS.text}
          />
        }
        right={
          <TextInput.Icon
            icon="menu-down"
            color={focusedInput === 'height' ? COLORS.primary : COLORS.text}
            onPress={handlePress}
            forceTextInputFocus={false}
          />
        }
        onPressIn={handlePress}
        underlineColor="transparent"
        activeUnderlineColor="transparent"
      />

      <ThemedNumberPicker
        visible={heightPickerVisible}
        onCancel={() => {
          setHeightPickerVisible(false);
          setFocusedInput('');
        }}
        onConfirm={onHeightChange}
        value={parseFloat(formData.height) || 170}
        width={inputWidth}
        type="height"
        onUnitChange={(unit) => onUnitChange(unit as 'CM' | 'INCH')}
        initialUnit={heightUnit}
      />
    </View>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { measurements, refreshMeasurements } = useMeasurements();

  const { formData, setFormData } = useFormData(user);
  const { weightUnit, setWeightUnit, heightUnit, setHeightUnit } = useUnitPreferences(user);
  const {
    focusedInput,
    setFocusedInput,
    isLoading,
    setIsLoading,
    weightPickerVisible,
    setWeightPickerVisible,
    heightPickerVisible,
    setHeightPickerVisible,
    inputWidth,
    setInputWidth,
  } = useUIState();
  const { isMounted, loadUserData } = useDataLoading(user, refreshMeasurements);
  const { handleSave } = useSaveProfile();

  const safeGoBack = () => {
    router.push('/(tabs)/profile');
  };

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    loadUserData(setWeightUnit, setHeightUnit, setFormData);
  }, [user, refreshMeasurements]);

  useEffect(() => {
    if (measurements.WEIGHT) {
      setFormData((prev) => ({
        ...prev,
        weight: measurements.WEIGHT?.value.toString() || '',
      }));
    }
  }, [measurements.WEIGHT]);

  const handleWeightChange = (value: number) => {
    setFormData((prev) => ({ ...prev, weight: value.toString() }));
    setWeightPickerVisible(false);
    setFocusedInput('');
  };

  const handleHeightChange = (value: number) => {
    setFormData((prev) => ({ ...prev, height: value.toString() }));
    setHeightPickerVisible(false);
    setFocusedInput('');
  };

  const onSave = () => {
    handleSave(formData, weightUnit, heightUnit, setIsLoading);
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
              />
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>Edit Profile</Text>
            </View>
            <View style={styles.headerRight} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.inputContainer,
                focusedInput === 'fullName' && styles.inputContainerFocused,
              ]}
            >
              <TextInput
                mode="flat"
                placeholder="Full Name"
                value={formData.fullName}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, fullName: text }))}
                style={styles.input}
                contentStyle={{ backgroundColor: '#1f222a' }}
                theme={{
                  colors: {
                    background: '#1A1A1A',
                    primary: COLORS.primary,
                  },
                }}
                placeholderTextColor={COLORS.text}
                textColor={focusedInput === 'fullName' ? COLORS.text : COLORS.text}
                cursorColor={COLORS.primary}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                selectionColor="rgba(108, 71, 255, 0.3)"
                left={
                  <TextInput.Icon
                    icon="account"
                    color={focusedInput === 'fullName' ? COLORS.primary : COLORS.text}
                  />
                }
                onFocus={() => setFocusedInput('fullName')}
                onBlur={() => setFocusedInput('')}
              />
            </View>

            <View
              style={[
                styles.inputContainer,
                focusedInput === 'email' && styles.inputContainerFocused,
              ]}
            >
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
                  },
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
              onChange={(value) => setFormData((prev) => ({ ...prev, gender: value }))}
              focused={focusedInput === 'gender'}
              onFocus={() => setFocusedInput('gender')}
            />

            <WeightInput
              formData={formData}
              weightUnit={weightUnit}
              focusedInput={focusedInput}
              setFocusedInput={setFocusedInput}
              weightPickerVisible={weightPickerVisible}
              setWeightPickerVisible={setWeightPickerVisible}
              inputWidth={inputWidth}
              setInputWidth={setInputWidth}
              onWeightChange={handleWeightChange}
              onUnitChange={setWeightUnit}
            />

            <HeightInput
              formData={formData}
              heightUnit={heightUnit}
              focusedInput={focusedInput}
              setFocusedInput={setFocusedInput}
              heightPickerVisible={heightPickerVisible}
              setHeightPickerVisible={setHeightPickerVisible}
              inputWidth={inputWidth}
              setInputWidth={setInputWidth}
              onHeightChange={handleHeightChange}
              onUnitChange={setHeightUnit}
            />

            <DOBPicker
              date={formData.dateOfBirth}
              onChange={(date) => setFormData((prev) => ({ ...prev, dateOfBirth: date }))}
              focused={focusedInput === 'dateOfBirth'}
              onFocus={() => setFocusedInput('dateOfBirth')}
            />

            <Pressable
              style={[styles.updateButton, isLoading && styles.updateButtonDisabled]}
              onPress={onSave}
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
    overflow: 'hidden',
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
