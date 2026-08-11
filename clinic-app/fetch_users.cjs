
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAHCiwoA22M-SaTuoQ1zoLj1QLDtt2gOeY',
  authDomain: 'de-natura-hrms.firebaseapp.com',
  projectId: 'de-natura-hrms',
  storageBucket: 'de-natura-hrms.firebasestorage.app',
  messagingSenderId: '116316629474',
  appId: '1:116316629474:web:dbca674c0211bc8bbc71bb'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const passwords = ['admin', 'admin123', 'admin1234', '123456', 'password', 'denatura123', 'admin@123'];

async function run() {
  for (const p of passwords) {
    try {
      console.log('Trying password:', p);
      const cred = await signInWithEmailAndPassword(auth, 'admin@clinic.com', p);
      console.log('SUCCESS! Admin Password is:', p);
      const snap = await getDocs(collection(db, 'Users'));
      console.log('TOTAL FIRESTORE USERS COUNT:', snap.docs.length);
      snap.docs.forEach(d => {
        console.log('DOC ID:', d.id);
        console.log(JSON.stringify(d.data(), null, 2));
      });
      process.exit(0);
    } catch (e) {
      console.log('Failed for:', p, e.code);
    }
  }
}

run();
