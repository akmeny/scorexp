// Firebase config (Firebase Console’dan kendi projenin ayarlarını kopyalayacaksın)
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "SENIN_API_KEYIN",
  authDomain: "senin-proje-id.firebaseapp.com",
  projectId: "senin-proje-id",
  storageBucket: "senin-proje-id.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
