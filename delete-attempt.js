import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const attemptsSnap = await getDocs(collection(db, "attempts"));
  for (const attemptDoc of attemptsSnap.docs) {
    const data = attemptDoc.data();
    if (data.student_email !== "student@mru.ac.in") {
      console.log(`Deleting attempt ${attemptDoc.id} for ${data.student_email}`);
      await deleteDoc(attemptDoc.ref);
    }
  }
  console.log("Done");
  process.exit(0);
}
run().catch(console.error);
