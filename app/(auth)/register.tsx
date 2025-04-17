import React, { useState } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform, Pressable, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { TextInput, Text, Checkbox } from 'react-native-paper';
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
  const { signUp, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Add focus states for each input
  const [focusedInput, setFocusedInput] = useState('');

  const handleRegister = async () => {
    try {
      await signUp(email, password, fullName);
    } catch (err) {
      console.error('Registration error:', err);
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
            Create your{'\n'}Account
          </Text>

          <View style={styles.form}>
            <View style={[styles.inputContainer, focusedInput === 'fullName' && styles.inputContainerFocused]}>
              <TextInput
                mode="flat"
                placeholder="Full Name"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                style={styles.input}
                contentStyle={{ backgroundColor: '#1A1A1A' }}
                theme={{ 
                  colors: { 
                    background: '#1A1A1A',
                    primary: '#6c47ff',
                  } 
                }}
                placeholderTextColor="#666"
                textColor={focusedInput === 'fullName' ? '#fff' : '#666'}
                cursorColor="#6c47ff"
                underlineColor="transparent"
                activeUnderlineColor="#6c47ff"
                selectionColor="rgba(108, 71, 255, 0.3)"
                left={<TextInput.Icon icon="account" color={focusedInput === 'fullName' ? '#6c47ff' : '#666'} />}
                onFocus={() => setFocusedInput('fullName')}
                onBlur={() => setFocusedInput('')}
              />
            </View>

            <View style={[styles.inputContainer, focusedInput === 'email' && styles.inputContainerFocused]}>
              <TextInput
                mode="flat"
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
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
                placeholderTextColor="#666"
                textColor={focusedInput === 'password' ? '#fff' : '#666'}
                cursorColor="#6c47ff"
                underlineColor="transparent"
                activeUnderlineColor="#6c47ff"
                selectionColor="rgba(108, 71, 255, 0.3)"
                left={<TextInput.Icon icon="lock" color={focusedInput === 'password' ? '#6c47ff' : '#666'} />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    color={focusedInput === 'password' ? '#6c47ff' : '#666'}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
                theme={{
                  colors: {
                    background: '#1A1A1A',
                    primary: '#6c47ff',
                  },
                }}
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput('')}
              />
            </View>

            <View style={[styles.inputContainer, focusedInput === 'confirmPassword' && styles.inputContainerFocused]}>
              <TextInput
                mode="flat"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                textContentType="none"
                style={styles.input}
                placeholderTextColor="#666"
                textColor={focusedInput === 'confirmPassword' ? '#fff' : '#666'}
                cursorColor="#6c47ff"
                underlineColor="transparent"
                activeUnderlineColor="#6c47ff"
                selectionColor="rgba(108, 71, 255, 0.3)"
                left={<TextInput.Icon icon="lock-check" color={focusedInput === 'confirmPassword' ? '#6c47ff' : '#666'} />}
                right={
                  <TextInput.Icon
                    icon={showConfirmPassword ? 'eye-off' : 'eye'}
                    color={focusedInput === 'confirmPassword' ? '#6c47ff' : '#666'}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                }
                theme={{
                  colors: {
                    background: '#1A1A1A',
                    primary: '#6c47ff',
                  },
                }}
                onFocus={() => setFocusedInput('confirmPassword')}
                onBlur={() => setFocusedInput('')}
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
    width: 70,
    height: 70,
    alignItems: 'flex-start',
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
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    color: COLORS.text,
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
    backgroundColor: '#1A1A1A',
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
}); 