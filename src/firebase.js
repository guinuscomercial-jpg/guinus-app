import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC1nY16Syzk94PC7KcwrI_Y3IzY7v5bKzs",
  authDomain: "guinus-app.firebaseapp.com",
  projectId: "guinus-app",
  storageBucket: "guinus-app.firebasestorage.app",
  messagingSenderId: "180715341971",
  appId: "1:180715341971:web:48bf14583a085f4799e566",
  measurementId: "G-XHZ9EM5KNP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
