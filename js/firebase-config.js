import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAXKnBgFf9XhtJol7wv8LsJcjohouhgVdQ",
  authDomain: "contects-54be8.firebaseapp.com",
  projectId: "contects-54be8",
  storageBucket: "contects-54be8.firebasestorage.app",
  messagingSenderId: "297469621506",
  appId: "1:297469621506:web:a4c2c5c1685480e0db3e1b",
  measurementId: "G-EWM3P4JP4P"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
