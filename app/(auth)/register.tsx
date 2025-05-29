import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { TextInput, Text, Checkbox, HelperText } from 'react-native-paper';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useAuth } from '../store/AuthContext';
import { useNavigationDebounce } from '../hooks/useDebounce';

// Custom hook for form validation
function useFormValidation() {
  const [fieldErrors, setFieldErrors] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const validateInputs = (
    fullName: string,
    email: string,
    password: string,
    confirmPassword: string,
  ) => {
    const errors = {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    };

    if (!fullName.trim()) {
      errors.fullName = 'Full name is required';
    }
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!password.trim()) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password should be at least 6 characters';
    }
    if (!confirmPassword.trim()) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return !Object.values(errors).some((error) => error !== '');
  };

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  return { fieldErrors, validateInputs, clearFieldError };
}

// Custom hook for input handlers
function useInputHandlers(
  clearError: () => void,
  clearFieldError: (field: keyof ReturnType<typeof useFormValidation>['fieldErrors']) => void,
) {
  const createInputHandler = (setter: (value: string) => void, field: string) => {
    return (text: string) => {
      setter(text);
      clearFieldError(field as keyof ReturnType<typeof useFormValidation>['fieldErrors']);
      clearError();
    };
  };

  return { createInputHandler };
}

// Reusable Input Component
interface CustomInputProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: string;
  focusedInput: string;
  inputName: string;
  onFocus: (name: string) => void;
  onBlur: () => void;
  isLoading: boolean;
  secureTextEntry?: boolean;
  onTogglePassword?: () => void;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
  autoComplete?: 'name' | 'email' | 'new-password';
  textContentType?: 'name' | 'emailAddress' | 'newPassword';
  rightIcon?: string;
}

function CustomInput({
  placeholder,
  value,
  onChangeText,
  icon,
  focusedInput,
  inputName,
  onFocus,
  onBlur,
  isLoading,
  secureTextEntry = false,
  onTogglePassword,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  rightIcon,
}: CustomInputProps) {
  const isFocused = focusedInput === inputName;
  return (
    <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
      <TextInput
        mode="flat"
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        textContentType={textContentType}
        secureTextEntry={secureTextEntry}
        importantForAutofill="yes"
        style={styles.input}
        contentStyle={{ backgroundColor: '#1f222a' }}
        theme={{
          colors: {
            background: '#1A1A1A',
            primary: COLORS.primary,
          },
        }}
        placeholderTextColor={isFocused ? COLORS.primary : '#fff'}
        textColor={isFocused ? '#fff' : '#666'}
        cursorColor={COLORS.primary}
        underlineColor="transparent"
        activeUnderlineColor={COLORS.primary}
        selectionColor="rgba(108, 71, 255, 0.3)"
        left={<TextInput.Icon icon={icon} color={isFocused ? COLORS.primary : '#fff'} />}
        right={
          rightIcon ? (
            <TextInput.Icon
              icon={rightIcon}
              color={isFocused ? COLORS.primary : '#fff'}
              onPress={onTogglePassword}
            />
          ) : undefined
        }
        onFocus={() => onFocus(inputName)}
        onBlur={onBlur}
        disabled={isLoading}
      />
    </View>
  );
}

