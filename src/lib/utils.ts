import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { jsPDF } from 'jspdf';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateCertificate = (studentName: string, assessmentName: string, dateStr: string, score: number) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Certificate Border
  doc.setLineWidth(5);
  doc.setDrawColor(242, 125, 38); // #F27D26 orange
  doc.rect(10, 10, 277, 190);

  // Inner Border
  doc.setLineWidth(1);
  doc.setDrawColor(20, 20, 20); // #141414
  doc.rect(15, 15, 267, 180);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(40);
  doc.setTextColor(20, 20, 20);
  doc.text('CERTIFICATE OF COMPETENCY', 148.5, 50, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.text('This is to certify that', 148.5, 75, { align: 'center' });

  // Student Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(242, 125, 38);
  doc.text(studentName.toUpperCase(), 148.5, 95, { align: 'center' });

  // Body
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text('has successfully completed the assessment for', 148.5, 115, { align: 'center' });

  // Assessment Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(assessmentName.toUpperCase(), 148.5, 135, { align: 'center' });

  // Score
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.text(`Achieving a score of ${score}% and earning the status of CERTIFIED.`, 148.5, 150, { align: 'center' });

  // Date and Signatures
  doc.setFontSize(12);
  doc.text(`Date of Issue: ${dateStr}`, 50, 180);
  
  doc.setLineWidth(0.5);
  doc.line(200, 175, 260, 175);
  doc.text('Authorized Signature', 230, 180, { align: 'center' });

  // Header/Institution
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('MANAV RACHNA UNIVERSITY ICCF', 148.5, 30, { align: 'center' });

  // Download
  doc.save(`${studentName.replace(/[^a-zA-Z0-9]/g, '_')}_${assessmentName.replace(/[^a-zA-Z0-9]/g, '_')}_Certificate.pdf`);
};

export const generateRandomPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let pwd = '';
  for (let i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
};

export const parseCsvOrTsv = (text: string, isTsv: boolean) => {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || !lines[0]) return { headers: [], rows: [] };
  
  const splitLine = (line: string) => {
    if (isTsv) return line.split('\t');
    
    // Split CSV supporting double-quoted fields
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = splitLine(lines[i]);
    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[header] = values[index] || '';
    });
    rows.push(rowObj);
  }
  
  return { headers, rows };
};

export const mapStudentRow = (row: Record<string, string>, departments: any[]) => {
  const nameKeys = ['name', 'fullname', 'studentname', 'username'];
  const rollKeys = ['rollnumber', 'rollno', 'roll', 'id', 'studentid'];
  const classKeys = ['class', 'section', 'semester', 'sem', 'year'];
  const majorKeys = ['major', 'course', 'branch', 'specialization'];
  const deptKeys = ['department', 'dept'];
  const phoneKeys = ['phonenumber', 'phone', 'mobile', 'contact', 'tel'];
  const emailKeys = ['email', 'emailid', 'address', 'mail'];
  const pwdKeys = ['password', 'pass', 'pwd'];

  const getVal = (keys: string[]) => {
    const key = keys.find(k => k in row);
    return key ? row[key] : '';
  };

  const deptInput = getVal(deptKeys).toLowerCase();
  const deptMatch = departments.find(d => d.name.toLowerCase() === deptInput || d.id.toLowerCase() === deptInput);
  const deptId = deptMatch ? deptMatch.id : (departments[0]?.id || 'CSE');

  return {
    name: getVal(nameKeys),
    rollNumber: getVal(rollKeys),
    class: getVal(classKeys),
    major: getVal(majorKeys),
    department: deptId,
    phoneNumber: getVal(phoneKeys),
    email: getVal(emailKeys),
    password: getVal(pwdKeys) || generateRandomPassword()
  };
};

export const mapTeacherRow = (row: Record<string, string>, departments: any[]) => {
  const nameKeys = ['name', 'fullname', 'teachername', 'facultyname', 'username'];
  const subjectKeys = ['subject', 'course', 'class', 'paper', 'specialization'];
  const deptKeys = ['department', 'dept'];
  const phoneKeys = ['phonenumber', 'phone', 'mobile', 'contact', 'tel'];
  const emailKeys = ['email', 'emailid', 'address', 'mail'];
  const pwdKeys = ['password', 'pass', 'pwd'];

  const getVal = (keys: string[]) => {
    const key = keys.find(k => k in row);
    return key ? row[key] : '';
  };

  const deptInput = getVal(deptKeys).toLowerCase();
  const deptMatch = departments.find(d => d.name.toLowerCase() === deptInput || d.id.toLowerCase() === deptInput);
  const deptId = deptMatch ? deptMatch.id : (departments[0]?.id || 'CSE');

  return {
    name: getVal(nameKeys),
    subject: getVal(subjectKeys),
    department: deptId,
    phoneNumber: getVal(phoneKeys),
    email: getVal(emailKeys),
    password: getVal(pwdKeys) || generateRandomPassword()
  };
};

