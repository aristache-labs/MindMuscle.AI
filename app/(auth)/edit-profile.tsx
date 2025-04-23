import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, ScrollView, Platform, Pressable, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Text, TextInput, IconButton, Menu } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../store/AuthContext';
import { format, isValid, subYears, isAfter, isBefore } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../services/supabase';
import { ThemedDatePicker } from '../components/ThemedDatePicker';
import { ThemedNumberPicker } from '../components/ThemedNumberPicker';
import { useSwipeNavigation } from '../hooks/useSwipeGesture';

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
                primary: '#6c47ff',
              } 
            }}
            placeholderTextColor="#666"
            textColor={focused ? '#fff' : '#666'}
            left={<TextInput.Icon icon="gender-male-female" color={focused ? '#6c47ff' : '#666'} />}
            right={
              <TextInput.Icon 
                icon="menu-down" 
                color={focused ? '#6c47ff' : '#666'} 
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
              primary: '#6c47ff',
            } 
          }}
          placeholderTextColor="#666"
          textColor={focused ? '#fff' : '#666'}
          left={<TextInput.Icon icon="calendar" color={focused ? '#6c47ff' : '#666'} />}
          right={
            <TextInput.Icon 
              icon="menu-down" 
              color={focused ? '#6c47ff' : '#666'} 
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

  // Setup swipe navigation with the target route
  const { SwipeBackContainer, goBack } = useSwipeNavigation('/(tabs)/profile');
  
  // Add safe back navigation with error handling
  const safeGoBack = () => {
    try {
      console.log("Back button pressed manually");
      goBack();
    } catch (error) {
      console.error('Error during back navigation:', error);
      // Fallback navigation if the swipe gesture fails
      router.push('/(tabs)/profile');
    }
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
    
    const loadUserPreferences = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_profile_details')
          .select('preferred_weight_unit, preferred_height_unit')
          .eq('user_id', user.id)
          .single();

        if (!error && data) {
          setWeightUnit(data.preferred_weight_unit || 'KG');
          setHeightUnit(data.preferred_height_unit || 'CM');
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
      }
    };

    loadUserPreferences();
  }, [user]);

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

      await refreshUser();
      
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
    // Value is already in KG from the picker
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
    <SwipeBackContainer>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={[styles.content, { paddingTop: insets.top }]}>
            <Pressable 
              onPress={safeGoBack} 
              style={styles.backButton}
            >
              <Ionicons name="arrow-back-circle-sharp" size={50} color="white" />
            </Pressable>

            <Text variant="displaySmall" style={styles.title}>
              Edit Profile
            </Text>

            <ScrollView 
              style={styles.form} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
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
                      primary: '#6c47ff',
                    } 
                  }}
                  placeholderTextColor="#666"
                  textColor={focusedInput === 'fullName' ? '#fff' : '#666'}
                  cursorColor="#6c47ff"
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  selectionColor="rgba(108, 71, 255, 0.3)"
                  left={<TextInput.Icon icon="account" color={focusedInput === 'fullName' ? '#6c47ff' : '#666'} />}
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
                      primary: '#6c47ff',
                    } 
                  }}
                  placeholderTextColor="#666"
                  textColor="#666"
                  cursorColor="#6c47ff"
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  selectionColor="rgba(108, 71, 255, 0.3)"
                  left={<TextInput.Icon icon="email" color="#666" />}
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
                      primary: '#6c47ff',
                    } 
                  }}
                  placeholderTextColor="#666"
                  textColor={focusedInput === 'weight' ? '#fff' : '#666'}
                  left={<TextInput.Icon icon="weight-kilogram" color={focusedInput === 'weight' ? '#6c47ff' : '#666'} />}
                  right={
                    <TextInput.Icon 
                      icon="menu-down" 
                      color={focusedInput === 'weight' ? '#6c47ff' : '#666'} 
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
                  placeholderTextColor="#666"
                  textColor={focusedInput === 'height' ? '#fff' : '#666'}
                  left={<TextInput.Icon icon="human-male-height" color={focusedInput === 'height' ? '#6c47ff' : '#666'} />}
                  right={
                    <TextInput.Icon 
                      icon="menu-down" 
                      color={focusedInput === 'height' ? '#6c47ff' : '#666'} 
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
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  backButton: {
    marginTop: SPACING.md,
    alignSelf: 'flex-start',
  },
  title: {
    color: '#fff',
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl * 1.5,
    fontWeight: '600',
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#1f222a',
  },
  inputContainerFocused: {
    borderWidth: 1,
    borderColor: '#6c47ff',
  },
  input: {
    backgroundColor: '#1f222a',
    height: 56,
  },
  updateButton: {
    backgroundColor: '#6c47ff',
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl * 2,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  inputLabel: {
    color: '#666',
    marginBottom: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  pickerContainer: {
    backgroundColor: '#1f222a',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  picker: {
    backgroundColor: '#1f222a',
    color: '#fff',
    height: 50,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1f222a',
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    paddingBottom: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  genderList: {
    paddingHorizontal: SPACING.lg,
  },
  genderOption: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  genderOptionSelected: {
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
  },
  genderOptionText: {
    color: '#fff',
    fontSize: 16,
  },
  genderOptionTextSelected: {
    color: '#6c47ff',
    fontWeight: '600',
  },
  menuWrapper: {
    marginTop: -SPACING.xs,
  },
  menuContent: {
    backgroundColor: '#1f222a',
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.xs,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.2)',
    minWidth: 360,
    ...Platform.select({
      ios: {
        shadowColor: '#6c47ff',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  menuItem: {
    height: 48,
    paddingHorizontal: SPACING.lg,
  },
  menuItemSelected: {
    minWidth: 360,
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
  },
  menuItemTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '400',
  },
  menuItemTitleSelected: {
    color: '#6c47ff',
    fontWeight: '600',
  },
  errorText: {
    color: '#ff4d4d',
    fontSize: 12,
    marginTop: -SPACING.md,
    marginBottom: SPACING.md,
    marginLeft: SPACING.sm,
  },
});
