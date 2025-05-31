#!/usr/bin/env node

/**
 * Sentry Features Test Script
 *
 * This script helps you test and verify that Sentry is properly capturing:
 * 1. Logs (console messages)
 * 2. Traces (performance transactions)
 * 3. Errors and exceptions
 *
 * Run this script to generate test data for your Sentry dashboard.
 */

console.log('🚀 Starting Sentry Features Test...');
console.log('📊 This will generate test data for Logs, Traces, and Issues');
console.log('');

// Test console logging (these should appear as breadcrumbs and logs in Sentry)
console.log('✅ Testing console.log - this should appear in Sentry breadcrumbs');
console.info('ℹ️ Testing console.info - this should appear in Sentry breadcrumbs');
console.warn('⚠️ Testing console.warn - this should appear in Sentry breadcrumbs');
console.error('❌ Testing console.error - this should appear in Sentry as an error');

console.log('');
console.log('📝 Console logging tests completed');
console.log('');

// Simulate some async operations that would generate traces
console.log('🔄 Simulating operations that generate traces...');

// Simulate API calls
console.log('📡 Simulating API call...');
setTimeout(() => {
  console.log('✅ API call completed (200ms)');
}, 200);

// Simulate database operations
setTimeout(() => {
  console.log('🗄️ Simulating database query...');
  setTimeout(() => {
    console.log('✅ Database query completed (150ms)');
  }, 150);
}, 300);

// Simulate navigation
setTimeout(() => {
  console.log('🧭 Simulating screen navigation...');
  setTimeout(() => {
    console.log('✅ Screen navigation completed (100ms)');
  }, 100);
}, 500);

// Simulate an error after some time
setTimeout(() => {
  console.log('💥 Simulating an error...');
  console.error('Test error: Something went wrong in the background process');
}, 800);

setTimeout(() => {
  console.log('');
  console.log('✅ All tests completed!');
  console.log('');
  console.log('📊 Check your Sentry dashboard for:');
  console.log('   • Issues: Look for the test errors');
  console.log('   • Performance: Look for transaction traces');
  console.log('   • Discover: Search for console messages');
  console.log('');
  console.log("🔍 If you don't see data, make sure:");
  console.log('   • Your app is running with the updated Sentry configuration');
  console.log("   • You're using the app to trigger the console integration");
  console.log('   • Your DSN is correctly configured');
  console.log("   • You're looking in the correct Sentry project");
}, 1000);
