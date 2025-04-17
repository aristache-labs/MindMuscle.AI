import React, { useState } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform, Pressable, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { TextInput, Text, Checkbox } from 'react-native-paper';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useAuth } from '../store/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const { signIn, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    try {
      await signIn(email, password);
    } catch (err) {
      console.error('Login error:', err);
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
            Login to your{'\n'}Account
          </Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <TextInput
                mode="flat"
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                placeholderTextColor="#666"
                textColor="white"
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                left={<TextInput.Icon icon="email" color="#666" />}
                theme={{
                  colors: {
                    background: '#1A1A1A',
                  },
                }}
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                mode="flat"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={styles.input}
                placeholderTextColor="#666"
                textColor="white"
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                left={<TextInput.Icon icon="lock" color="#666" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    color="#666"
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
                theme={{
                  colors: {
                    background: '#1A1A1A',
                  },
                }}
              />
            </View>

            <View style={styles.rememberContainer}>
              <View style={styles.checkboxContainer}>
                <Checkbox.Android
                  status={rememberMe ? 'checked' : 'unchecked'}
                  onPress={() => setRememberMe(!rememberMe)}
                  color={COLORS.primary}
                  uncheckedColor="#6c47ff"
                />
                <Text style={styles.rememberText}>Remember me</Text>
              </View>
            </View>

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
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
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
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  input: {
    backgroundColor: '#1A1A1A',
    height: 56,
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

  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  signUpButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: COLORS.text,
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
    backgroundColor: '#1E1E1E',
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  socialButtonText: {
    color: COLORS.text,
    fontSize: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACING.xxl,

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