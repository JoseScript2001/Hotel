// Importaciones de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  FacebookAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAwGDZCWHRm5hWTF3rEeSnotOWPF4ZokAE",
  authDomain: "joseluis-2f95c.firebaseapp.com",
  projectId: "joseluis-2f95c",
  storageBucket: "joseluis-2f95c.firebasestorage.app",
  messagingSenderId: "974147578203",
  appId: "1:974147578203:web:7a8c2a371a8f8ec404d27e"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Establecer persistencia local para mantener la sesión del usuario
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Error al configurar la persistencia:", error);
  });

// Configuración del proveedor de Facebook
const facebookProvider = new FacebookAuthProvider();
// Añadir ámbitos (scopes) para obtener más información del perfil
facebookProvider.addScope('email');
facebookProvider.addScope('public_profile');
// Configurar para mostrar selección de cuenta
facebookProvider.setCustomParameters({
  'display': 'popup'
});

// Configuración del proveedor de GitHub
const githubProvider = new GithubAuthProvider();
// Añadir ámbitos para obtener más información del perfil
githubProvider.addScope('user');
githubProvider.addScope('user:email');
// Configurar para mostrar selección de cuenta
githubProvider.setCustomParameters({
  'allow_signup': 'true'
});

// Exportar todo lo que necesitamos
export {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  FacebookAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  facebookProvider,
  githubProvider,
  onAuthStateChanged,
  signOut,
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit
};