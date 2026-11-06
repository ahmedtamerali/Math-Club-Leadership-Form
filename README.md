# Math & Mechanics Club — Leadership Selection System

A modern, responsive web application built for the **High School Math & Mechanics Club** to collect, verify, and evaluate leadership candidate applications for the new season.

---

## 🔗 Live Working Links

### 1. 🎓 Student Application Link
Send this link to students across your school/group to submit their applications:
👉 **[https://5d6700b609f014.lhr.life/apply](https://5d6700b609f014.lhr.life/apply)**

### 2. 🔐 Current Leaders Revision Portal
Use this private link with the leadership committee to review answers, inspect grade photos, score candidates, and assign selection statuses:
👉 **[https://5d6700b609f014.lhr.life/leaders?key=math2026](https://5d6700b609f014.lhr.life/leaders?key=math2026)**
- **Leader Passcode:** `math2026`

---

## 📋 Form Questions & Structure

1. **Student Contact Information:**
   - Full Name
   - Phone Number / WhatsApp
   - Email Address

2. **Academic Verification (Photo Imports Only):**
   - **G10 First Term Grade Report Photo:** Direct photo file upload (drag & drop, image preview).
   - **G10 Second Term Grade Report Photo:** Direct photo file upload (drag & drop, image preview).

3. **Leadership Vision & Motivation:**
   - **Question 1:** *Talk about yourself* (Background, strengths, STEM interests).
   - **Question 2:** *Why are you passionate about leading the Math and Mechanics Club?*
   - **Question 3:** *What do you plan to do in the new season?* (Workshops, competitions, peer mentoring, new initiatives).

---

## 🛠️ Leader Portal Capabilities

- **Overview KPI Cards:** Real-time metrics on total applicants, pending reviews, shortlisted candidates, and selected leader.
- **Search & Filter:** Search by name, phone, email, or candidate ID, and filter by status.
- **Grade Photo Viewer:** Clickable photo lightbox and full-screen view of students' Term 1 and Term 2 grade report photos.
- **Interactive Review:**
  - Status pipeline: `Pending Review` → `Under Review` → `Shortlisted` → `Interview Scheduled` → `Selected Leader` / `Rejected`.
  - Rating slider (0 - 10).
  - Committee private notes.
- **Data Export:** Instant download of all student submissions and photo links into an Excel-friendly CSV.

---

## 💻 Running Locally / Restarting

If you ever reboot your computer or need to run it locally:
1. Open folder `d:\STEM\math club\leadership-form\`
2. Double-click **`start-with-public-tunnel.bat`** (Starts both the server and a new public HTTPS tunnel).
3. Or double-click **`start.bat`** to run strictly on your local network at `http://localhost:3000`.
