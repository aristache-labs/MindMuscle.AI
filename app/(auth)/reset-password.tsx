import { LinearGradient } from 'expo-linear-gradient';
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
import { ActivityIndicator, HelperText, Text, TextInput } from 'react-native-paper';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import { captureAuthError } from '../services/sentry';
import * as Sentry from '@sentry/react-native';
import supabase from '../services/supabase';

// Custom hook for password validation
function usePasswordValidation() {
  const [error, setError] = useState('');

  const validateInputs = (password: string, confirmPassword: string) => {
    if (!password.trim()) {
      const errorMsg = 'Password is required';
      setError(errorMsg);

      // Track validation error as breadcrumb (not actual error)
      Sentry.addBreadcrumb({
        message: 'Password reset validation failed - empty password',
        category: 'validation',
        data: {
          field: 'password',
          error: 'required',
        },
        level: 'warning',
      });

      return false;
    }
    if (password.trim().length < 6) {
      const errorMsg = 'Password must be at least 6 characters';
      setError(errorMsg);

      // Track validation error as breadcrumb (not actual error)
      Sentry.addBreadcrumb({
        message: 'Password reset validation failed - too short',
        category: 'validation',
        data: {
          field: 'password',
          error: 'min_length',
          currentLength: password.trim().length,
          requiredLength: 6,
        },
        level: 'warning',
      });

      return false;
    }
    if (password.trim() !== confirmPassword.trim()) {
      const errorMsg = 'Passwords do not match';
      setError(errorMsg);

      // Track validation error as breadcrumb (not actual error)
      Sentry.addBreadcrumb({
        message: 'Password reset validation failed - mismatch',
        category: 'validation',
        data: {
          field: 'confirmPassword',
          error: 'mismatch',
        },
        level: 'warning',
      });

      return false;
    }

    // Track successful validation
    Sentry.addBreadcrumb({
      message: 'Password reset validation successful',
      category: 'validation',
      data: {
        passwordLength: password.trim().length,
      },
    });

    return true;
  };

  const clearError = () => setError('');

  return { error, setError, validateInputs, clearError };
}

// Custom hook for password reset logic
function usePasswordReset() {
  const [isLoading, setIsLoading] = useState(false);

  const resetPassword = async (password: string) => {
    setIsLoading(true);

    // Track password reset attempt initiation
    Sentry.addBreadcrumb({
      message: 'User initiated password reset',
      category: 'user.action',
      data: {
        passwordLength: password.length,
        timestamp: new Date().toISOString(),
      },
    });

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      // Track successful password reset
      Sentry.addBreadcrumb({
        message: 'Password reset completed successfully',
        category: 'auth.success',
        data: {
          passwordLength: password.length,
          timestamp: new Date().toISOString(),
        },
      });

      // Track conversion - user completed password reset flow
      Sentry.addBreadcrumb({
        message: 'User completed password reset flow',
        category: 'conversion',
        data: {
          funnel_step: 'password_reset_complete',
          redirectTo: 'login',
        },
      });

      router.replace('/(auth)/login');
      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const errorMessage = error.message || 'Failed to reset password';

      // Capture authentication error with Sentry
      captureAuthError(error, 'password_reset_update');

      // Add breadcrumb for failed password reset
      Sentry.addBreadcrumb({
        message: 'Password reset failed',
        category: 'auth.error',
        data: {
          errorMessage: error.message,
          passwordLength: password.length,
          timestamp: new Date().toISOString(),
        },
        level: 'error',
      });

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, resetPassword };
}

// Reusable Password Input Component
interface PasswordInputProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: string;
  focusedInput: string;
  inputName: string;
  onFocus: (name: string) => void;
  onBlur: () => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  isLoading: boolean;
  hasError: boolean;
}

function PasswordInput({
  placeholder,
  value,
  onChangeText,
  icon,
  focusedInput,
  inputName,
  onFocus,
  onBlur,
  showPassword,
  onTogglePassword,
  isLoading,
  hasError,
}: PasswordInputProps) {
  const isFocused = focusedInput === inputName;
  return (
    <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
      <TextInput
        mode="flat"
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!showPassword}
        textContentType="oneTimeCode"
        style={styles.input}
        placeholderTextColor="#666"
        textColor={isFocused ? '#fff' : '#666'}
        cursorColor="#6c47ff"
        underlineColor="transparent"
        activeUnderlineColor="#6c47ff"
        selectionColor="rgba(108, 71, 255, 0.3)"
        left={<TextInput.Icon icon={icon} color={isFocused ? '#6c47ff' : '#666'} />}
        right={
          <TextInput.Icon
            icon={showPassword ? 'eye-off' : 'eye'}
            color={isFocused ? '#6c47ff' : '#666'}
            onPress={onTogglePassword}
          />
        }
        theme={{
          colors: {
            background: '#1A1A1A',
            primary: '#6c47ff',
          },
        }}
        onFocus={() => onFocus(inputName)}
        onBlur={onBlur}
        error={hasError}
        disabled={isLoading}
      />
    </View>
  );
}

// Reset Button Component
interface ResetButtonProps {
  onPress: () => void;
  isLoading: boolean;
}

