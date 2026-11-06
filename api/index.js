const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const LEADER_KEY = process.env.LEADER_KEY || 'math2026';
const MONGODB_URI = process.env.MONGODB_URI;

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
      await mongoose.connect(MONGODB_URI, { bufferCommands: false });
      isConnected = true;
      console.log('[+] Connected to MongoDB Atlas');
    }
    if (!SubmissionModel) {
      SubmissionModel = mongoose.models.Submission || mongoose.model('Submission', submissionSchema);
    }
  }
}

// Local File Store Fallback (When running locally without MongoDB)
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

function getLocalSubmissions() {
  try {
    if (!fs.existsSync(SUBMISSIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveLocalSubmissions(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Local save warning (expected on read-only serverless):', e.message);
  }
}

// Use Memory Storage for Vercel Serverless (handles photos up to 10MB each)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
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

// Serve local static files when running outside Vercel
app.use(express.static(path.join(process.cwd(), 'public')));
if (fs.existsSync(UPLOADS_DIR)) {
  app.use('/uploads', express.static(UPLOADS_DIR));
}

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

      // Convert image buffers into self-contained data URLs (works 100% on Vercel without external S3)
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
      } else {
        // Fallback for local testing
        const list = getLocalSubmissions();
        list.unshift(newSubmission);
        saveLocalSubmissions(list);
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
    } else {
      submissions = getLocalSubmissions();
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
    } else {
      const list = getLocalSubmissions();
      const idx = list.findIndex(s => s.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Applicant submission not found.' });

      if (status !== undefined) list[idx].review.status = status;
      if (rating !== undefined) list[idx].review.rating = Number(rating);
      if (notes !== undefined) list[idx].review.notes = notes;
      list[idx].review.updatedAt = new Date().toISOString();
      saveLocalSubmissions(list);

      return res.json({ success: true, message: 'Review updated.', submission: list[idx] });
    }
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
    } else {
      const list = getLocalSubmissions();
      const filtered = list.filter(s => s.id !== id);
      saveLocalSubmissions(filtered);
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
    } else {
      submissions = getLocalSubmissions();
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

// Export handler for Vercel
module.exports = app;

// Local development listener
if (require.main === module || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[+] Server listening on port ${PORT}`);
  });
}
