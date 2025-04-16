import React, { useState } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { COLORS, SPACING } from '../constants/theme';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async () => {
    setIsLoading(true);
    // TODO: Implement registration logic
    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            Create Account
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Start your fitness journey today
          </Text>

          <TextInput
            mode="outlined"
            label="Full Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />

          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <TextInput
            mode="outlined"
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            style={styles.input}
          />

          <TextInput
            mode="outlined"
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            right={
              <TextInput.Icon
                icon={showConfirmPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleRegister}
            loading={isLoading}
            style={styles.button}
          >
            Sign Up
          </Button>

          <View style={styles.socialButtons}>
            <Button
              mode="outlined"
              icon="google"
              onPress={() => {}}
              style={styles.socialButton}
            >
              Google
            </Button>
            <Button
              mode="outlined"
              icon="apple"
              onPress={() => {}}
              style={styles.socialButton}
            >
              Apple
            </Button>
          </View>

          <View style={styles.footer}>
            <Text variant="bodyMedium">Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <Text style={styles.link}>Login</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  title: {
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    opacity: 0.7,
  },
  input: {
    marginBottom: SPACING.md,
  },
  button: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
  },
  socialButton: {
    flex: 1,
    marginHorizontal: SPACING.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  link: {
    color: COLORS.primary,
  },
}); 