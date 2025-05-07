# Firebase Setup for MindMuscle.AI

This guide will help you set up Firebase Storage for handling progress photos in the MindMuscle.AI application, with full compatibility for Expo Go.

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/) and sign in with your Google account.
2. Click "Add project" and follow the prompts to create a new Firebase project.
3. Name your project (e.g., "MindMuscle-AI").
4. Enable Google Analytics if needed.
5. Click "Create project" and wait for it to complete.

## Step 2: Configure Firebase Storage

1. In your Firebase project dashboard, navigate to "Storage" in the left sidebar.
2. Click "Get started" and follow the prompts to set up Cloud Storage.
3. Choose a starting mode for your security rules. For development with Expo Go, choose "Start in test mode" to allow unauthenticated access.
4. Choose a storage location closest to your users.
5. Click "Done" to complete the setup.

## Important: Set Proper Security Rules for Testing

For testing with Expo Go, your Storage security rules must allow unauthenticated access. Go to Firebase Console > Storage > Rules and set:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;  // WARNING: For development testing only
    }
  }
}
```

**Warning:** These rules allow anyone to read and write to your storage. Use them only for development and testing. Set proper security rules before deploying to production.

## Step 3: Enable CORS for Firebase Storage

For Expo Go to properly upload files to Firebase Storage, you need to enable CORS:

1. Install the Firebase CLI if you don't have it: `npm install -g firebase-tools`
2. Log in to your Firebase account: `firebase login`
3. Create a file named `cors.json` with the following content:
```json
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "maxAgeSeconds": 3600
  }
]
```
4. Set the CORS configuration with this command:
```
gsutil cors set cors.json gs://YOUR-FIREBASE-BUCKET
```
Replace `YOUR-FIREBASE-BUCKET` with your actual bucket name (e.g., `mindmuscle-dev.appspot.com`).

## Step 4: Register Your Web App with Firebase

We're using Firebase's Web SDK with Expo, so we only need to register a web app:

1. From your Firebase project dashboard, click the web icon (</>) to add a web app.
2. Register your app with a nickname (e.g., "MindMuscle-AI-Web").
3. Click "Register app."
4. Firebase will provide you with a configuration object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id",
  measurementId: "your-measurement-id"
};
```

5. Copy these values as you'll need them for the next step.

## Step 5: Update Environment Variables

1. Open the `.env` file in your project root.
2. Add the following Firebase configuration values from your web app:

```
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

Replace the placeholder values with your actual Firebase configuration values.

## Step 6: Firebase Storage Security Rules (Production Only)

For production, update your Firebase Storage security rules to ensure proper access control:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to read all files
    match /{allPaths=**} {
      allow read: if request.auth != null;
    }
    
    // Allow users to write only to their own files
    match /progress-photos/{userId}/{fileName} {
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

These rules ensure that:
- Only authenticated users can read files
- Users can only upload/modify files in their own user directory

**Note for Expo Go users:** For testing in Expo Go, keep the security rules in test mode which allows unauthenticated access. The rules above should be used for production builds only.

## Step 7: Authentication Integration (Production Only)

To make the security rules work in production, you need to integrate Firebase Authentication with Supabase Auth:

1. In the Firebase console, go to Authentication and enable the desired providers (at minimum, Email/Password).
2. When a user authenticates with Supabase, you should also sign them in with Firebase using a custom token:

```typescript
// Example of integrating Firebase auth with Supabase auth
import { getAuth, signInWithCustomToken } from "firebase/auth";
import { app } from './firebase';

// This function would be called after Supabase authentication
async function syncFirebaseAuth(supabaseUser) {
  // Get a custom token from your backend that creates Firebase tokens based on Supabase auth
  // This requires a server-side function that uses Firebase Admin SDK
  const tokenResponse = await fetch('/api/createFirebaseToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: supabaseUser.id })
  });
  
  const { firebaseToken } = await tokenResponse.json();
  
  // Sign in to Firebase with the custom token
  const auth = getAuth(app);
  await signInWithCustomToken(auth, firebaseToken);
}
```

Note: For development with Expo Go, you can use the test mode in Firebase Storage rules which doesn't require authentication.

## Step 8: Test the Implementation

1. After setting up Firebase and updating your environment variables, restart your development server.
2. If using Expo Go, ensure you're using the latest implementation which uses FileSystem.uploadAsync instead of Blob-based methods.
3. Navigate to the "Insights" tab in your app.
4. Try uploading a progress photo to test if the Firebase integration is working correctly.
5. You should see the uploaded photos in your Firebase Storage console.

## Expo Go Compatibility

The implementation uses Expo FileSystem's uploadAsync method rather than Blob-based APIs to ensure compatibility with Expo Go. This is important because:

- Expo Go has limited support for ArrayBuffer and Blob APIs
- The standard Firebase SDK methods use these APIs which can cause errors in Expo Go
- Our implementation uses direct HTTP uploads via Expo's FileSystem module which is fully supported in Expo Go

## Troubleshooting 403 Permission Denied Errors

If you're seeing "403 Permission denied" errors when uploading to Firebase Storage:

1. **Check Security Rules**: Make sure your Firebase Storage security rules are set to test mode as shown in "Important: Set Proper Security Rules for Testing" above.

2. **API Key in Upload URL**: Ensure that your API key is correctly set in the environment variables and is included in the upload URL.

3. **Firebase Authentication**: For development in Expo Go, you should have security rules allowing unauthenticated access. If you're still getting 403 errors, it could be that your API key has restrictions set. Check your Firebase project settings.

4. **CORS Configuration**: Confirm that you've set up the CORS configuration correctly. You might need to wait a few minutes for CORS settings to propagate.

5. **Test in Firebase Console**: Try uploading a file directly in the Firebase Console to confirm that your bucket is working correctly.

6. **Check Storage Location**: Make sure you're using the correct Storage bucket name. It should match the one in your Firebase project.

7. **API Key Restrictions**: Check if your Firebase API key has any restrictions that could be blocking the uploads. Go to Firebase Console > Project Settings > API keys and check for restrictions.

## General Troubleshooting

If you encounter issues:

1. **Firebase Upload Fails in Expo Go**:
   - Make sure you've enabled CORS for your Firebase Storage bucket
   - Verify that your Firebase Storage is set to test mode for development
   - Check that the correct storage bucket name is being used

2. **403 Forbidden Errors**:
   - This is typically a CORS issue - make sure you've set up CORS properly
   - If in production, check that authentication is working correctly
   - For Expo Go testing, make sure Firebase Storage is in test mode

3. **Cannot Access Photos**:
   - Check the download URLs in your database
   - Ensure tokens are included in the URL (downloadToken parameter)
   - Verify the bucket name is correct in all URLs

4. **Expo Go Specific Issues**:
   - Update to the latest Expo SDK if possible
   - Make sure you're using the FileSystem.uploadAsync method and not Blob APIs
   - For persistent issues, test on a development build instead of Expo Go

For more detailed Firebase Storage documentation, visit the [official Firebase documentation](https://firebase.google.com/docs/storage). 