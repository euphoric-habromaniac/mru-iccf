import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function runAudit() {
  console.log("Starting DB Integrity Audit...");
  let errors = 0;
  
  try {
    const qSnap = await getDocs(collection(db, "questions"));
    const questions = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const aSnap = await getDocs(collection(db, "assessments"));
    const assessments = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Auditing ${questions.length} questions and ${assessments.length} assessments...`);

    // 1. Audit Questions
    const globalQuestionIds = new Set(questions.map(q => q.id));
    for (const q of questions) {
      if (!q.competencyId && !q.competency_id) {
        console.error(`[ERROR] Question ${q.id} is missing a competencyId link!`);
        errors++;
      }
    }

    // 2. Audit Assessments
    for (const a of assessments) {
      if (a.questions && a.questions.length > 0) {
        console.warn(`[WARN] Assessment ${a.id} STILL has an embedded 'questions' array! Migration may be incomplete.`);
        errors++;
      }

      if (a.questionIds && Array.isArray(a.questionIds)) {
        for (const qId of a.questionIds) {
          if (!globalQuestionIds.has(qId)) {
            console.error(`[ERROR] Assessment ${a.id} references non-existent Question ID: ${qId}`);
            errors++;
          }
        }
      } else {
        console.warn(`[WARN] Assessment ${a.id} has no questionIds.`);
      }
    }

    if (errors === 0) {
      console.log("✅ DB Integrity Audit Passed! No relational errors found.");
    } else {
      console.error(`❌ DB Integrity Audit Failed with ${errors} issues.`);
    }
  } catch (e) {
    console.error("Audit script crashed:", e);
    process.exit(1);
  }
}

runAudit();