export const generateStudentScorecardPDF = (
  studentName: string,
  email: string,
  assessmentName: string,
  dateStr: string,
  score: number,
  duration: string,
  competencies: { name: string; score: number; level: number; label: string }[]
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Top header color band
  doc.setFillColor(20, 20, 20); // #141414
  doc.rect(0, 0, 210, 35, 'F');
  doc.setFillColor(242, 125, 38); // #F27D26
  doc.rect(0, 35, 210, 4, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('COMPETENCY TRANSCRIPT', 15, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Manav Rachna ICCF Certification System', 15, 28);

  // Student details section
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT PROFILE', 15, 52);
  doc.setLineWidth(0.3);
  doc.setDrawColor(202, 202, 202);
  doc.line(15, 54, 195, 54);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Name:`, 15, 62);
  doc.setFont('helvetica', 'bold');
  doc.text(`${studentName.toUpperCase()}`, 35, 62);

  doc.setFont('helvetica', 'normal');
  doc.text(`Email:`, 15, 68);
  doc.setFont('helvetica', 'bold');
  doc.text(`${email}`, 35, 68);

  doc.setFont('helvetica', 'normal');
  doc.text(`Assessment:`, 110, 62);
  doc.setFont('helvetica', 'bold');
  doc.text(`${assessmentName}`, 135, 62);

  doc.setFont('helvetica', 'normal');
  doc.text(`Date / Time:`, 110, 68);
  doc.setFont('helvetica', 'bold');
  doc.text(`${dateStr}`, 135, 68);

  // Results Overview
  doc.setFont('helvetica', 'bold');
  doc.text('PERFORMANCE OVERVIEW', 15, 82);
  doc.line(15, 84, 195, 84);

  doc.setFont('helvetica', 'normal');
  doc.text(`Overall Score:`, 15, 92);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(242, 125, 38);
  doc.text(`${score}%`, 45, 92);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(`Time Taken:`, 110, 92);
  doc.setFont('helvetica', 'bold');
  doc.text(`${duration || 'N/A'}`, 135, 92);

  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(15, 105, 180, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPETENCY', 18, 110);
  doc.text('SCORE', 105, 110);
  doc.text('LEVEL', 130, 110);
  doc.text('DESCRIPTOR', 155, 110);
  doc.line(15, 113, 195, 113);

  let y = 120;
  doc.setFont('helvetica', 'normal');
  competencies.forEach(c => {
    doc.text(c.name, 18, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${c.score}%`, 105, y);
    doc.text(`L${c.level}`, 130, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(c.label || 'Competent', 155, y);
    doc.setFontSize(9);
    doc.line(15, y + 3, 195, y + 3);
    y += 10;
  });

  // Footer note
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('This is an official Institutional Competency Framework transcript. Certified records are recorded on database logs.', 105, 280, { align: 'center' });

  doc.save(`${studentName.replace(/\s+/g, '_')}_scorecard.pdf`);
};

