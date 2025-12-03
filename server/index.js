require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const submissionRoutes = require('./routes/submissions');
const linkRoutes = require('./routes/links');
const exportRoutes = require('./routes/export');
const { seedAdmin, seedCategories } = require('./seed');

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(limiter);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/export', exportRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dmart-umang')
  .then(async () => {
    console.log('MongoDB connected');
    
    // Fix: Drop ALL old indexes that conflict
    const collections = ['categories', 'admins', 'submissions'];
    for (const col of collections) {
      try {
        await mongoose.connection.collection(col).dropIndexes();
        console.log(`Dropped indexes for ${col}`);
      } catch (e) { /* ignore */ }
    }
    
    await seedAdmin();
    await seedCategories();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
