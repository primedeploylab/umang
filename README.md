# DMart Umang Song Management System

A full-stack web application for managing song submissions for DMart Umang events.

## Features

- **Admin Panel**: Secure JWT-based authentication
- **Category Management**: Add/Edit/Delete departments and song categories
- **Submission Links**: Generate unique URLs for participants
- **Song Submissions**: Upload audio files or paste YouTube links
- **Duplicate Detection**: Fingerprint-based song duplicate checking
- **Export**: Download submissions as PDF or XML

## Tech Stack

- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Frontend**: React, React Router, Axios
- **Auth**: JWT, bcrypt
- **Export**: PDFKit, xmlbuilder

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Installation

```bash
# Install all dependencies
npm run install-all

# Or manually
npm install
cd client && npm install
```

### Configuration

Create `.env` file in root:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/dmart-umang
JWT_SECRET=your-secret-key-change-this
NODE_ENV=development
```

### Run Development

```bash
# Start backend (port 5000)
npm run dev

# In another terminal, start frontend (port 3000)
npm run client
```

### Production Build

```bash
cd client && npm run build
npm start
```

## Default Admin Credentials

On first run, a default admin is created:

- **Email**: `admin@dmart.com`
- **Password**: `Admin@123`

⚠️ Change these credentials in production!

## API Endpoints

### Auth
- `POST /api/auth/login` - Admin login
- `GET /api/auth/verify` - Verify token

### Categories
- `GET /api/categories` - List all
- `POST /api/categories` - Create (admin)
- `PUT /api/categories/:id` - Update (admin)
- `DELETE /api/categories/:id` - Delete (admin)

### Links
- `POST /api/links/generate` - Generate submission link (admin)
- `GET /api/links` - List all links (admin)
- `GET /api/links/verify/:linkId` - Verify link (public)

### Submissions
- `GET /api/submissions` - List all (admin)
- `POST /api/submissions/:linkId` - Submit song (public)
- `DELETE /api/submissions/:id` - Delete (admin)

### Export
- `GET /api/export/pdf` - Export as PDF (admin)
- `GET /api/export/xml` - Export as XML (admin)

## Duplicate Detection

The system uses audio fingerprinting to detect duplicate songs:

1. **File Upload**: Generates hash-based fingerprint
2. **YouTube Link**: Extracts video ID for comparison
3. **Chromaprint** (optional): Install `fpcalc` for advanced fingerprinting

### Install Chromaprint (Optional)

```bash
# Ubuntu/Debian
sudo apt install libchromaprint-tools

# macOS
brew install chromaprint

# Windows
# Download from https://acoustid.org/chromaprint
```

## Deployment

### Render

1. Create new Web Service
2. Connect GitHub repo
3. Set environment variables
4. Build command: `npm install && cd client && npm install && npm run build`
5. Start command: `npm start`

### Railway

1. Create new project from GitHub
2. Add MongoDB plugin
3. Set environment variables
4. Deploy automatically

## Project Structure

```
├── server/
│   ├── index.js          # Entry point
│   ├── seed.js           # Database seeding
│   ├── models/           # Mongoose models
│   ├── routes/           # API routes
│   ├── middleware/       # Auth middleware
│   └── utils/            # Fingerprint utils
├── client/
│   ├── public/
│   └── src/
│       ├── components/   # React components
│       ├── pages/        # Page components
│       ├── api.js        # Axios instance
│       └── App.js        # Main app
├── uploads/              # Uploaded audio files
└── package.json
```

## License

MIT
