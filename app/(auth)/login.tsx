import React, { useState, useEffect } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform, Pressable, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { TextInput, Text, Checkbox, HelperText } from 'react-native-paper';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useAuth } from '../store/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState('');
  const [validationError, setValidationError] = useState('');
  
  const { signIn, isLoading, error, clearError, session } = useAuth();

  // Clear any errors when inputs change
  useEffect(() => {
    if (error) {
      clearError();
    }
    setValidationError('');
  }, [email, password]);

  // Redirect if already authenticated
  useEffect(() => {
    if (session) {
      router.replace('/');
    }
  }, [session]);

  const validateInputs = () => {
    if (!email.trim()) {
      setValidationError('Email is required');
      return false;
    }
    if (!password.trim()) {
      setValidationError('Password is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setValidationError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateInputs()) return;

    try {
      await signIn(email, password, rememberMe);
    } catch (err) {
      // Error is handled by AuthContext
      console.error('Login error:', err);
    }
  };

  // Helper function to get error message
  const getErrorMessage = () => {
    if (validationError) return validationError;
    if (error?.message) return error.message;
    return '';
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
            Login to your{'\n'}Account
          </Text>

          <View style={styles.form}>
            <View style={[styles.inputContainer, focusedInput === 'email' && styles.inputContainerFocused]}>
              <TextInput
                mode="flat"
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                placeholderTextColor={focusedInput === 'email' ? COLORS.primary : '#fff'}
                textColor={focusedInput === 'email' ? '#fff' : '#666'}
                cursorColor={COLORS.primary}
                underlineColor="transparent"
                activeUnderlineColor={COLORS.primary}
                selectionColor="rgba(108, 71, 255, 0.3)"
                left={<TextInput.Icon icon="email" color={focusedInput === 'email' ? COLORS.primary : '#fff'} />}
                theme={{
                  colors: {
                    background: '#1A1A1A',
                    primary: COLORS.primary,
                  },
                }}
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput('')}
                error={!!error || !!validationError}
                disabled={isLoading}
              />
            </View>

            <View style={[styles.inputContainer, focusedInput === 'password' && styles.inputContainerFocused]}>
              <TextInput
                mode="flat"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="oneTimeCode"
                style={styles.input}
                placeholderTextColor={focusedInput === 'password' ? COLORS.primary : '#fff'}
                textColor={focusedInput === 'password' ? '#fff' : '#666'}
                cursorColor={COLORS.primary}
                underlineColor="transparent"
                activeUnderlineColor={COLORS.primary}
                selectionColor="rgba(108, 71, 255, 0.3)"
                left={<TextInput.Icon icon="lock" color={focusedInput === 'password' ? COLORS.primary : '#fff'} />}
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
                error={!!error || !!validationError}
                disabled={isLoading}
              />
            </View>

            {(error || validationError) && (
              <HelperText type="error" style={styles.errorText}>
                {getErrorMessage()}
              </HelperText>
            )}

            <View style={styles.rememberContainer}>
              <View style={styles.checkboxContainer}>
                <Checkbox.Android
                  status={rememberMe ? 'checked' : 'unchecked'}
                  onPress={() => setRememberMe(!rememberMe)}
                  color={COLORS.primary}
                  uncheckedColor={COLORS.primary}
                  disabled={isLoading}
                />
                <Text style={styles.rememberText}>Remember me</Text>
              </View>
            </View>

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

            <Pressable onPress={() => router.push('/(auth)/forgot-password')} disabled={isLoading}>
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
              <Link href="/(auth)/register" asChild>
                <Pressable disabled={isLoading}>
                  <Text style={styles.signUpText}>Sign Up</Text>
                </Pressable>
              </Link>
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