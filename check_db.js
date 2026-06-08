import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function check() {
  const qSnap = await getDocs(collection(db, "questions"));
  console.log("Questions count:", qSnap.size);
  if (qSnap.size > 0) {
    console.log("Sample question:", JSON.stringify(qSnap.docs[0].data(), null, 2));
  }
}
check().catch(console.error);
