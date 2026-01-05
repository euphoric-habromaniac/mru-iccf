import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

const competencies = [
  { id: "comp_2", name: "Effective Communication" },
  { id: "comp_3", name: "Problem Solving" },
  { id: "comp_4", name: "Critical Thinking" },
  { id: "comp_5", name: "Empathy" },
  { id: "comp_6", name: "Adaptability" },
  { id: "comp_7", name: "Teamwork" },
  { id: "comp_8", name: "Conflict Resolution" },
  { id: "comp_9", name: "Leadership" },
  { id: "comp_10", name: "Creativity" },
  { id: "comp_11", name: "Digital Literacy" },
  { id: "comp_12", name: "Ethical Reasoning" },
  { id: "comp_13", name: "Global Awareness" },
  { id: "comp_14", name: "Civic Engagement" },
  { id: "comp_15", name: "Financial Literacy" }
];

async function run() {
  const usersSnap = await getDocs(collection(db, "users"));
  let studentId = "";
  for (const u of usersSnap.docs) {
    if (u.data().email === "student@mru.ac.in") {
      studentId = u.id;
      break;
    }
  }

  if (!studentId) {
    console.log("No student found");
    process.exit(1);
  }

  for (const comp of competencies) {
    const attemptId = `att_${Date.now()}_${comp.id}`;
    const score = 25 + Math.floor(Math.random() * 10); // mostly positive: 25-34 raw score (out of 35)
    const percentage = Math.round(((score - 7) / 28) * 100);

    const docRef = doc(db, "attempts", attemptId);
    await setDoc(docRef, {
      id: attemptId,
      userId: studentId,
      student_email: "student@mru.ac.in",
      assessmentId: "assessment_" + comp.id,
      timestamp: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      assessment_type: "likert",
      overallScore: percentage,
      skillScores: {
        [comp.id]: score
      },
      certificationStatus: "Certified"
    });
    console.log(`Seeded ${comp.name} with score ${score}`);
    await new Promise(r => setTimeout(r, 100)); // Sleep slightly to ensure distinct timestamps
  }

  console.log("Done seeding");
  process.exit(0);
}
run().catch(console.error);
