import { Redirect } from 'expo-router';
import InitialLoadingScreen from './components/InitialLoadingScreen';
import { useState, useEffect } from 'react';

export default function Index() {
  const [showLoading, setShowLoading] = useState(true);

  const handleLoadingFinish = () => {
    setShowLoading(false);
  };

  if (showLoading) {
    return <InitialLoadingScreen onFinish={handleLoadingFinish} />;
  }

  return <Redirect href="/(tabs)" />;
} 