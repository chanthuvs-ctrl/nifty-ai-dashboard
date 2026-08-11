
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyA...',
  authDomain: 'nifty-ai-dashboard.firebaseapp.com',
  projectId: 'nifty-ai-dashboard',
  storageBucket: 'nifty-ai-dashboard.appspot.com',
  messagingSenderId: '1088517228800',
  appId: '1:1088517228800:web:96e25539a2ef77aa6e4099'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

(async () => {
  try {
    const snap = await getDocs(collection(db, 'Transactions'));
    console.log('Found transactions in Firestore:', snap.size);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'Transactions', d.id));
    }
    console.log('Successfully deleted all Firestore transactions!');
  } catch (e) {
    console.error('Firestore delete error:', e);
  }
  process.exit(0);
})();
