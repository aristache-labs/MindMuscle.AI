import React, { useState } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform, Pressable, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { TextInput, Text, Checkbox, HelperText } from 'react-native-paper';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useAuth } from '../store/AuthContext';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const { signUp, isLoading, error, clearError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  // Add focus states for each input
  const [focusedInput, setFocusedInput] = useState('');

  const validateInputs = () => {
    const errors = {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: ''
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
    return !Object.values(errors).some(error => error !== '');
  };

  const handleRegister = async () => {
    // Clear any previous auth errors
    clearError();
    
    if (!validateInputs()) return;

    try {
      await signUp(email, password, fullName, rememberMe);
    } catch (err) {
      console.error('Registration error:', err);
    }
  };

  // Clear errors when user starts typing
  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (fieldErrors.email || error) {
      setFieldErrors(prev => ({ ...prev, email: '' }));
      clearError();
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (fieldErrors.password || error) {
      setFieldErrors(prev => ({ ...prev, password: '' }));
      clearError();
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (fieldErrors.confirmPassword || error) {
      setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
      clearError();
    }
  };

  const handleFullNameChange = (text: string) => {
    setFullName(text);
    if (fieldErrors.fullName || error) {
      setFieldErrors(prev => ({ ...prev, fullName: '' }));
      clearError();
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
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={30} color="white" />
          </Pressable>

          <Text variant="displaySmall" style={styles.title}>
            Create your{'\n'}Account
          </Text>

          <View style={styles.form}>
            <View style={[styles.inputContainer, focusedInput === 'fullName' && styles.inputContainerFocused]}>
              <TextInput
                mode="flat"
                placeholder="Full Name"
                value={fullName}
                onChangeText={handleFullNameChange}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                importantForAutofill="yes"
                style={styles.input}
                contentStyle={{ backgroundColor: '#1f222a' }}
                theme={{ 
                  colors: { 
                    background: '#1A1A1A',
                    primary: COLORS.primary,
                  } 
                }}
                placeholderTextColor={focusedInput === 'fullName' ? COLORS.primary : '#fff'}
                textColor={focusedInput === 'fullName' ? '#fff' : '#666'}
                cursorColor={COLORS.primary}
                underlineColor="transparent"
                activeUnderlineColor={COLORS.primary}
                selectionColor="rgba(108, 71, 255, 0.3)"
                left={<TextInput.Icon icon="account" color={focusedInput === 'fullName' ? COLORS.primary : '#fff'} />}
                onFocus={() => setFocusedInput('fullName')}
                onBlur={() => setFocusedInput('')}
                disabled={isLoading}
              />
            </View>
            {fieldErrors.fullName ? (
              <HelperText type="error" style={styles.errorText}>
                {fieldErrors.fullName}
              </HelperText>
            ) : null}

            <View style={[styles.inputContainer, focusedInput === 'email' && styles.inputContainerFocused]}>
              <TextInput
                mode="flat"
                placeholder="Email"
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                importantForAutofill="yes"
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
                disabled={isLoading}
              />
            </View>
            {fieldErrors.email ? (
              <HelperText type="error" style={styles.errorText}>
                {fieldErrors.email}
              </HelperText>
            ) : null}

            <View style={[styles.inputContainer, focusedInput === 'password' && styles.inputContainerFocused]}>
              <TextInput
                mode="flat"
                placeholder="Password"
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                importantForAutofill="yes"
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
                disabled={isLoading}
              />
            </View>
            {fieldErrors.password ? (
              <HelperText type="error" style={styles.errorText}>
                {fieldErrors.password}
              </HelperText>
            ) : null}

            <View style={[styles.inputContainer, focusedInput === 'confirmPassword' && styles.inputContainerFocused]}>
              <TextInput
                mode="flat"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry={!showConfirmPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                importantForAutofill="no"
                style={styles.input}
                placeholderTextColor={focusedInput === 'confirmPassword' ? COLORS.primary : '#fff'}
                textColor={focusedInput === 'confirmPassword' ? '#fff' : '#666'}
                cursorColor={COLORS.primary}
                underlineColor="transparent"
                activeUnderlineColor={COLORS.primary}
                selectionColor="rgba(108, 71, 255, 0.3)"
                left={<TextInput.Icon icon="lock-check" color={focusedInput === 'confirmPassword' ? COLORS.primary : '#fff'} />}
                right={
                  <TextInput.Icon
                    icon={showConfirmPassword ? 'eye-off' : 'eye'}
                    color={focusedInput === 'confirmPassword' ? COLORS.primary : '#fff'}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                }
                theme={{
                  colors: {
                    background: '#1A1A1A',
                    primary: COLORS.primary,
                  },
                }}
                onFocus={() => setFocusedInput('confirmPassword')}
                onBlur={() => setFocusedInput('')}
                disabled={isLoading}
              />
            </View>
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

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text style={styles.signInText}>Sign in</Text>
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
    overflow: "hidden",
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