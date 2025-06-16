import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { credentialManager, shouldEnableAutofill } from '../services/credentialManager';
import { COLORS, SPACING } from '../constants/theme';
import secureStorage from '../utils/secureStorage';

interface DebugInfo {
  platformSupport: boolean;
  autofillEnabled: boolean;
  credentialManagerAvailable: boolean;
  savedEmail: string | null;
  rememberMeEnabled: boolean;
  platform: string;
  androidVersion?: number;
  hasKeychainCredentials: boolean;
}

// Helper function to check if we're in development mode
const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

// Helper function to create debug info object
const createDebugInfo = (
  credentialManagerAvailable: boolean,
  savedEmail: string | null,
  rememberMe: string | null,
  hasKeychainCredentials: boolean,
): DebugInfo => ({
  platformSupport: Platform.OS === 'ios' || (Platform.OS === 'android' && Platform.Version >= 26),
  autofillEnabled: shouldEnableAutofill(),
  credentialManagerAvailable,
  savedEmail: savedEmail || null,
  rememberMeEnabled: rememberMe === 'true',
  platform: Platform.OS,
  androidVersion: Platform.OS === 'android' ? Platform.Version : undefined,
  hasKeychainCredentials,
});

// Helper function to load debug data
const loadDebugData = async (): Promise<DebugInfo> => {
  const [credentialManagerAvailable, savedEmail, rememberMe, keychainCredentials] =
    await Promise.all([
      credentialManager.isNativeCredentialManagerAvailable(),
      secureStorage.getItemAsync('mindmuscle_saved_email'),
      secureStorage.getItemAsync('mindmuscle_remember_me'),
      credentialManager.getSavedCredentials().catch(() => null),
    ]);

  return createDebugInfo(
    credentialManagerAvailable,
    savedEmail,
    rememberMe,
    !!(keychainCredentials?.email || keychainCredentials?.password),
  );
};

// Helper function to test credential saving
const testCredentialSaving = async (): Promise<void> => {
  try {
    console.log('🔑 [Debug] Testing credential save...');
    const testEmail = 'test@example.com';
    const testPassword = 'testPassword123';

    const saveResult = await credentialManager.requestToSaveCredentials(testEmail, testPassword);
    console.log('🔑 [Debug] Test credential save result:', saveResult);

    // Check if credentials were saved
    const savedCredentials = await credentialManager.getSavedCredentials();
    console.log('🔑 [Debug] Retrieved test credentials:', {
      hasEmail: !!savedCredentials?.email,
      hasPassword: !!savedCredentials?.password,
    });
  } catch (error) {
    console.error('🔑 [Debug] Test credential save error:', error);
  }
};

// Helper component for debug rows
function DebugRows({ debugInfo }: { debugInfo: DebugInfo }) {
  return (
    <>
      <DebugRow
        label="Platform"
        value={`${debugInfo.platform} ${debugInfo.androidVersion ? `(API ${debugInfo.androidVersion})` : ''}`}
        status="neutral"
      />
      <DebugRow
        label="Platform Support"
        value={debugInfo.platformSupport ? '✅ Yes' : '❌ No'}
        status={debugInfo.platformSupport ? 'success' : 'error'}
      />
      <DebugRow
        label="Autofill Enabled"
        value={debugInfo.autofillEnabled ? '✅ Yes' : '❌ No'}
        status={debugInfo.autofillEnabled ? 'success' : 'error'}
      />
      <DebugRow
        label="Manager Available"
        value={debugInfo.credentialManagerAvailable ? '✅ Yes' : '❌ No'}
        status={debugInfo.credentialManagerAvailable ? 'success' : 'error'}
      />
      <DebugRow
        label="Remember Me"
        value={debugInfo.rememberMeEnabled ? '✅ Enabled' : '⚠️ Disabled'}
        status={debugInfo.rememberMeEnabled ? 'success' : 'warning'}
      />
      <DebugRow
        label="Saved Email"
        value={debugInfo.savedEmail ? `✅ ${debugInfo.savedEmail}` : '⚠️ None'}
        status={debugInfo.savedEmail ? 'success' : 'warning'}
      />
      <DebugRow
        label="Keychain Creds"
        value={debugInfo.hasKeychainCredentials ? '✅ Yes' : '⚠️ None'}
        status={debugInfo.hasKeychainCredentials ? 'success' : 'warning'}
      />
    </>
  );
}

// Helper component for individual debug row
function DebugRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: 'success' | 'warning' | 'error' | 'neutral';
}) {
  const getStatusStyle = () => {
    switch (status) {
      case 'success':
        return styles.success;
      case 'warning':
        return styles.warning;
      case 'error':
        return styles.error;
      default:
        return null;
    }
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}:</Text>
      <Text style={[styles.value, getStatusStyle()]}>{value}</Text>
    </View>
  );
}

// Helper component for warning messages
function WarningMessages({ debugInfo }: { debugInfo: DebugInfo }) {
  return (
    <>
      {!debugInfo.platformSupport && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>⚠️ Autofill not supported on this platform/version</Text>
        </View>
      )}
      {debugInfo.platformSupport && !debugInfo.credentialManagerAvailable && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>⚠️ Check device autofill settings</Text>
        </View>
      )}
    </>
  );
}

// Test button component
function TestButton({ debugInfo }: { debugInfo: DebugInfo }) {
  const [isTestingCredentials, setIsTestingCredentials] = useState(false);

  const handleTestCredentials = async () => {
    setIsTestingCredentials(true);
    try {
      await testCredentialSaving();
    } finally {
      setIsTestingCredentials(false);
    }
  };

  if (!debugInfo.credentialManagerAvailable) {
    return null;
  }

  return (
    <Pressable
      style={[styles.testButton, isTestingCredentials && styles.testButtonDisabled]}
      onPress={handleTestCredentials}
      disabled={isTestingCredentials}
    >
      <Text style={styles.testButtonText}>
        {isTestingCredentials ? '🔄 Testing...' : '🧪 Test Save'}
      </Text>
    </Pressable>
  );
}

export default function CredentialManagerDebugger() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const isVisible = isDevelopment(); // Only show in development

  useEffect(() => {
    if (!isVisible) return;

    const loadDebugInfo = async () => {
      try {
        const info = await loadDebugData();
        setDebugInfo(info);

        // Log to console for debugging
        console.log('🔑 [Debug] Credential Manager Status:', info);
      } catch (error) {
        console.error('🔑 [Debug] Error loading debug info:', error);
      }
    };

    loadDebugInfo();
  }, [isVisible]);

  if (!isVisible || !debugInfo) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔑 Credential Manager Debug</Text>
      <DebugRows debugInfo={debugInfo} />
      <WarningMessages debugInfo={debugInfo} />
      <TestButton debugInfo={debugInfo} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: SPACING.md,
    margin: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  title: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  label: {
    color: '#ccc',
    fontSize: 12,
    flex: 1,
  },
  value: {
    color: '#fff',
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  success: {
    color: '#4CAF50',
  },
  warning: {
    color: '#FF9800',
  },
  error: {
    color: '#F44336',
  },
  warningBox: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    padding: SPACING.sm,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FF9800',
    marginTop: SPACING.sm,
  },
  warningText: {
    color: '#FF9800',
    fontSize: 11,
    textAlign: 'center',
  },
  testButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.sm,
    borderRadius: 4,
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  testButtonDisabled: {
    backgroundColor: '#666',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
