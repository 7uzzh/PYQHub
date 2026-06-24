// ==========================================
// 0. BACKEND & GOOGLE SHEETS CONFIGURATION
// ==========================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxuh6YNDA1mup5mGEo16TNJyxS3bAci1XAmXfCe5y-VaJqLghR7_yDmoVUgl4RGDv3/exec";
const SHEET_ID = "YAHAN_APNI_SHEET_KA_ID_DALO";

// Render Backend configuration. Replace this link with your live Render URL once deployed.
const RENDER_BACKEND_URL = "https://pyq-backend.onrender.com";

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? '' 
    : RENDER_BACKEND_URL;

let globalPapers = [];

// ==========================================
// 1. FRESH LIVE FETCH PIPELINE (CACHE BYPASS)
// ==========================================
async function loadAllPapers() {
    const paperList = document.getElementById("paper-list");
    paperList.innerHTML = `<div class="status-msg loading">Loading papers...</div>`;

    let jsonPapers = [];
    let sheetPapers = [];

    // 1. Fetch from database with cache-buster
    try {
        const fetchUrl = BACKEND_URL 
            ? `${BACKEND_URL}/api/papers?t=${Date.now()}` 
            : `data/papers.json?t=${Date.now()}`;
        const jsonResponse = await fetch(fetchUrl);
        if (jsonResponse.ok) { 
            jsonPapers = await jsonResponse.json(); 
        }
    } catch(e) { 
        console.log("Database fetch failed:", e); 
    }

    // 2. Fetch from Google Sheet (only if configured and NOT placeholder)
    if (SHEET_ID && SHEET_ID !== "YAHAN_APNI_SHEET_KA_ID_DALO") {
        try {
            const GOOGLE_SHEET_JSON_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&t=${Date.now()}`;
            const response = await fetch(GOOGLE_SHEET_JSON_URL);
            const text = await response.text();
            const jsonString = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
            const json = JSON.parse(jsonString);
            
            const rows = json.table.rows;
            sheetPapers = rows.map(row => ({
                title: row.c[0] ? row.c[0].v : "",
                exam: row.c[1] ? row.c[1].v : "",
                year: row.c[2] ? row.c[2].v : "",
                pdf: row.c[3] ? row.c[3].v : ""
            })).filter(p => p.title !== "");
        } catch (err) {
            console.error("Direct Sheet Read Error:", err);
        }
    }

    // Combine sheets (if any) and json papers
    globalPapers = [...sheetPapers.reverse(), ...jsonPapers];
    
    // Update dashboard statistics
    const totalPapersEl = document.getElementById("stat-total-papers");
    const categoriesEl = document.getElementById("stat-categories");
    const latestPaperEl = document.getElementById("stat-latest-paper");

    if (totalPapersEl) totalPapersEl.innerText = globalPapers.length;
    if (categoriesEl) {
        const uniqueExams = [...new Set(globalPapers.map(p => p.exam).filter(Boolean))];
        categoriesEl.innerText = uniqueExams.length;
    }
    if (latestPaperEl && globalPapers.length > 0) {
        latestPaperEl.innerText = globalPapers[0].title;
        latestPaperEl.title = globalPapers[0].title;
    }

    // Dynamic Filter, Search, and Sort Logic
    const searchInput = document.getElementById("search");
    const sortSelect = document.getElementById("sort-select");

    // Clean listeners to avoid duplicate events on reload
    if (searchInput) {
        searchInput.replaceWith(searchInput.cloneNode(true));
    }
    const cleanSearchInput = document.getElementById("search");

    function filterAndSortPapers() {
        const value = cleanSearchInput.value.toLowerCase().trim();
        let filtered = [...globalPapers];

        if (value !== "") {
            filtered = globalPapers.filter(p => {
                const titleMatch = p.title ? p.title.toLowerCase().includes(value) : false;
                const examMatch = p.exam ? p.exam.toLowerCase().includes(value) : false;
                const yearMatch = p.year ? p.year.toString().includes(value) : false;
                return titleMatch || examMatch || yearMatch;
            });
        }

        // Apply sorting
        const sortVal = sortSelect ? sortSelect.value : "latest";
        if (sortVal === "year-desc") {
            filtered.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));
        } else if (sortVal === "year-asc") {
            filtered.sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));
        } else if (sortVal === "alpha-asc") {
            filtered.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sortVal === "alpha-desc") {
            filtered.sort((a, b) => b.title.localeCompare(a.title));
        } else {
            // Default: Latest Added
            filtered.sort((a, b) => {
                const dateA = a.uploadedAt ? new Date(a.uploadedAt) : new Date(0);
                const dateB = b.uploadedAt ? new Date(b.uploadedAt) : new Date(0);
                if (!a.uploadedAt && !b.uploadedAt) return 0;
                return dateB - dateA;
            });
        }

        // Update found count status
        const statusEl = document.getElementById("search-status");
        if (statusEl) {
            statusEl.innerText = `Found ${filtered.length} paper${filtered.length === 1 ? '' : 's'}`;
        }

        renderPapersList(filtered);
    }

    if (cleanSearchInput) {
        cleanSearchInput.addEventListener("input", filterAndSortPapers);
    }
    if (sortSelect) {
        // Clean and attach change listener
        sortSelect.replaceWith(sortSelect.cloneNode(true));
        const cleanSortSelect = document.getElementById("sort-select");
        cleanSortSelect.addEventListener("change", filterAndSortPapers);
    }

    // Run filter and sort on initial load
    filterAndSortPapers();
}

function renderPapersList(papers) {
    const paperList = document.getElementById("paper-list");
    paperList.innerHTML = "";
    
    if (papers.length === 0) {
        paperList.innerHTML = `<div class="status-msg">No papers found. Try another search!</div>`;
        return;
    }

    papers.forEach(paper => {
        // Determine if paper is uploaded recently (last 48 hours)
        const isNew = paper.uploadedAt && (Date.now() - new Date(paper.uploadedAt).getTime() < 48 * 60 * 60 * 1000);
        const badgeHTML = isNew ? `<span class="new-badge">NEW</span>` : '';

        // Format relative date text if available
        let dateText = '';
        if (paper.uploadedAt) {
            const diffMs = Date.now() - new Date(paper.uploadedAt).getTime();
            const diffHrs = Math.floor(diffMs / (60 * 60 * 1000));
            if (diffHrs < 1) {
                dateText = 'Just now';
            } else if (diffHrs < 24) {
                dateText = `${diffHrs}h ago`;
            } else {
                dateText = `${Math.floor(diffHrs / 24)}d ago`;
            }
        }
        const dateSpan = dateText ? `<span style="font-size: 11px; color: var(--text-secondary); margin-left: auto;">${dateText}</span>` : '';

        // Resolve absolute PDF link if using backend
        let pdfLink = paper.pdf;
        if (BACKEND_URL && !pdfLink.startsWith('http://') && !pdfLink.startsWith('https://')) {
            pdfLink = `${BACKEND_URL}/${pdfLink}`;
        }

        paperList.innerHTML += `
          <div class="glass-card paper-item-card">
            <h3>${paper.title}${badgeHTML}</h3>
            <div class="meta">
              <span class="badge exam-badge">${paper.exam}</span>
              <span class="badge year-badge">${paper.year}</span>
              ${dateSpan}
            </div>
            <a class="download-btn" href="${pdfLink}" target="_blank">
              <span>Download PDF</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </a>
          </div>
        `;
    });
}

document.addEventListener("DOMContentLoaded", loadAllPapers);

// ==========================================
// 2. STABLE HIGH-SPEED FILE UPLOAD PIPELINE
// ==========================================
function uploadDirectly() {
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
    statusText.innerText = "Processing secure cloud injection...";

    const reader = new FileReader();
    reader.readAsDataURL(fileInput);
    
    reader.onload = async function () {
        const base64PDF = reader.result;

        let detectedExam = "Other";
        let upperTitle = customTitle.toUpperCase();
        if (upperTitle.includes("BPSC")) detectedExam = "BPSC";
        else if (upperTitle.includes("SSC")) detectedExam = "SSC";
        else if (upperTitle.includes("RAILWAY")) detectedExam = "Railway";

        const yearMatch = customTitle.match(/\b(20\d{2})\b/);
        let detectedYear = yearMatch ? yearMatch[0] : "2026";

        // JSON formatting metadata template package
        const jsonPayload = {
            title: customTitle,
            exam: detectedExam,
            year: detectedYear,
            fileName: `${Date.now()}_${fileInput.name}`,
            pdfData: base64PDF
        };



        try {
            const response = await fetch(`${BACKEND_URL}/api/upload`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jsonPayload)
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || "Upload failed");
            }

            // Parallel Formspree backup execution (optional)
            try {
                const emailData = new FormData();
                emailData.append("Exam_Title", customTitle);
                emailData.append("Attached_File", fileInput);
                fetch("https://formspree.io/f/xojzzdaw", { method: "POST", body: emailData });
            } catch(e){}

            // Array ke top par inject karke list refresh karo using server returned object
            globalPapers.unshift(result.paper);
            renderPapersList(globalPapers);

            statusText.style.color = "green";
            statusText.innerText = "🎉 Success! Paper uploaded and live permanently!";
            
            document.getElementById("upload-custom-title").value = "";
            const fileEl = document.getElementById("upload-file");
            fileEl.value = "";
            fileEl.dispatchEvent(new Event("change"));
            
            setTimeout(() => { statusText.innerText = ""; }, 3000);

        } catch (error) {
            console.error("Upload Error:", error);
            statusText.style.color = "red";
            statusText.innerText = "❌ Upload failed. Make sure backend server is running.";
        } finally {
            btn.innerText = "Upload & Go Live";
            btn.disabled = false;
        }
    };
}

// ==========================================
// 3. UI ENHANCEMENTS & INTERACTIONS (ACCORDION + DRAG-AND-DROP)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Accordion Toggle
    const toggleBtn = document.getElementById("toggle-upload-btn");
    const uploadContent = document.getElementById("upload-content");
    if (toggleBtn && uploadContent) {
        toggleBtn.addEventListener("click", () => {
            toggleBtn.classList.toggle("active");
            uploadContent.classList.toggle("open");
        });
    }

    // Drag and Drop File Handlers
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("upload-file");
    const dropText = document.querySelector(".file-upload-text");

    if (dropZone && fileInput && dropText) {
        // Drag over states
        ["dragenter", "dragover"].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add("dragover");
            }, false);
        });

        ["dragleave", "drop"].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove("dragover");
            }, false);
        });

        // Drop file
        dropZone.addEventListener("drop", (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                fileInput.files = files;
                fileInput.dispatchEvent(new Event("change"));
            }
        });

        // File selection label change listener
        fileInput.addEventListener("change", () => {
            if (fileInput.files.length > 0) {
                const name = fileInput.files[0].name;
                dropText.innerHTML = `Selected file: <strong style="color: #10b981;">${name}</strong>`;
            } else {
                dropText.innerHTML = `Drag & drop your PDF here, or <span>browse</span>`;
            }
        });
    }
});