function ResetButton({ onPress, isLoading }: ResetButtonProps) {
  return (
    <Pressable style={styles.resetButtonContainer} onPress={onPress} disabled={isLoading}>
      <LinearGradient
        colors={['#6c47ff', '#8469ff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.resetButtonText}>Reset Password</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState('');

  const isMountedRef = useRef(true);
  const componentMountTimeRef = useRef(Date.now());
  const { error, setError, validateInputs, clearError } = usePasswordValidation();
  const { isLoading, resetPassword } = usePasswordReset();

  // Initialize Sentry tracking for password reset screen
  useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'Password reset screen mounted',
      category: 'navigation',
      data: {
        screen: 'reset-password',
        timestamp: new Date().toISOString(),
      },
    });

    // Navigation already tracked in breadcrumb above

    return () => {
      isMountedRef.current = false;
      const sessionDuration = Date.now() - componentMountTimeRef.current;
      Sentry.addBreadcrumb({
        message: 'Password reset screen unmounted',
        category: 'navigation',
        data: {
          screen: 'reset-password',
          sessionDuration: `${sessionDuration}ms`,
          hadError: !!error,
        },
      });
    };
  }, [error]);

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    clearError();

    // Track form interaction (only on meaningful milestones)
    if (text.length === 1 || (text.length > 0 && text.length % 5 === 0)) {
      Sentry.addBreadcrumb({
        message: 'User entered text in password field',
        category: 'user.input',
        data: {
          field: 'password',
          hasValue: text.length > 0,
          length: text.length,
        },
      });
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    clearError();

    // Track form interaction (only on meaningful milestones)
    if (text.length === 1 || (text.length > 0 && text.length % 5 === 0)) {
      Sentry.addBreadcrumb({
        message: 'User entered text in confirm password field',
        category: 'user.input',
        data: {
          field: 'confirmPassword',
          hasValue: text.length > 0,
          length: text.length,
        },
      });
    }
  };

  const handleResetPassword = async () => {
    // Track reset password button click
    Sentry.addBreadcrumb({
      message: 'User clicked reset password button',
      category: 'user.interaction',
      data: {
        button: 'reset_password',
        hasPassword: !!password.trim(),
        hasConfirmPassword: !!confirmPassword.trim(),
        passwordLength: password.length,
      },
    });

    if (!validateInputs(password, confirmPassword)) return;

    clearError();
    const result = await resetPassword(password);
    if (!result.success && result.error && isMountedRef.current) {
      setError(result.error);

      // Track that error was displayed to user
      Sentry.addBreadcrumb({
        message: 'Password reset error displayed to user',
        category: 'ui.error',
        data: {
          errorMessage: result.error,
        },
        level: 'warning',
      });
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.content}>
          <Text variant="displaySmall" style={styles.title}>
            Create New{'\n'}Password
          </Text>

          <Text style={styles.description}>
            Your new password must be different from previously used passwords.
          </Text>

          <View style={styles.form}>
            <PasswordInput
              placeholder="New Password"
              value={password}
              onChangeText={handlePasswordChange}
              icon="lock"
              focusedInput={focusedInput}
              inputName="password"
              onFocus={(field) => {
                setFocusedInput(field);
                Sentry.addBreadcrumb({
                  message: `User focused on ${field} input in password reset`,
                  category: 'user.focus',
                  data: { field },
                });
              }}
              onBlur={() => setFocusedInput('')}
              showPassword={showPassword}
              onTogglePassword={() => {
                setShowPassword(!showPassword);
                Sentry.addBreadcrumb({
                  message: `User ${!showPassword ? 'showed' : 'hid'} new password`,
                  category: 'user.interaction',
                  data: {
                    field: 'password',
                    visible: !showPassword,
                  },
                });
              }}
              isLoading={isLoading}
              hasError={!!error}
            />

            <PasswordInput
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              icon="lock-check"
              focusedInput={focusedInput}
              inputName="confirmPassword"
              onFocus={(field) => {
                setFocusedInput(field);
                Sentry.addBreadcrumb({
                  message: `User focused on ${field} input in password reset`,
                  category: 'user.focus',
                  data: { field },
                });
              }}
              onBlur={() => setFocusedInput('')}
              showPassword={showConfirmPassword}
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
              isLoading={isLoading}
              hasError={!!error}
            />

            {error && (
              <HelperText type="error" style={styles.errorText}>
                {error}
              </HelperText>
            )}

            <ResetButton onPress={handleResetPassword} isLoading={isLoading} />
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
  title: {
    color: COLORS.text,
    marginBottom: SPACING.xl,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  description: {
    color: COLORS.text,
    opacity: 0.7,
    marginBottom: SPACING.xl,
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputContainerFocused: {
    borderColor: '#6c47ff',
    borderWidth: 1,
  },
  input: {
    backgroundColor: '#1A1A1A',
    height: 56,
  },
  errorText: {
    color: '#ff4444',
    marginBottom: SPACING.md,
    marginTop: -SPACING.sm,
  },
  resetButtonContainer: {
    width: '100%',
    marginTop: SPACING.xl,
  },
  resetButton: {
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  resetButtonDisabled: {
    opacity: 0.7,
  },
  resetButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
