import { Ionicons } from '@expo/vector-icons';
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

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [focusedInput, setFocusedInput] = useState('');

  const componentMountTimeRef = useRef(Date.now());

  // Initialize Sentry tracking for forgot password screen
  useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'Forgot password screen mounted',
      category: 'navigation',
      data: {
        screen: 'forgot-password',
        timestamp: new Date().toISOString(),
      },
    });

    // Navigation already tracked in breadcrumb above

    return () => {
      const sessionDuration = Date.now() - componentMountTimeRef.current;
      Sentry.addBreadcrumb({
        message: 'Forgot password screen unmounted',
        category: 'navigation',
        data: {
          screen: 'forgot-password',
          sessionDuration: `${sessionDuration}ms`,
          wasSuccessful: success,
        },
      });
    };
  }, [success]);

  const validateEmail = () => {
    if (!email.trim()) {
      const error = 'Email is required';
      setError(error);

      // Track validation error as breadcrumb (not actual error)
      Sentry.addBreadcrumb({
        message: 'Email validation failed - empty email',
        category: 'validation',
        data: {
          field: 'email',
          error: 'required',
        },
      });

      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      const error = 'Please enter a valid email address';
      setError(error);

      // Track validation error as breadcrumb (not actual error)
      Sentry.addBreadcrumb({
        message: 'Email validation failed - invalid format',
        category: 'validation',
        data: {
          field: 'email',
          error: 'invalid_format',
          email: email.split('@')[0] + '@***', // Masked for privacy
        },
      });

      return false;
    }

    // Track successful validation
    Sentry.addBreadcrumb({
      message: 'Email validation successful',
      category: 'validation',
      data: {
        field: 'email',
        email: email.split('@')[0] + '@***', // Masked for privacy
      },
    });

    return true;
  };

  const handleResetPassword = async () => {
    // Track password reset attempt initiation
    Sentry.addBreadcrumb({
      message: 'User initiated password reset',
      category: 'user.action',
      data: {
        email: email.split('@')[0] + '@***', // Masked email for privacy
        timestamp: new Date().toISOString(),
      },
    });

    if (!validateEmail()) return;

    setIsLoading(true);
    setError('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'mindmuscle://reset-password',
      });

      if (resetError) throw resetError;

      setSuccess(true);

      // Track successful password reset request
      Sentry.addBreadcrumb({
        message: 'Password reset email sent successfully',
        category: 'auth.success',
        data: {
          email: email.split('@')[0] + '@***',
          redirectTo: 'mindmuscle://reset-password',
          timestamp: new Date().toISOString(),
        },
      });

      // Success already tracked in breadcrumb above

      // Track conversion - user reached success state
      Sentry.addBreadcrumb({
        message: 'User reached password reset success state',
        category: 'conversion',
        data: {
          funnel_step: 'password_reset_success',
          email: email.split('@')[0] + '@***',
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(errorMessage);

      // Capture authentication error with Sentry
      const error = err instanceof Error ? err : new Error(String(err));
      captureAuthError(error, 'password_reset');

      // Add breadcrumb for failed password reset
      Sentry.addBreadcrumb({
        message: 'Password reset request failed',
        category: 'auth.error',
        data: {
          email: email.split('@')[0] + '@***',
          errorMessage: error.message,
          timestamp: new Date().toISOString(),
        },
        level: 'error',
      });
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
          <Pressable
            onPress={() => {
              Sentry.addBreadcrumb({
                message: 'User navigated back from forgot password',
                category: 'navigation',
                data: {
                  from: 'forgot-password',
                  action: 'back_button',
                },
              });
              router.back();
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={30} color="white" />
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
                <View
                  style={[
                    styles.inputContainer,
                    focusedInput === 'email' && styles.inputContainerFocused,
                  ]}
                >
                  <TextInput
                    mode="flat"
                    placeholder="Email"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setError('');

                      // Track form interaction (only on meaningful milestones)
                      if (text.length === 1 || (text.length > 0 && text.length % 5 === 0)) {
                        Sentry.addBreadcrumb({
                          message: 'User entered email in forgot password form',
                          category: 'user.input',
                          data: {
                            field: 'email',
                            hasValue: text.length > 0,
                            length: text.length,
                          },
                        });
                      }
                    }}
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
                    left={
                      <TextInput.Icon
                        icon="email"
                        color={focusedInput === 'email' ? COLORS.primary : '#fff'}
                      />
                    }
                    theme={{
                      colors: {
                        background: '#1A1A1A',
                        primary: COLORS.primary,
                      },
                    }}
                    onFocus={() => {
                      setFocusedInput('email');
                      Sentry.addBreadcrumb({
                        message: 'User focused on email input in forgot password',
                        category: 'user.focus',
                        data: { field: 'email' },
                      });
                    }}
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
                  style={[
                    styles.resetButtonContainer,
                    styles.resetButton,
                    isLoading && styles.resetButtonDisabled,
                  ]}
                  onPress={() => {
                    Sentry.addBreadcrumb({
                      message: 'User clicked send reset link button',
                      category: 'user.interaction',
                      data: {
                        button: 'send_reset_link',
                        email: email.split('@')[0] + '@***',
                        hasEmail: !!email.trim(),
                      },
                    });
                    handleResetPassword();
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.resetButtonText}>Send Reset Link</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.successContainer}>
              <Ionicons name="mail-outline" size={64} color={COLORS.primary} />
              <Text style={styles.successTitle}>Check your email</Text>
              <Text style={styles.successText}>We've sent a password reset link to {email}</Text>
              <Pressable
                style={styles.resetButtonContainer}
                onPress={() => {
                  Sentry.addBreadcrumb({
                    message: 'User returned to login from password reset success',
                    category: 'navigation',
                    data: {
                      from: 'forgot-password-success',
                      to: 'login',
                      action: 'return_to_login',
                    },
                  });
                  router.replace('/(auth)/login');
                }}
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
    width: 50,
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 50,
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
  resetButtonContainer: {
    width: '100%',
    marginTop: SPACING.xl,
  },
  resetButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: BORDER_RADIUS.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  resetButtonDisabled: {
    opacity: 0.7,
  },
  resetButtonText: {
    color: '#fff',
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
