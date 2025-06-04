import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput as RNTextInput,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import secureStorage from '../utils/secureStorage';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import { useNavigationDebounce } from '../hooks/useDebounce';
import { useAuth } from '../store/AuthContext';

// Keys for secure storage
const SAVED_EMAIL_KEY = 'mindmuscle_saved_email';
const SAVED_PASSWORD_KEY = 'mindmuscle_saved_password';
const REMEMBER_ME_KEY = 'mindmuscle_remember_me';

// Custom hook for credential management
function useCredentialManagement() {
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);

  const loadSavedCredentials = async (
    setEmail: (email: string) => void,
    setPassword: (password: string) => void,
    setRememberMe: (remember: boolean) => void,
  ) => {
    // Prevent multiple simultaneous loads
    if (isLoadingCredentials) return;
    try {
      setIsLoadingCredentials(true);

      const credentialsPromise = (async () => {
        const savedRememberMe = await secureStorage.getItemAsync(REMEMBER_ME_KEY);
        const shouldRemember = savedRememberMe === 'true';
        setRememberMe(shouldRemember);

        if (shouldRemember) {
          const [savedEmail, savedPassword] = await Promise.all([
            secureStorage.getItemAsync(SAVED_EMAIL_KEY),
            secureStorage.getItemAsync(SAVED_PASSWORD_KEY),
          ]);

          if (savedEmail) setEmail(savedEmail);
          if (savedPassword) setPassword(savedPassword);
        }
      })();

      await Promise.race([
        credentialsPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Credential loading timeout')), 2000),
        ),
      ]);
    } catch (error) {
      console.error('Error loading saved credentials:', error);
    } finally {
      setIsLoadingCredentials(false);
    }
  };

  const saveCredentials = async (email: string, password: string, remember: boolean) => {
    try {
      await secureStorage.setItemAsync(REMEMBER_ME_KEY, remember.toString());

      if (remember) {
        await Promise.all([
          secureStorage.setItemAsync(SAVED_EMAIL_KEY, email),
          secureStorage.setItemAsync(SAVED_PASSWORD_KEY, password),
        ]);
      } else {
        await Promise.all([
          secureStorage.deleteItemAsync(SAVED_EMAIL_KEY).catch(() => {}),
          secureStorage.deleteItemAsync(SAVED_PASSWORD_KEY).catch(() => {}),
        ]);
      }
    } catch (error) {
      console.error('Error saving credentials:', error);
    }
  };

  const clearSavedCredentials = async () => {
    try {
      await Promise.all([
        secureStorage.deleteItemAsync(SAVED_EMAIL_KEY).catch(() => {}),
        secureStorage.deleteItemAsync(SAVED_PASSWORD_KEY).catch(() => {}),
        secureStorage.deleteItemAsync(REMEMBER_ME_KEY).catch(() => {}),
      ]);
    } catch (error) {
      console.error('Error clearing saved credentials:', error);
    }
  };

  return {
    isLoadingCredentials,
    loadSavedCredentials,
    saveCredentials,
    clearSavedCredentials,
  };
}

// Import validation service
import { validationService } from '../services/validationService';

// Custom hook for form validation
function useFormValidation() {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateInputs = (email: string, password: string) => {
    const formData = { email, password };
    const validationResult = validationService.validateLoginForm(formData);

    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      validationResult.errors.forEach((error) => {
        errors[error.field] = error.message;
      });
      setValidationErrors(errors);
      return false;
    }

    setValidationErrors({});
    return true;
  };

  const clearValidationError = () => setValidationErrors({});

  const getValidationError = () => {
    const errorValues = Object.values(validationErrors);
    return errorValues.length > 0 ? errorValues[0] : '';
  };

  return {
    validationErrors,
    validateInputs,
    clearValidationError,
    getValidationError,
    hasValidationError: Object.keys(validationErrors).length > 0,
  };
}

// Custom hook for UI state
function useUIState() {
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState('');

  return {
    showPassword,
    setShowPassword,
    focusedInput,
    setFocusedInput,
  };
}

