import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAHCiwoA22M-SaTuoQ1zoLj1QLDtt2gOeY',
  authDomain: 'de-natura-hrms.firebaseapp.com',
  projectId: 'de-natura-hrms',
  storageBucket: 'de-natura-hrms.firebasestorage.app',
  messagingSenderId: '116316629474',
  appId: '1:116316629474:web:dbca674c0211bc8bbc71bb'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
