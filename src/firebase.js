import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyDxcUtu5oBQ7sEI3MjEv2sgEdqjJMh_ias",
  authDomain: "repertorioshow-4bc0a.firebaseapp.com",
  projectId: "repertorioshow-4bc0a",
  storageBucket: "repertorioshow-4bc0a.firebasestorage.app",
  messagingSenderId: "573236890677",
  appId: "1:573236890677:web:da23b3e24b6853ce17757c"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)