// Email Input Component
function EmailInput({
  email,
  setEmail,
  focusedInput,
  setFocusedInput,
  hasError,
  isLoading,
  onSubmitEditing,
}: {
  email: string;
  setEmail: (email: string) => void;
  focusedInput: string;
  setFocusedInput: (input: string) => void;
  hasError: boolean;
  isLoading: boolean;
  onSubmitEditing: () => void;
}) {
  return (
    <View style={[styles.inputContainer, focusedInput === 'email' && styles.inputContainerFocused]}>
      <TextInput
        mode="flat"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="username"
        textContentType="username"
        importantForAutofill="yes"
        autoCorrect={false}
        spellCheck={false}
        enablesReturnKeyAutomatically={true}
        returnKeyType="next"
        style={styles.input}
        placeholderTextColor={focusedInput === 'email' ? COLORS.primary : '#fff'}
        textColor={focusedInput === 'email' ? '#fff' : '#666'}
        cursorColor={COLORS.primary}
        underlineColor="transparent"
        activeUnderlineColor={COLORS.primary}
        selectionColor="rgba(108, 71, 255, 0.3)"
        left={
          <TextInput.Icon icon="email" color={focusedInput === 'email' ? COLORS.primary : '#fff'} />
        }
        theme={{
          colors: {
            background: '#1A1A1A',
            primary: COLORS.primary,
          },
        }}
        onFocus={() => setFocusedInput('email')}
        onBlur={() => setFocusedInput('')}
        error={hasError}
        disabled={isLoading}
        onSubmitEditing={onSubmitEditing}
      />
    </View>
  );
}

// Password Input Component
function PasswordInput({
  password,
  setPassword,
  showPassword,
  setShowPassword,
  focusedInput,
  setFocusedInput,
  hasError,
  isLoading,
  onSubmitEditing,
  inputRef,
}: {
  password: string;
  setPassword: (password: string) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  focusedInput: string;
  setFocusedInput: (input: string) => void;
  hasError: boolean;
  isLoading: boolean;
  onSubmitEditing: () => void;
  inputRef: React.RefObject<RNTextInput | null>;
}) {
  return (
    <View
      style={[styles.inputContainer, focusedInput === 'password' && styles.inputContainerFocused]}
    >
      <TextInput
        ref={inputRef}
        mode="flat"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoComplete="current-password"
        textContentType="password"
        importantForAutofill="yes"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        enablesReturnKeyAutomatically={true}
        returnKeyType="done"
        passwordRules="minlength: 8;"
        style={styles.input}
        placeholderTextColor={focusedInput === 'password' ? COLORS.primary : '#fff'}
        textColor={focusedInput === 'password' ? '#fff' : '#666'}
        cursorColor={COLORS.primary}
        underlineColor="transparent"
        activeUnderlineColor={COLORS.primary}
        selectionColor="rgba(108, 71, 255, 0.3)"
        left={
          <TextInput.Icon
            icon="lock"
            color={focusedInput === 'password' ? COLORS.primary : '#fff'}
          />
        }
        right={
          <TextInput.Icon
            icon={showPassword ? 'eye-off' : 'eye'}
            color={focusedInput === 'password' ? COLORS.primary : '#fff'}
            onPress={() => setShowPassword(!showPassword)}
          />
        }
        theme={{
          colors: {
            background: '#1A1A1A',
            primary: COLORS.primary,
          },
        }}
        onFocus={() => setFocusedInput('password')}
        onBlur={() => setFocusedInput('')}
        error={hasError}
        disabled={isLoading}
        onSubmitEditing={onSubmitEditing}
      />
    </View>
  );
}

