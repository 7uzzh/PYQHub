// ==========================================
// 0. SUPABASE CONFIGURATION (LIVE DATABASE)
// ==========================================
const SUPABASE_URL = "https://ckktgcfwjrorucpiabzi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra3RnY2Z3anJvcnVjcGlhYnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjIyOTYsImV4cCI6MjA5NzMzODI5Nn0.12F4x2Y1tkj0aYT9uVDv3JFfjAl7Ho4OnQloXMHl6jw";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 1. DATA FETCH & LIVE SUPABASE RENDER
// ==========================================
async function loadAllPapers() {
    const paperList = document.getElementById("paper-list");
    paperList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #1e3a8a; padding: 20px;">Loading papers from Cloud Database...</p>`;

    try {
        const jsonResponse = await fetch("data/papers.json");
        const jsonPapers = await jsonResponse.json();

        const { data: dbPapers, error } = await _supabase
            .from('papers')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;

        let combinedData = [...(dbPapers || []), ...jsonPapers];

        function showPapers(papers) {
            paperList.innerHTML = "";
            if (papers.length === 0) {
                paperList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #6b7280; padding: 20px;">No papers found. Try another search!</p>`;
                return;
            }

            papers.forEach(paper => {
                paperList.innerHTML += `
                  <div class="paper-item-card">
                    <h3>${paper.title}</h3>
                    <p>Exam: ${paper.exam} | Year: ${paper.year}</p>
                    <a class="download-btn" href="${paper.pdf}" target="_blank">Download PDF</a>
                  </div>
                `;
            });
        }

        showPapers(combinedData);

        document.getElementById("search").replaceWith(document.getElementById("search").cloneNode(true));
        document.getElementById("search").addEventListener("input", function () {
            const value = this.value.toLowerCase().trim();
            if (value === "") {
                showPapers(combinedData);
                return;
            }

            const filtered = combinedData.filter(p => {
                const titleMatch = p.title ? p.title.toLowerCase().includes(value) : false;
                const examMatch = p.exam ? p.exam.toLowerCase().includes(value) : false;
                const yearMatch = p.year ? p.year.toString().includes(value) : false;
                return titleMatch || examMatch || yearMatch;
            });
            showPapers(filtered);
        });

    } catch (err) {
        console.error("Fetch Error:", err);
        paperList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: red; padding: 20px;">Failed to load cloud database. Please refresh!</p>`;
    }
}

document.addEventListener("DOMContentLoaded", loadAllPapers);

// ==========================================
// 2. STANDARD SECURE STORAGE BUCKET UPLOAD
// ==========================================
async function uploadDirectly() {
    const customTitle = document.getElementById("upload-custom-title").value.trim();
    const fileInput = document.getElementById("upload-file").files[0];
    const statusText = document.getElementById("upload-status");
    const btn = document.getElementById("upload-btn");

    if (!customTitle || !fileInput) {
        statusText.style.color = "red";
        statusText.innerText = "Please fill in the exam details and select a PDF!";
        return;
    }

    if (fileInput.type !== "application/pdf" && !fileInput.name.endsWith(".pdf")) {
        statusText.style.color = "red";
        statusText.innerText = "❌ Only .pdf files are allowed.";
        document.getElementById("upload-file").value = ""; 
        return;
    }

    btn.innerText = "Uploading File... Please wait...";
    btn.disabled = true;
    statusText.style.color = "#1e3a8a";
    statusText.innerText = "Saving permanently to Supabase Storage...";

    try {
        // Unique file path name generate karo
        const fileName = `${Date.now()}_${fileInput.name.replace(/\s+/g, '_')}`;

        // 1. Upload actual physical PDF file to Storage Bucket
        const { data: storageData, error: storageError } = await _supabase
            .storage
            .from('pdfs')
            .upload(fileName, fileInput, {
                cacheControl: '3600',
                upsert: false
            });

        if (storageError) throw storageError;

        // Permanent Public Download link URL banao
        const { data: linkData } = _supabase
            .storage
            .from('pdfs')
            .getPublicUrl(fileName);

        const publicPdfUrl = linkData.publicUrl;

        // Auto meta detection
        let detectedExam = "Other";
        let upperTitle = customTitle.toUpperCase();
        if (upperTitle.includes("BPSC")) detectedExam = "BPSC";
        else if (upperTitle.includes("SSC")) detectedExam = "SSC";
        else if (upperTitle.includes("RAILWAY")) detectedExam = "Railway";

        const yearMatch = customTitle.match(/\b(20\d{2})\b/);
        let detectedYear = yearMatch ? yearMatch[0] : "2026";

        // 2. Insert lightweight record parameters into text database table
        const { error: dbError } = await _supabase
            .from('papers')
            .insert([
                { title: customTitle, exam: detectedExam, year: detectedYear, pdf: publicPdfUrl }
            ]);

        if (dbError) throw dbError;

        // 3. Silent Formspree Alert Backup Pipeline
        try {
            const emailData = new FormData();
            emailData.append("Exam_Title", customTitle);
            emailData.append("Direct_Cloud_Link", publicPdfUrl);
            fetch("https://formspree.io/f/xojzzdaw", { method: "POST", body: emailData, headers: { 'Accept': 'application/json' } });
        } catch (e) { console.log("Formspree logged"); }

        statusText.style.color = "green";
        statusText.innerText = "🎉 Success! Paper uploaded and live permanently!";
        
        document.getElementById("upload-custom-title").value = "";
        document.getElementById("upload-file").value = "";
        
        setTimeout(() => {
            loadAllPapers();
            statusText.innerText = "";
        }, 1500);

    } catch (error) {
        console.error("Upload Error Details:", error);
        statusText.style.color = "red";
        statusText.innerText = "Upload failed. Check bucket permissions or retry!";
    } finally {
        btn.innerText = "Upload & Go Live";
        btn.disabled = false;
    }
}