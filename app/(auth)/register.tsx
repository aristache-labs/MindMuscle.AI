import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Checkbox, HelperText, Text, TextInput } from 'react-native-paper';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import { useNavigationDebounce } from '../hooks/useDebounce';
import { captureAuthError } from '../services/sentry';
import * as Sentry from '@sentry/react-native';
import { validationService } from '../services/validationService';
import { useAuth } from '../store/AuthContext';

// Custom hook for input handlers
function useInputHandlers(clearError: () => void, clearFieldError: (field: string) => void) {
  const createInputHandler = (setter: (value: string) => void, field: string) => {
    return (text: string) => {
      setter(text);
      clearFieldError(field);
      clearError();

      // Track form interactions for analytics (only on meaningful milestones)
      if (text.length === 1 || (text.length > 0 && text.length % 5 === 0)) {
        Sentry.addBreadcrumb({
          message: `User entered text in ${field}`,
          category: 'user.input',
          data: {
            field,
            hasValue: text.length > 0,
            length: text.length,
          },
        });
      }
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
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isMountedRef = useRef(true);
  const componentMountTimeRef = useRef(Date.now());
  const { signUp, isLoading, error, clearError } = useAuth();
  const debouncedNavigate = useNavigationDebounce();

  // Initialize Sentry tracking for registration screen
  useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'Registration screen mounted',
      category: 'navigation',
      data: {
        screen: 'register',
        timestamp: new Date().toISOString(),
      },
    });

    // Navigation already tracked in breadcrumb above

    return () => {
      const sessionDuration = Date.now() - componentMountTimeRef.current;
      Sentry.addBreadcrumb({
        message: 'Registration screen unmounted',
        category: 'navigation',
        data: {
          screen: 'register',
          sessionDuration: `${sessionDuration}ms`,
        },
      });
    };
  }, []);

  // Clear field error helper
  const clearFieldError = (field: string) => {
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const { createInputHandler } = useInputHandlers(clearError, clearFieldError);

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
    setValidationErrors({});

    // Track registration attempt
    Sentry.addBreadcrumb({
      message: 'User initiated registration',
      category: 'user.action',
      data: {
        email: email.split('@')[0] + '@***', // Masked email for privacy
        hasFullName: !!fullName,
        rememberMe,
        timestamp: new Date().toISOString(),
      },
    });

    const formData = {
      fullName,
      email,
      password,
      confirmPassword,
    };

    const validationResult = validationService.validateRegisterForm(formData);
    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      validationResult.errors.forEach((error) => {
        errors[error.field] = error.message;

        // Track validation errors as breadcrumbs (not actual errors)
        Sentry.addBreadcrumb({
          message: `Validation failed for ${error.field}: ${error.message}`,
          category: 'validation',
          data: {
            field: error.field,
            message: error.message,
            value: String(formData[error.field as keyof typeof formData]).substring(0, 10) + '***', // Truncated for privacy
          },
          level: 'warning',
        });
      });
      setValidationErrors(errors);

      // Track overall validation failure
      Sentry.addBreadcrumb({
        message: 'Registration form validation failed',
        category: 'validation',
        data: {
          errorCount: validationResult.errors.length,
          failedFields: validationResult.errors.map((e) => e.field),
        },
      });

      return;
    }

    try {
      await signUp(email, password, fullName, rememberMe);

      // Track successful registration attempt
      Sentry.addBreadcrumb({
        message: 'Registration successful',
        category: 'auth.success',
        data: {
          email: email.split('@')[0] + '@***',
          hasFullName: !!fullName,
          rememberMe,
        },
      });

      // Set user context for future tracking
      Sentry.setUser({ email: email, username: fullName });
    } catch (err) {
      console.error('Registration error:', err);

      // Capture authentication error with Sentry
      const error = err instanceof Error ? err : new Error(String(err));
      captureAuthError(error, 'registration');

      // Add breadcrumb for failed registration
      Sentry.addBreadcrumb({
        message: 'Registration failed',
        category: 'auth.error',
        data: {
          email: email.split('@')[0] + '@***',
          errorMessage: error.message,
          timestamp: new Date().toISOString(),
        },
        level: 'error',
      });
    }
  };

  const handleBackNavigation = () => {
    Sentry.addBreadcrumb({
      message: 'User navigated back from registration',
      category: 'navigation',
      data: {
        from: 'register',
        action: 'back_button',
      },
    });
    debouncedNavigate(() => router.back());
  };

  const handleSignInNavigation = () => {
    if (!isLoading) {
      Sentry.addBreadcrumb({
        message: 'User navigated to login from registration',
        category: 'navigation',
        data: {
          from: 'register',
          to: 'login',
          action: 'sign_in_link',
        },
      });
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
              onFocus={(field) => {
                setFocusedInput(field);
                Sentry.addBreadcrumb({
                  message: `User focused on ${field} input`,
                  category: 'user.focus',
                  data: { field },
                });
              }}
              onBlur={() => setFocusedInput('')}
              isLoading={isLoading}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
            {validationErrors.fullName ? (
              <HelperText type="error" style={styles.errorText}>
                {validationErrors.fullName}
              </HelperText>
            ) : null}

            <CustomInput
              placeholder="Email"
              value={email}
              onChangeText={handleEmailChange}
              icon="email"
              focusedInput={focusedInput}
              inputName="email"
              onFocus={(field) => {
                setFocusedInput(field);
                Sentry.addBreadcrumb({
                  message: `User focused on ${field} input`,
                  category: 'user.focus',
                  data: { field },
                });
              }}
              onBlur={() => setFocusedInput('')}
              isLoading={isLoading}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            {validationErrors.email ? (
              <HelperText type="error" style={styles.errorText}>
                {validationErrors.email}
              </HelperText>
            ) : null}

            <CustomInput
              placeholder="Password"
              value={password}
              onChangeText={handlePasswordChange}
              icon="lock"
              focusedInput={focusedInput}
              inputName="password"
              onFocus={(field) => {
                setFocusedInput(field);
                Sentry.addBreadcrumb({
                  message: `User focused on ${field} input`,
                  category: 'user.focus',
                  data: { field },
                });
              }}
              onBlur={() => setFocusedInput('')}
              isLoading={isLoading}
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? 'eye-off' : 'eye'}
              onTogglePassword={() => {
                setShowPassword(!showPassword);
                Sentry.addBreadcrumb({
                  message: `User ${!showPassword ? 'showed' : 'hid'} password`,
                  category: 'user.interaction',
                  data: {
                    field: 'password',
                    visible: !showPassword,
                  },
                });
              }}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {validationErrors.password ? (
              <HelperText type="error" style={styles.errorText}>
                {validationErrors.password}
              </HelperText>
            ) : null}

            <CustomInput
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              icon="lock-check"
              focusedInput={focusedInput}
              inputName="confirmPassword"
              onFocus={(field) => {
                setFocusedInput(field);
                Sentry.addBreadcrumb({
                  message: `User focused on ${field} input`,
                  category: 'user.focus',
                  data: { field },
                });
              }}
              onBlur={() => setFocusedInput('')}
              isLoading={isLoading}
              secureTextEntry={!showConfirmPassword}
              rightIcon={showConfirmPassword ? 'eye-off' : 'eye'}
              onTogglePassword={() => {
                setShowConfirmPassword(!showConfirmPassword);
                Sentry.addBreadcrumb({
                  message: `User ${!showConfirmPassword ? 'showed' : 'hid'} confirm password`,
                  category: 'user.interaction',
                  data: {
                    field: 'confirmPassword',
                    visible: !showConfirmPassword,
                  },
                });
              }}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {validationErrors.confirmPassword ? (
              <HelperText type="error" style={styles.errorText}>
                {validationErrors.confirmPassword}
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
                  onPress={() => {
                    setRememberMe(!rememberMe);
                    Sentry.addBreadcrumb({
                      message: `User ${!rememberMe ? 'enabled' : 'disabled'} remember me`,
                      category: 'user.preference',
                      data: {
                        rememberMe: !rememberMe,
                      },
                    });
                  }}
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
