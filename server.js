const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const LEADER_KEY = process.env.LEADER_KEY || 'math2026';

// Directories setup
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(SUBMISSIONS_FILE)) fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([], null, 2), 'utf-8');

// Helper to read & write submissions
function getSubmissions() {
  try {
    const raw = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading submissions:', err);
    return [];
  }
}

function saveSubmissions(data) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const ext = path.extname(file.originalname) || '.png';
    const cleanField = file.fieldname.replace(/[^a-zA-Z0-9]/g, '');
    cb(null, `${cleanField}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow all image mime types
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (PNG, JPG, JPEG, WEBP, etc.) are allowed for grade proof.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max per photo
  fileFilter: fileFilter
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// Authentication check middleware for leader routes
function authLeader(req, res, next) {
  const key = req.headers['x-leader-key'] || req.query.key;
  if (!key || key !== LEADER_KEY) {
    return res.status(401).json({ error: 'Unauthorized. Invalid or missing Leader Passcode.' });
  }
  next();
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/apply', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/leaders', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'review.html'));
});

app.get('/review', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'review.html'));
});

// API: Verify Passcode
app.post('/api/verify-leader', (req, res) => {
  const { key } = req.body;
  if (key === LEADER_KEY) {
    return res.json({ valid: true });
  }
  return res.status(401).json({ valid: false, message: 'Invalid Leader Passcode.' });
});

// API: Submit Application
app.post(
  '/api/apply',
  upload.fields([
    { name: 'gradePhotoTerm1', maxCount: 1 },
    { name: 'gradePhotoTerm2', maxCount: 1 }
  ]),
  (req, res) => {
    try {
      const { name, phone, email, about, passion, plans } = req.body;

      if (!name || !phone || !email || !about || !passion || !plans) {
        return res.status(400).json({ error: 'All fields are required.' });
      }

      const files = req.files || {};
      const term1File = files['gradePhotoTerm1'] ? files['gradePhotoTerm1'][0] : null;
      const term2File = files['gradePhotoTerm2'] ? files['gradePhotoTerm2'][0] : null;

      if (!term1File || !term2File) {
        return res.status(400).json({
          error: 'Both Grade Photos (Term 1 and Term 2) are required to be uploaded as photos.'
        });
      }

      const applicantId = 'MMC-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);

      const newSubmission = {
        id: applicantId,
        submittedAt: new Date().toISOString(),
        student: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase()
        },
        grades: {
          term1PhotoUrl: `/uploads/${term1File.filename}`,
          term1OriginalName: term1File.originalname,
          term1Size: term1File.size,
          term2PhotoUrl: `/uploads/${term2File.filename}`,
          term2OriginalName: term2File.originalname,
          term2Size: term2File.size
        },
        responses: {
          about: about.trim(),
          passion: passion.trim(),
          plans: plans.trim()
        },
        review: {
          status: 'Pending Review', // Pending Review, Shortlisted, Interview, Selected, Rejected
          rating: 0, // 0 - 10
          notes: ''
        }
      };

      const submissions = getSubmissions();
      submissions.unshift(newSubmission); // Newest first
      saveSubmissions(submissions);

      console.log(`[+] New application received from: ${name} (${applicantId})`);

      res.status(201).json({
        success: true,
        applicantId: applicantId,
        message: 'Your leadership application has been submitted successfully!'
      });
    } catch (err) {
      console.error('Submission error:', err);
      res.status(500).json({ error: 'Failed to process application. ' + err.message });
    }
  }
);

// API: Get All Submissions (Protected)
app.get('/api/submissions', authLeader, (req, res) => {
  const submissions = getSubmissions();
  res.json({
    total: submissions.length,
    submissions: submissions
  });
});

// API: Update Submission Review (Status, Rating, Notes) (Protected)
app.patch('/api/submissions/:id', authLeader, (req, res) => {
  const { id } = req.params;
  const { status, rating, notes } = req.body;

  const submissions = getSubmissions();
  const index = submissions.findIndex(s => s.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Applicant submission not found.' });
  }

  if (status !== undefined) submissions[index].review.status = status;
  if (rating !== undefined) submissions[index].review.rating = Number(rating);
  if (notes !== undefined) submissions[index].review.notes = notes;
  submissions[index].review.updatedAt = new Date().toISOString();

  saveSubmissions(submissions);

  res.json({
    success: true,
    message: 'Review updated successfully.',
    submission: submissions[index]
  });
});

// API: Delete Submission (Protected)
app.delete('/api/submissions/:id', authLeader, (req, res) => {
  const { id } = req.params;
  const submissions = getSubmissions();
  const index = submissions.findIndex(s => s.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Submission not found.' });
  }

  const [deleted] = submissions.splice(index, 1);
  saveSubmissions(submissions);

  // Attempt to delete photo files
  try {
    if (deleted.grades.term1PhotoUrl) {
      const f1 = path.join(__dirname, deleted.grades.term1PhotoUrl);
      if (fs.existsSync(f1)) fs.unlinkSync(f1);
    }
    if (deleted.grades.term2PhotoUrl) {
      const f2 = path.join(__dirname, deleted.grades.term2PhotoUrl);
      if (fs.existsSync(f2)) fs.unlinkSync(f2);
    }
  } catch (err) {
    console.error('File cleanup warning:', err);
  }

  res.json({ success: true, message: 'Submission deleted.' });
});

// API: Export to CSV (Protected)
app.get('/api/export-csv', authLeader, (req, res) => {
  const submissions = getSubmissions();
  const host = `${req.protocol}://${req.get('host')}`;

  const headers = [
    'Candidate ID',
    'Submitted At',
    'Full Name',
    'Phone Number',
    'Email Address',
    'G10 Term 1 Grade Photo Link',
    'G10 Term 2 Grade Photo Link',
    'Tell Us About Yourself',
    'Passion For Leading',
    'Plans For The New Season',
    'Status',
    'Rating (/10)',
    'Leader Notes'
  ];

  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""';
    const clean = String(str).replace(/"/g, '""').replace(/\r?\n/g, ' ');
    return `"${clean}"`;
  };

  const rows = submissions.map(s => [
    escapeCsv(s.id),
    escapeCsv(new Date(s.submittedAt).toLocaleString()),
    escapeCsv(s.student.name),
    escapeCsv(s.student.phone),
    escapeCsv(s.student.email),
    escapeCsv(host + s.grades.term1PhotoUrl),
    escapeCsv(host + s.grades.term2PhotoUrl),
    escapeCsv(s.responses.about),
    escapeCsv(s.responses.passion),
    escapeCsv(s.responses.plans),
    escapeCsv(s.review.status),
    escapeCsv(s.review.rating),
    escapeCsv(s.review.notes)
  ].join(','));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n'); // BOM for Excel utf-8

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=math-mechanics-leader-candidates.csv');
  res.status(200).send(csvContent);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 Math & Mechanics Club Leader Form Server Running!`);
  console.log(`📍 Local Form URL:    http://localhost:${PORT}/apply`);
  console.log(`📍 Leader Review URL: http://localhost:${PORT}/leaders?key=${LEADER_KEY}`);
  console.log(`🔑 Leader Passcode:   ${LEADER_KEY}`);
  console.log(`=======================================================`);
});
