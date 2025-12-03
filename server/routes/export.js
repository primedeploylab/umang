const express = require('express');
const PDFDocument = require('pdfkit');
const Submission = require('../models/Submission');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const getMemberNames = (members) => {
  if (!members || !members.length) return '-';
  return members.join(', ');
};

// Export as PDF
router.get('/pdf', authMiddleware, async (req, res) => {
  try {
    const submissions = await Submission.find({ dmartCode: req.admin.dmartCode }).sort({ createdAt: -1 });
    
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=submissions-${req.admin.dmartCode}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text(`DMart Umang - Store ${req.admin.dmartCode}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    const total = submissions.length;
    const duplicates = submissions.filter(s => s.isDuplicate).length;
    doc.fontSize(11).font('Helvetica-Bold').text(`Total Submissions: ${total} | Duplicates: ${duplicates}`);
    doc.moveDown(1);

    const startX = 40;
    let y = doc.y;
    const colWidths = [80, 70, 200, 180, 70];
    const headers = ['Dept', 'Shift', 'Members', 'Song', 'Status'];

    doc.fontSize(9).font('Helvetica-Bold');
    doc.rect(startX, y, 750, 18).fill('#f0f0f0');
    doc.fillColor('#000');
    
    let x = startX + 5;
    headers.forEach((header, i) => {
      doc.text(header, x, y + 5, { width: colWidths[i] - 10 });
      x += colWidths[i];
    });
    y += 20;

    doc.font('Helvetica').fontSize(8);
    submissions.forEach((sub, index) => {
      if (y > 520) {
        doc.addPage();
        y = 40;
      }

      if (index % 2 === 0) {
        doc.rect(startX, y, 750, 16).fill('#fafafa');
        doc.fillColor('#000');
      }

      x = startX + 5;
      const row = [
        sub.department?.slice(0, 12) || '-',
        sub.shift?.slice(0, 10) || '-',
        getMemberNames(sub.members).slice(0, 40),
        sub.songName?.slice(0, 35) || '-',
        sub.isDuplicate ? 'DUPLICATE' : 'OK'
      ];

      row.forEach((cell, i) => {
        doc.fillColor(i === 4 && sub.isDuplicate ? '#e74c3c' : '#000');
        doc.text(cell, x, y + 4, { width: colWidths[i] - 10 });
        x += colWidths[i];
      });
      y += 18;
    });

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Export as Excel
router.get('/excel', authMiddleware, async (req, res) => {
  try {
    const submissions = await Submission.find({ dmartCode: req.admin.dmartCode }).sort({ createdAt: -1 });
    
    const headers = ['Department', 'Shift', 'Type', 'Members', 'Song Name', 'YouTube Link', 'Audio File', 'Status', 'Submitted At'];
    
    const rows = submissions.map(sub => [
      sub.department || '',
      sub.shift || '',
      sub.gender || '',
      getMemberNames(sub.members),
      sub.songName || '',
      sub.youtubeLink || '',
      sub.audioFileUrl || '',
      sub.isDuplicate ? 'DUPLICATE' : 'OK',
      sub.createdAt ? new Date(sub.createdAt).toLocaleString() : ''
    ]);

    const escapeCSV = (str) => {
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let csv = headers.map(escapeCSV).join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => escapeCSV(String(cell))).join(',') + '\n';
    });

    const bom = '\uFEFF';
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=submissions-${req.admin.dmartCode}.csv`);
    res.send(bom + csv);
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;
