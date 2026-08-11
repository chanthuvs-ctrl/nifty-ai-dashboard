
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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

const users = [
  { email: 'admin@clinic.com', password: 'password123', role: 'Admin', name: 'Clinic Admin', designation: 'Admin', basicSalary: 0 },
  { email: 'viji@clinic.com', password: 'password123', role: 'Employee', name: 'Viji S', designation: 'Staff Nurse', basicSalary: 15000 },
  { email: 'amrutha@clinic.com', password: 'password123', role: 'Employee', name: 'Amrutha M S', designation: 'Staff Nurse', basicSalary: 18000 },
  { email: 'subhadra@clinic.com', password: 'password123', role: 'Employee', name: 'Subhadra C K', designation: 'Customer Relation Manager', basicSalary: 18000 },
  { email: 'aparna@clinic.com', password: 'password123', role: 'Employee', name: 'Aparnendhu', designation: 'Customer Relation Executive', basicSalary: 11000 },
  { email: 'deepthy@clinic.com', password: 'password123', role: 'Employee', name: 'Deepthy', designation: 'Staff', basicSalary: 15000 },
  { email: 'anagha@clinic.com', password: 'password123', role: 'Employee', name: 'Dr Anagha S Nath', designation: 'Facial Aesthetic Surgeon', basicSalary: 66000 }
];

async function seed() {
  for (const u of users) {
    let uid = null;
    try {
      const userCred = await createUserWithEmailAndPassword(auth, u.email, u.password);
      uid = userCred.user.uid;
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        const userCred = await signInWithEmailAndPassword(auth, u.email, u.password);
        uid = userCred.user.uid;
      } else {
        console.log('Error auth ' + u.name + ':', e.message);
      }
    }
    
    if (uid) {
      try {
        await setDoc(doc(db, 'Users', uid), {
          uid: uid,
          name: u.name,
          email: u.email,
          role: u.role,
          designation: u.designation,
          basicSalary: u.basicSalary,
          forcePasswordChange: true
        });
        console.log('Created DB Record:', u.name);
      } catch (err) {
        console.log('Error DB ' + u.name + ':', err.message);
      }
    }
  }
  process.exit(0);
}
seed();
