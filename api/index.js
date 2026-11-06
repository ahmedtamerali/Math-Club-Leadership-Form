const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');

// Load environment variables (.env or atlas-credentials.env)
require('dotenv').config();
if (fs.existsSync(path.join(process.cwd(), 'atlas-credentials.env'))) {
  require('dotenv').config({ path: path.join(process.cwd(), 'atlas-credentials.env') });
}

const app = express();
const LEADER_KEY = process.env.LEADER_KEY || 'math2026';

let MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI && !MONGODB_URI.includes('?')) {
  MONGODB_URI = MONGODB_URI.replace(/\/?$/, '/mathclub?retryWrites=true&w=majority');
}

// Cloud Database Schema (for Vercel & MongoDB Atlas)
const submissionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  submittedAt: { type: Date, default: Date.now },
  student: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true }
  },
  grades: {
    term1PhotoUrl: { type: String, required: true },
    term1OriginalName: String,
    term1Size: Number,
    term2PhotoUrl: { type: String, required: true },
    term2OriginalName: String,
    term2Size: Number
  },
  responses: {
    about: { type: String, required: true },
    passion: { type: String, required: true },
    plans: { type: String, required: true }
  },
  review: {
    status: { type: String, default: 'Pending Review' },
    rating: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    updatedAt: Date
  }
});

let SubmissionModel;
let isConnected = false;

async function connectDb() {
  if (MONGODB_URI) {
    if (!isConnected) {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        bufferCommands: false
      });
      isConnected = true;
      console.log('[+] Connected to MongoDB Atlas cluster');
    }
    if (!SubmissionModel) {
      SubmissionModel = mongoose.models.Submission || mongoose.model('Submission', submissionSchema);
    }
  }
}

// Memory storage for serverless execution
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per photo
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only photo files are allowed for grade reports.'), false);
    }
  }
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Helper to locate static files across local and Vercel environments
function getPublicFile(filename) {
  const possiblePaths = [
    path.join(__dirname, '..', 'public', filename),
    path.join(process.cwd(), 'public', filename),
    path.join(__dirname, 'public', filename),
    path.join(process.cwd(), filename)
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return possiblePaths[0];
}

// Serve static assets (CSS, JS, icons)
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.static(process.cwd()));

// Frontend Page Routes
app.get(['/', '/apply'], (req, res) => {
  res.sendFile(getPublicFile('index.html'));
});

app.get(['/leaders', '/review'], (req, res) => {
  res.sendFile(getPublicFile('review.html'));
});

// Leader Auth Check
function authLeader(req, res, next) {
  const key = req.headers['x-leader-key'] || req.query.key;
  if (!key || key !== LEADER_KEY) {
    return res.status(401).json({ error: 'Unauthorized. Invalid or missing Leader Passcode.' });
  }
  next();
}

// API: Verify Passcode
app.post('/api/verify-leader', (req, res) => {
  const { key } = req.body;
  if (key === LEADER_KEY) return res.json({ valid: true });
  return res.status(401).json({ valid: false, message: 'Invalid Leader Passcode.' });
});

// API: Submit Application
app.post(
  '/api/apply',
  upload.fields([
    { name: 'gradePhotoTerm1', maxCount: 1 },
    { name: 'gradePhotoTerm2', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      await connectDb();

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

      // Self-contained Base64 Data URLs so images persist anywhere without external file storage
      const term1DataUrl = `data:${term1File.mimetype};base64,${term1File.buffer.toString('base64')}`;
      const term2DataUrl = `data:${term2File.mimetype};base64,${term2File.buffer.toString('base64')}`;

      const newSubmission = {
        id: applicantId,
        submittedAt: new Date(),
        student: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase()
        },
        grades: {
          term1PhotoUrl: term1DataUrl,
          term1OriginalName: term1File.originalname,
          term1Size: term1File.size,
          term2PhotoUrl: term2DataUrl,
          term2OriginalName: term2File.originalname,
          term2Size: term2File.size
        },
        responses: {
          about: about.trim(),
          passion: passion.trim(),
          plans: plans.trim()
        },
        review: {
          status: 'Pending Review',
          rating: 0,
          notes: ''
        }
      };

      if (MONGODB_URI && SubmissionModel) {
        await SubmissionModel.create(newSubmission);
        console.log(`[+] Stored in MongoDB Atlas: ${applicantId} (${name})`);
      }

      res.status(201).json({
        success: true,
        applicantId: applicantId,
        message: 'Your leadership application has been submitted successfully!'
      });
    } catch (err) {
      console.error('Submission error:', err);
      res.status(500).json({ error: 'Failed to process application: ' + err.message });
    }
  }
);

// API: Get All Submissions (Protected)
app.get('/api/submissions', authLeader, async (req, res) => {
  try {
    await connectDb();
    let submissions = [];

    if (MONGODB_URI && SubmissionModel) {
      submissions = await SubmissionModel.find().sort({ submittedAt: -1 }).lean();
    }

    res.json({
      total: submissions.length,
      submissions: submissions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Update Submission Review (Protected)
app.patch('/api/submissions/:id', authLeader, async (req, res) => {
  try {
    await connectDb();
    const { id } = req.params;
    const { status, rating, notes } = req.body;

    if (MONGODB_URI && SubmissionModel) {
      const updated = await SubmissionModel.findOneAndUpdate(
        { id: id },
        {
          $set: {
            'review.status': status,
            'review.rating': Number(rating),
            'review.notes': notes,
            'review.updatedAt': new Date()
          }
        },
        { new: true }
      );
      if (!updated) return res.status(404).json({ error: 'Applicant submission not found.' });
      return res.json({ success: true, message: 'Review updated.', submission: updated });
    }
    return res.status(400).json({ error: 'Database not connected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Delete Submission (Protected)
app.delete('/api/submissions/:id', authLeader, async (req, res) => {
  try {
    await connectDb();
    const { id } = req.params;

    if (MONGODB_URI && SubmissionModel) {
      await SubmissionModel.deleteOne({ id: id });
    }

    res.json({ success: true, message: 'Submission deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Export to CSV (Protected)
app.get('/api/export-csv', authLeader, async (req, res) => {
  try {
    await connectDb();
    let submissions = [];

    if (MONGODB_URI && SubmissionModel) {
      submissions = await SubmissionModel.find().sort({ submittedAt: -1 }).lean();
    }

    const headers = [
      'Candidate ID',
      'Submitted At',
      'Full Name',
      'Phone Number',
      'Email Address',
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
      escapeCsv(s.responses.about),
      escapeCsv(s.responses.passion),
      escapeCsv(s.responses.plans),
      escapeCsv(s.review.status),
      escapeCsv(s.review.rating),
      escapeCsv(s.review.notes)
    ].join(','));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=math-mechanics-candidates.csv');
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).send('Error generating CSV');
  }
});

// Export app for Vercel
module.exports = app;

// Local development listener
if (require.main === module || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[+] Server running on http://localhost:${PORT}`);
  });
}
