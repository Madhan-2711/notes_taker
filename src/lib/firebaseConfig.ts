import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Determine if Firebase has valid configuration (not empty strings)
const hasValidConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | undefined;
let auth: Auth;
let db: Firestore;
let googleProvider: GoogleAuthProvider;

if (hasValidConfig) {
  // Initialize Firebase only if we have the config and it's not already initialized
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();

  // Enable persistent session management (can also use indexedDBLocalPersistence)
  if (typeof window !== "undefined") {
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error("Auth persistence error:", error);
    });
  }
} else {
  // Provide stubs so that the app can compile and render without Firebase credentials.
  // All auth-dependent features will show the signed-out state.
  console.warn(
    "Firebase credentials are missing or empty. The app will run in offline/preview mode."
  );

  // Create lightweight proxy stubs that won't crash when accessed
  auth = new Proxy({} as Auth, {
    get(_, prop) {
      if (prop === "currentUser") return null;
      if (prop === "onAuthStateChanged") return (_cb: unknown) => () => {};
      return undefined;
    },
  });

  db = new Proxy({} as Firestore, {
    get() {
      return undefined;
    },
  });

  googleProvider = {} as GoogleAuthProvider;
}

export { app, auth, db, googleProvider, hasValidConfig };
