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
