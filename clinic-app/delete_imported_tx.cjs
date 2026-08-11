
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAHCiwoA22M-SaTuoQ1zoLj1QLDtt2gOeY',
  authDomain: 'de-natura-hrms.firebaseapp.com',
  projectId: 'de-natura-hrms',
  storageBucket: 'de-natura-hrms.firebasestorage.app',
  messagingSenderId: '116316629474',
  appId: '1:116316629474:web:dbca674c0211bc8bbc71bb'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

(async () => {
  try {
    const snap = await getDocs(collection(db, 'Transactions'));
    console.log('Total transactions in Firestore:', snap.size);
    let deletedCount = 0;
    for (const d of snap.docs) {
      const data = d.data();
      const id = d.id;
      const desc = data.description || '';
      if (id.includes('sheet') || id.includes('bulk') || desc.includes('Imported')) {
        await deleteDoc(doc(db, 'Transactions', id));
        deletedCount++;
      }
    }
    console.log('Successfully deleted imported transactions count:', deletedCount);
  } catch (e) {
    console.error('Delete error:', e.message);
  }
  process.exit(0);
})();
