const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Global Admin Password configuration (Fallback: Admin123@)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123@';

// Enable CORS
app.use(cors());

// Configure body-parser to support large Base64 PDF files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// Ensure uploads and data directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
const papersJsonPath = path.join(dataDir, 'papers.json');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(papersJsonPath)) {
    fs.writeFileSync(papersJsonPath, JSON.stringify([], null, 2), 'utf-8');
}

// Get Papers API Endpoint
app.get('/api/papers', (req, res) => {
    try {
        if (fs.existsSync(papersJsonPath)) {
            const data = fs.readFileSync(papersJsonPath, 'utf-8');
            return res.json(JSON.parse(data));
        }
        res.json([]);
    } catch (error) {
        console.error('Error fetching papers:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// Upload API Endpoint
app.post('/api/upload', (req, res) => {
    try {
        const { title, exam, year, fileName, pdfData } = req.body;

        if (!title || !exam || !year || !fileName || !pdfData) {
            return res.status(400).json({ success: false, message: 'Missing required parameters.' });
        }

        // Extract and decode base64 file data
        let base64Content = pdfData;
        if (pdfData.includes(',')) {
            base64Content = pdfData.split(',')[1];
        }

        const buffer = Buffer.from(base64Content, 'base64');
        const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const filePath = path.join(uploadsDir, safeFileName);

        // Write the PDF file to the uploads directory
        fs.writeFileSync(filePath, buffer);
        console.log(`Saved file: ${filePath}`);

        // Update papers.json
        let papers = [];
        if (fs.existsSync(papersJsonPath)) {
            const data = fs.readFileSync(papersJsonPath, 'utf-8');
            try {
                papers = JSON.parse(data);
            } catch (e) {
                console.error('Error parsing papers.json, resetting database.', e);
                papers = [];
            }
        }

        const cleanTitle = title.trim();
        const paperId = safeFileName.replace(/\.pdf$/i, '').toLowerCase();

        // Auto-generate keywords
        const keywords = cleanTitle.toLowerCase()
            .replace(/[-_]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 1);

        const newPaper = {
            id: paperId,
            title: cleanTitle,
            exam: exam,
            year: year,
            keywords: keywords,
            pdf: `uploads/${safeFileName}`,
            uploadedAt: new Date().toISOString()
        };

        // Add to the beginning of the array so new uploads show up first
        papers.unshift(newPaper);

        // Save back to JSON file
        fs.writeFileSync(papersJsonPath, JSON.stringify(papers, null, 2), 'utf-8');
        console.log(`Added paper to database: ${cleanTitle}`);

        res.json({ success: true, paper: newPaper });
    } catch (error) {
        console.error('Upload handling error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during upload.' });
    }
});


// Admin Verify API Endpoint
app.post('/api/verify', (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ success: false, message: 'Missing password parameter.' });
        }

        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, message: 'Invalid admin password.' });
        }

        res.json({ success: true, message: 'Password verified successfully.' });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during verification.' });
    }
});

// Admin Delete API Endpoint
app.post('/api/delete', (req, res) => {
    try {
        const { id, password } = req.body;

        if (!id || !password) {
            return res.status(400).json({ success: false, message: 'Missing required parameters.' });
        }

        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, message: 'Invalid admin password.' });
        }

        if (!fs.existsSync(papersJsonPath)) {
            return res.status(404).json({ success: false, message: 'Database not found.' });
        }

        let papers = [];
        const data = fs.readFileSync(papersJsonPath, 'utf-8');
        try {
            papers = JSON.parse(data);
        } catch (e) {
            return res.status(500).json({ success: false, message: 'Error reading database.' });
        }

        const paperIndex = papers.findIndex(p => p.id === id);
        if (paperIndex === -1) {
            return res.status(404).json({ success: false, message: 'Paper not found in database.' });
        }

        const paperToDelete = papers[paperIndex];

        // Delete the PDF file from the uploads folder if it exists
        if (paperToDelete.pdf) {
            const pdfFilePath = path.join(__dirname, paperToDelete.pdf);
            if (fs.existsSync(pdfFilePath)) {
                try {
                    fs.unlinkSync(pdfFilePath);
                    console.log(`Deleted file from disk: ${pdfFilePath}`);
                } catch (err) {
                    console.error(`Error deleting file from disk: ${pdfFilePath}`, err);
                }
            }
        }

        // Remove from list
        papers.splice(paperIndex, 1);

        // Save updated list
        fs.writeFileSync(papersJsonPath, JSON.stringify(papers, null, 2), 'utf-8');
        console.log(`Deleted paper from database: ${paperToDelete.title}`);

        res.json({ success: true, message: 'Paper deleted successfully.' });
    } catch (error) {
        console.error('Delete handling error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during deletion.' });
    }
});



app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 PYQ Server is running on: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
