import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "euphoric-habromaniac", // from earlier logs or default emulator project
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const attemptsSnap = await getDocs(collection(db, "attempts"));
  for (const attemptDoc of attemptsSnap.docs) {
    const data = attemptDoc.data();
    console.log(`Attempt ${attemptDoc.id} | Email: ${data.student_email} | UID: ${data.userId} | Score: ${data.overallScore}`);
  }
}
run().catch(console.error);
