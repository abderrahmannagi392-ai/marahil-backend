/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Detect if we are running in a Capacitor app
const isNative = window.location.protocol === 'http:' || window.location.protocol === 'https:' && window.location.hostname === 'localhost';

export async function signIn() {
  try {
    // In native mobile apps, sometimes Popup fails, so we can try redirect if needed
    // or just use popup with a more descriptive error check
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/operation-not-supported-in-this-environment') {
      // Fallback for environments where popup isn't supported
      return await signInWithRedirect(auth, googleProvider);
    }
    console.error("Error signing in", error);
    alert("حدث خطأ في تسجيل الدخول. تأكد من إضافة 'localhost' إلى Authorized Domains في Firebase Console وإضافة بصمة SHA-1.");
    throw error;
  }
}

// Check for redirect result on load
getRedirectResult(auth).catch(err => console.error("Redirect error", err));

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