export const generateAssessmentReportPDF = (
  assessmentName: string,
  deptName: string,
  minScore: number,
  attemptsCount: number,
  passRate: number,
  avgScore: number,
  attempts: { studentName: string; studentEmail: string; score: number; level: number; status: string; date: string }[]
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Top header color band
  doc.setFillColor(20, 20, 20); // #141414
  doc.rect(0, 0, 210, 35, 'F');
  doc.setFillColor(242, 125, 38); // #F27D26
  doc.rect(0, 35, 210, 4, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('ASSESSMENT PERFORMANCE REPORT', 15, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Department: ${deptName} | Min Pass Score: ${minScore}%`, 15, 28);

  // Statistics Summary
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ASSESSMENT SUMMARY', 15, 52);
  doc.setLineWidth(0.3);
  doc.setDrawColor(202, 202, 202);
  doc.line(15, 54, 195, 54);

  doc.setFont('helvetica', 'normal');
  doc.text('Title:', 15, 62);
  doc.setFont('helvetica', 'bold');
  doc.text(assessmentName, 40, 62);

  doc.setFont('helvetica', 'normal');
  doc.text('Total Attempts:', 15, 68);
  doc.setFont('helvetica', 'bold');
  doc.text(String(attemptsCount), 40, 68);

  doc.setFont('helvetica', 'normal');
  doc.text('Average Score:', 110, 62);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(242, 125, 38);
  doc.text(`${avgScore}%`, 140, 62);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  doc.text('Pass Rate:', 110, 68);
  doc.setFont('helvetica', 'bold');
  doc.text(`${passRate}%`, 140, 68);

  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(15, 80, 180, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('STUDENT NAME', 18, 85);
  doc.text('EMAIL', 65, 85);
  doc.text('DATE', 120, 85);
  doc.text('SCORE', 150, 85);
  doc.text('STATUS', 172, 85);
  doc.line(15, 88, 195, 88);

  let y = 95;
  doc.setFont('helvetica', 'normal');
  attempts.forEach(att => {
    if (y > 270) {
      doc.addPage();
      // redraw headers
      doc.setFillColor(245, 245, 245);
      doc.rect(15, 15, 180, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('STUDENT NAME', 18, 20);
      doc.text('EMAIL', 65, 20);
      doc.text('DATE', 120, 20);
      doc.text('SCORE', 150, 20);
      doc.text('STATUS', 172, 20);
      doc.line(15, 23, 195, 23);
      y = 30;
      doc.setFont('helvetica', 'normal');
    }

    doc.text(att.studentName.toUpperCase().substring(0, 20), 18, y);
    doc.text(att.studentEmail.substring(0, 24), 65, y);
    doc.text(att.date, 120, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${att.score}%`, 150, y);
    doc.text(att.status.toUpperCase(), 172, y);
    doc.setFont('helvetica', 'normal');
    doc.line(15, y + 3, 195, y + 3);
    y += 10;
  });

  doc.save(`Assessment_Report_${assessmentName.replace(/\s+/g, '_')}.pdf`);
};

export const generateDepartmentReportPDF = (
  deptName: string,
  stats: { assessmentsCount: number; studentsCount: number; avgScore: number; passRate: number },
  assessmentsList: { name: string; attempts: number; passRate: number; avgScore: number }[]
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Top header color band
  doc.setFillColor(20, 20, 20); // #141414
  doc.rect(0, 0, 210, 35, 'F');
  doc.setFillColor(242, 125, 38); // #F27D26
  doc.rect(0, 35, 210, 4, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('DEPARTMENT PERFORMANCE REPORT', 15, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Academic Analytics Summary | Department: ${deptName}`, 15, 28);

  // Statistics Summary
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('METRICS SUMMARY', 15, 52);
  doc.setLineWidth(0.3);
  doc.setDrawColor(202, 202, 202);
  doc.line(15, 54, 195, 54);

  doc.setFont('helvetica', 'normal');
  doc.text('Total Assessments:', 15, 62);
  doc.setFont('helvetica', 'bold');
  doc.text(String(stats.assessmentsCount), 50, 62);

  doc.setFont('helvetica', 'normal');
  doc.text('Total Tested Students:', 15, 68);
  doc.setFont('helvetica', 'bold');
  doc.text(String(stats.studentsCount), 50, 68);

  doc.setFont('helvetica', 'normal');
  doc.text('Department Average Score:', 110, 62);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(242, 125, 38);
  doc.text(`${stats.avgScore}%`, 160, 62);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  doc.text('Overall Pass Rate:', 110, 68);
  doc.setFont('helvetica', 'bold');
  doc.text(`${stats.passRate}%`, 160, 68);

  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(15, 80, 180, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ASSESSMENT NAME', 18, 85);
  doc.text('TOTAL ATTEMPTS', 100, 85);
  doc.text('AVG SCORE', 135, 85);
  doc.text('PASS RATE', 165, 85);
  doc.line(15, 88, 195, 88);

  let y = 95;
  doc.setFont('helvetica', 'normal');
  assessmentsList.forEach(a => {
    doc.text(a.name, 18, y);
    doc.text(String(a.attempts), 100, y);
    doc.text(`${a.avgScore}%`, 135, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${a.passRate}%`, 165, y);
    doc.setFont('helvetica', 'normal');
    doc.line(15, y + 3, 195, y + 3);
    y += 10;
  });

  doc.save(`Department_Report_${deptName.replace(/\s+/g, '_')}.pdf`);
};

