import React, { useState } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform, Pressable, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Text, TextInput, HelperText, ActivityIndicator } from 'react-native-paper';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import supabase from '../services/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [focusedInput, setFocusedInput] = useState('');

  const validateEmail = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const handleResetPassword = async () => {
    if (!validateEmail()) return;

    setIsLoading(true);
    setError('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'mindmuscle://reset-password',
      });

      if (resetError) throw resetError;
      
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsLoading(false);
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
            <Ionicons name="arrow-back-circle-sharp" size={50} color="white" />
          </Pressable>

          <Text variant="displaySmall" style={styles.title}>
            Reset your{'\n'}Password
          </Text>

          {!success ? (
            <>
              <Text style={styles.description}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>

              <View style={styles.form}>
                <View style={[styles.inputContainer, focusedInput === 'email' && styles.inputContainerFocused]}>
                  <TextInput
                    mode="flat"
                    placeholder="Email"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setError('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                    placeholderTextColor="#666"
                    textColor={focusedInput === 'email' ? '#fff' : '#666'}
                    cursorColor="#6c47ff"
                    underlineColor="transparent"
                    activeUnderlineColor="#6c47ff"
                    selectionColor="rgba(108, 71, 255, 0.3)"
                    left={<TextInput.Icon icon="email" color={focusedInput === 'email' ? '#6c47ff' : '#666'} />}
                    theme={{
                      colors: {
                        background: '#1A1A1A',
                        primary: '#6c47ff',
                      },
                    }}
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput('')}
                    error={!!error}
                    disabled={isLoading}
                  />
                </View>

                {error && (
                  <HelperText type="error" style={styles.errorText}>
                    {error}
                  </HelperText>
                )}

                <Pressable
                  style={styles.resetButtonContainer}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={['#6c47ff', '#8469ff']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.resetButtonText}>Send Reset Link</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.successContainer}>
              <Ionicons name="mail-outline" size={64} color={COLORS.primary} />
              <Text style={styles.successTitle}>Check your email</Text>
              <Text style={styles.successText}>
                We've sent a password reset link to {email}
              </Text>
              <Pressable
                style={styles.resetButtonContainer}
                onPress={() => router.replace('/(auth)/login')}
              >
                <LinearGradient
                  colors={['#6c47ff', '#8469ff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.resetButton}
                >
                  <Text style={styles.resetButtonText}>Return to Login</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: SPACING.xxl * 2,
  },
  content: {
    flex: 1,
    padding: SPACING.xxl,

  },
  backButton: {
    width: 70,
    height: 70,
    marginBottom: 50,
    alignItems: 'flex-start',
  },
  title: {
    color: COLORS.text,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',

  },
  description: {
    color: COLORS.text,
    opacity: 0.9,
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
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 100,
  },
  successTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  successText: {
    color: COLORS.text,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
    fontSize: 16,
    lineHeight: 24,
  },
}); 