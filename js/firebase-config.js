import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDDx1wnAkSFz_KD390zGBZ6MCVTg2AUBqQ",
  authDomain: "contecs-utp.firebaseapp.com",
  projectId: "contecs-utp",
  storageBucket: "contecs-utp.firebasestorage.app",
  messagingSenderId: "466540948691",
  appId: "1:466540948691:web:35a2c84a48075b2a28f826",
  measurementId: "G-35QT8RCYE8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
