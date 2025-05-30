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
import { Text, TextInput, HelperText, ActivityIndicator } from 'react-native-paper';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import supabase from '../services/supabase';

// Custom hook for password validation
function usePasswordValidation() {
  const [error, setError] = useState('');

  const validateInputs = (password: string, confirmPassword: string) => {
    if (!password.trim()) {
      setError('Password is required');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
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
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;
      router.replace('/(auth)/login');
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to reset password',
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
  const { error, setError, validateInputs, clearError } = usePasswordValidation();
  const { isLoading, resetPassword } = usePasswordReset();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    clearError();
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    clearError();
  };

  const handleResetPassword = async () => {
    if (!validateInputs(password, confirmPassword)) return;

    clearError();
    const result = await resetPassword(password);
    if (!result.success && result.error && isMountedRef.current) {
      setError(result.error);
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
              onFocus={setFocusedInput}
              onBlur={() => setFocusedInput('')}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword(!showPassword)}
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
              onFocus={setFocusedInput}
              onBlur={() => setFocusedInput('')}
              showPassword={showConfirmPassword}
              onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
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