// Remember Me Component
function RememberMeCheckbox({
  rememberMe,
  onToggle,
  isLoading,
}: {
  rememberMe: boolean;
  onToggle: (checked: boolean) => void;
  isLoading: boolean;
}) {
  return (
    <View style={styles.rememberContainer}>
      <Pressable
        style={styles.checkboxContainer}
        onPress={() => onToggle(!rememberMe)}
        disabled={isLoading}
      >
        <View
          style={[
            styles.customCheckbox,
            rememberMe && styles.customCheckboxChecked,
            isLoading && styles.customCheckboxDisabled,
          ]}
        >
          {rememberMe && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
        <Text style={styles.rememberText}>Remember me</Text>
      </Pressable>
    </View>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [hasLoadedCredentials, setHasLoadedCredentials] = useState(false);

  const passwordInputRef = useRef<RNTextInput | null>(null);
  const isMountedRef = useRef(true);
  const { signIn, isLoading, error, clearError } = useAuth();

  const { isLoadingCredentials, loadSavedCredentials, saveCredentials, clearSavedCredentials } =
    useCredentialManagement();
  const { validateInputs, clearValidationError, getValidationError, hasValidationError } =
    useFormValidation();
  const { showPassword, setShowPassword, focusedInput, setFocusedInput } = useUIState();
  const debouncedNavigate = useNavigationDebounce();

  // Load saved credentials on component mount (only once)
  useEffect(() => {
    if (!hasLoadedCredentials && isMountedRef.current) {
      setHasLoadedCredentials(true);
      loadSavedCredentials(setEmail, setPassword, setRememberMe);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [hasLoadedCredentials, loadSavedCredentials]);

  // Clear any errors when inputs change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        if (error) clearError();
        clearValidationError();
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [email, password, error, clearError, clearValidationError]);

  const handleRememberMeChange = async (checked: boolean) => {
    setRememberMe(checked);
    if (!checked) {
      await clearSavedCredentials();
    }
  };

  const handleLogin = async () => {
    if (!validateInputs(email, password)) return;

    try {
      await saveCredentials(email, password, rememberMe);
      const result = await signIn(email, password, rememberMe);

      if (result.error) {
        await clearSavedCredentials();
      }
    } catch (err) {
      console.error('Login error:', err);
      await clearSavedCredentials();
    }
  };

  const handleForgotPassword = () => {
    debouncedNavigate(() => router.push('/(auth)/forgot-password'));
  };

  const handleSignUpNavigation = () => {
    if (!isLoading && !isLoadingCredentials) {
      debouncedNavigate(() => router.push('/(auth)/register'));
    }
  };

  const getErrorMessage = () => {
    const validationError = getValidationError();
    if (validationError) return validationError;
    if (error?.message) return error.message;
    return '';
  };

  if (isLoadingCredentials) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.content}>
          <Text variant="displaySmall" style={styles.title}>
            Login to your{'\n'}Account
          </Text>

          <View style={styles.form}>
            <EmailInput
              email={email}
              setEmail={setEmail}
              focusedInput={focusedInput}
              setFocusedInput={setFocusedInput}
              hasError={!!error || hasValidationError}
              isLoading={isLoading}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />

            <PasswordInput
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              focusedInput={focusedInput}
              setFocusedInput={setFocusedInput}
              hasError={!!error || hasValidationError}
              isLoading={isLoading}
              onSubmitEditing={handleLogin}
              inputRef={passwordInputRef}
            />

            {(error || hasValidationError) && (
              <HelperText type="error" style={styles.errorText}>
                {getErrorMessage()}
              </HelperText>
            )}

            <RememberMeCheckbox
              rememberMe={rememberMe}
              onToggle={handleRememberMeChange}
              isLoading={isLoading}
            />

            <Pressable
              style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signInButtonText}>Sign in</Text>
              )}
            </Pressable>

            <Pressable onPress={handleForgotPassword} disabled={isLoading}>
              <Text style={styles.forgotPassword}>Forgot the password?</Text>
            </Pressable>

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.socialButtons}>
              <Pressable style={styles.socialButton} disabled={isLoading}>
                <Ionicons name="logo-facebook" size={24} color="white" />
              </Pressable>
              <Pressable style={styles.socialButton} disabled={isLoading}>
                <Ionicons name="logo-google" size={24} color="white" />
              </Pressable>
              <Pressable style={styles.socialButton} disabled={isLoading}>
                <Ionicons name="logo-apple" size={24} color="white" />
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Pressable disabled={isLoading} onPress={handleSignUpNavigation}>
                <Text style={styles.signUpText}>Sign Up</Text>
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.text,
    marginTop: SPACING.md,
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: SPACING.xxl,
    paddingTop: SPACING.xxl * 5,
  },
  title: {
    color: COLORS.text,
    marginBottom: SPACING.xxl,
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
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  input: {
    backgroundColor: '#1f222a',
    height: 56,
  },
  errorText: {
    color: '#ff4444',
    marginBottom: SPACING.md,
    marginTop: -SPACING.sm,
  },
  rememberContainer: {
    marginBottom: SPACING.xl,
    alignItems: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 4,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customCheckboxChecked: {
    backgroundColor: COLORS.primary,
  },
  customCheckboxDisabled: {
    opacity: 0.5,
  },
  rememberText: {
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  signInButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: BORDER_RADIUS.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPassword: {
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
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
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  socialButton: {
    width: 60,
    height: 60,
    backgroundColor: '#1f222a',
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACING.xxl * 1,
  },
  footerText: {
    color: COLORS.text,
    opacity: 0.7,
    marginRight: SPACING.xs,
  },
  signUpText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
