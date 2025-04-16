import React, { useState } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { COLORS, SPACING } from '../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    // TODO: Implement login logic
    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Welcome Back
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Login to continue your fitness journey
        </Text>

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

        <Button
          mode="contained"
          onPress={handleLogin}
          loading={isLoading}
          style={styles.button}
        >
          Login
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
          <Text variant="bodyMedium">Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <Text style={styles.link}>Sign up</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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