// Social Buttons Component
function SocialButtons() {
  return (
    <View style={styles.socialButtons}>
      <Pressable style={styles.socialButton}>
        <Ionicons name="logo-facebook" size={24} color="white" />
      </Pressable>
      <Pressable style={styles.socialButton}>
        <Ionicons name="logo-google" size={24} color="white" />
      </Pressable>
      <Pressable style={styles.socialButton}>
        <Ionicons name="logo-apple" size={24} color="white" />
      </Pressable>
    </View>
  );
}

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState('');

  const isMountedRef = useRef(true);
  const { signUp, isLoading, error, clearError } = useAuth();
  const { fieldErrors, validateInputs, clearFieldError } = useFormValidation();
  const { createInputHandler } = useInputHandlers(clearError, clearFieldError);
  const debouncedNavigate = useNavigationDebounce();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Clear errors when inputs change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && error) {
        clearError();
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [email, password, fullName, confirmPassword, error, clearError]);

  const handleRegister = async () => {
    clearError();
    if (!validateInputs(fullName, email, password, confirmPassword)) return;

    try {
      await signUp(email, password, fullName, rememberMe);
    } catch (err) {
      console.error('Registration error:', err);
    }
  };

  const handleBackNavigation = () => {
    debouncedNavigate(() => router.back());
  };

  const handleSignInNavigation = () => {
    if (!isLoading) {
      debouncedNavigate(() => router.push('/(auth)/login'));
    }
  };

  const handleEmailChange = createInputHandler(setEmail, 'email');
  const handlePasswordChange = createInputHandler(setPassword, 'password');
  const handleConfirmPasswordChange = createInputHandler(setConfirmPassword, 'confirmPassword');
  const handleFullNameChange = createInputHandler(setFullName, 'fullName');

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.content}>
          <Pressable onPress={handleBackNavigation} style={styles.backButton}>
            <Ionicons name="arrow-back" size={30} color="white" />
          </Pressable>

          <Text variant="displaySmall" style={styles.title}>
            Create your{'\n'}Account
          </Text>

          <View style={styles.form}>
            <CustomInput
              placeholder="Full Name"
              value={fullName}
              onChangeText={handleFullNameChange}
              icon="account"
              focusedInput={focusedInput}
              inputName="fullName"
              onFocus={setFocusedInput}
              onBlur={() => setFocusedInput('')}
              isLoading={isLoading}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
            {fieldErrors.fullName ? (
              <HelperText type="error" style={styles.errorText}>
                {fieldErrors.fullName}
              </HelperText>
            ) : null}

            <CustomInput
              placeholder="Email"
              value={email}
              onChangeText={handleEmailChange}
              icon="email"
              focusedInput={focusedInput}
              inputName="email"
              onFocus={setFocusedInput}
              onBlur={() => setFocusedInput('')}
              isLoading={isLoading}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            {fieldErrors.email ? (
              <HelperText type="error" style={styles.errorText}>
                {fieldErrors.email}
              </HelperText>
            ) : null}

            <CustomInput
              placeholder="Password"
              value={password}
              onChangeText={handlePasswordChange}
              icon="lock"
              focusedInput={focusedInput}
              inputName="password"
              onFocus={setFocusedInput}
              onBlur={() => setFocusedInput('')}
              isLoading={isLoading}
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? 'eye-off' : 'eye'}
              onTogglePassword={() => setShowPassword(!showPassword)}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {fieldErrors.password ? (
              <HelperText type="error" style={styles.errorText}>
                {fieldErrors.password}
              </HelperText>
            ) : null}

            <CustomInput
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              icon="lock-check"
              focusedInput={focusedInput}
              inputName="confirmPassword"
              onFocus={setFocusedInput}
              onBlur={() => setFocusedInput('')}
              isLoading={isLoading}
              secureTextEntry={!showConfirmPassword}
              rightIcon={showConfirmPassword ? 'eye-off' : 'eye'}
              onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {fieldErrors.confirmPassword ? (
              <HelperText type="error" style={styles.errorText}>
                {fieldErrors.confirmPassword}
              </HelperText>
            ) : null}

            {error && (
              <HelperText type="error" style={styles.errorText}>
                {error.message}
              </HelperText>
            )}

            <View style={styles.rememberContainer}>
              <View style={styles.checkboxContainer}>
                <Checkbox.Android
                  status={rememberMe ? 'checked' : 'unchecked'}
                  onPress={() => setRememberMe(!rememberMe)}
                  color={COLORS.primary}
                  uncheckedColor={COLORS.primary}
                />
                <Text style={styles.rememberText}>Remember me</Text>
              </View>
            </View>

            <Pressable
              style={[styles.signUpButton, isLoading && styles.signUpButtonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              <Text style={styles.signUpButtonText}>Sign up</Text>
            </Pressable>

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.divider} />
            </View>

            <SocialButtons />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Pressable onPress={handleSignInNavigation} disabled={isLoading}>
                <Text style={styles.signInText}>Sign in</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.xxl,
    paddingTop: SPACING.xxl * 2,
  },
  backButton: {
    width: 50,
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: COLORS.text,
    marginBottom: SPACING.xl,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#1f222a',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputContainerFocused: {
    borderColor: '#6c47ff',
    borderWidth: 1,
  },
  input: {
    backgroundColor: '#1f222a',
    overflow: 'hidden',
    height: 56,
  },
  rememberContainer: {
    marginBottom: SPACING.xl,
    alignItems: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberText: {
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  signUpButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: BORDER_RADIUS.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#333333',
  },
  dividerText: {
    color: COLORS.text,
    marginHorizontal: SPACING.md,
    opacity: 0.7,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginBottom: 20,
  },
  socialButton: {
    width: 56,
    height: 56,
    backgroundColor: '#1f222a',
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.text,
    opacity: 0.7,
    marginRight: SPACING.xs,
  },
  signInText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  errorText: {
    marginTop: -25,
    marginBottom: 4,
    marginLeft: 4,
  },
});
