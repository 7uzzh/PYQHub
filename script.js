// ==========================================
// 0. BACKEND & GOOGLE SHEETS CONFIGURATION
// ==========================================
// Paste your Google Apps Script Web App URL here after deployment (e.g. https://script.google.com/macros/s/.../exec)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyOft8vfpIjUzgA6oxTO8MnoetmyEtX1l-cqXxO5QvW_2rw9Pt5YYr4lpN9qJXXFs6l/exec";
const SHEET_ID = "YAHAN_APNI_SHEET_KA_ID_DALO";

// Render Backend configuration (Fallback / Alternative backend)
const RENDER_BACKEND_URL = "https://pyq-backend.onrender.com";

const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = IS_LOCAL ? '' : RENDER_BACKEND_URL;

let globalPapers = [];

// ==========================================
// 1. FRESH LIVE FETCH PIPELINE (CACHE BYPASS)
// ==========================================
async function loadAllPapers() {
    const paperList = document.getElementById("paper-list");
    paperList.innerHTML = `<div class="status-msg loading">Loading papers...</div>`;

    let jsonPapers = [];
    let sheetPapers = [];

    // 1. Fetch from database with cache-buster (Try Google Apps Script first, then local API, then static JSON)
    try {
        let jsonResponse;
        if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== "YAHAN_APNI_GOOGLE_SCRIPT_URL_DALO" && GOOGLE_SCRIPT_URL.startsWith("https://script.google.com")) {
            jsonResponse = await fetch(`${GOOGLE_SCRIPT_URL}?t=${Date.now()}`);
        } else {
            const fetchUrl = BACKEND_URL 
                ? `${BACKEND_URL}/api/papers?t=${Date.now()}` 
                : `/api/papers?t=${Date.now()}`;
            jsonResponse = await fetch(fetchUrl);
            if (!jsonResponse.ok && !BACKEND_URL) {
                // Local fallback: try serving static data/papers.json if local server is not running
                jsonResponse = await fetch(`data/papers.json?t=${Date.now()}`);
            }
        }
        
        if (jsonResponse.ok) { 
            jsonPapers = await jsonResponse.json(); 
        } else {
            throw new Error(`HTTP error ${jsonResponse.status}`);
        }
    } catch(e) { 
        console.log("Primary fetch failed, attempting static file fallback:", e); 
        try {
            const fallbackResponse = await fetch(`data/papers.json?t=${Date.now()}`);
            if (fallbackResponse.ok) {
                jsonPapers = await fallbackResponse.json();
            }
        } catch(fallbackErr) {
            console.log("Static papers.json fallback failed:", fallbackErr);
        }
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
function resetUploadForm() {
    const titleInput = document.getElementById("upload-custom-title");
    if (titleInput) titleInput.value = "";
    
    const fileEl = document.getElementById("upload-file");
    if (fileEl) fileEl.value = "";
    
    const dropText = document.querySelector(".file-upload-text");
    if (dropText) {
        dropText.innerHTML = `Drag & drop your PDF here, or <span>browse</span>`;
    }
}

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

    // Check file type — note: some browsers/OS return empty string for File.type on PDFs,
    // so we accept empty type as long as the filename ends with .pdf
    const isPdf = fileInput.name.toLowerCase().endsWith('.pdf') ||
                  fileInput.type === 'application/pdf' ||
                  fileInput.type === '';
    if (!isPdf) {
        statusText.style.color = "red";
        statusText.innerText = "❌ Only .pdf files are allowed.";
        const fileEl = document.getElementById("upload-file");
        if (fileEl) fileEl.value = "";
        const dropText = document.querySelector(".file-upload-text");
        if (dropText) {
            dropText.innerHTML = `Drag & drop your PDF here, or <span>browse</span>`;
        }
        return;
    }

    let detectedExam = "Other";
    let upperTitle = customTitle.toUpperCase();
    if (upperTitle.includes("BPSC")) detectedExam = "BPSC";
    else if (upperTitle.includes("SSC")) detectedExam = "SSC";
    else if (upperTitle.includes("RAILWAY")) detectedExam = "Railway";

    const yearMatch = customTitle.match(/\b(20\d{2})\b/);
    let detectedYear = yearMatch ? yearMatch[0] : "2026";
    const fileName = `${Date.now()}_${fileInput.name}`;

    btn.innerText = "Uploading File... Please wait...";
    btn.disabled = true;
    statusText.style.color = "#1e3a8a";

    // Use Google Script only on production; always use local Express server on localhost
    const isGoogleScript = !IS_LOCAL &&
                           GOOGLE_SCRIPT_URL &&
                           GOOGLE_SCRIPT_URL !== "YAHAN_APNI_GOOGLE_SCRIPT_URL_DALO" &&
                           GOOGLE_SCRIPT_URL.startsWith("https://script.google.com");

    if (isGoogleScript) {
        // --- GOOGLE APPS SCRIPT CHUNKED RESUMABLE UPLOAD ---
        try {
            statusText.innerText = "Initiating secure cloud upload...";
            
            const initiatePayload = {
                action: "initiateUpload",
                fileName: fileName,
                fileSize: fileInput.size,
                mimeType: "application/pdf",
                title: customTitle,
                exam: detectedExam,
                year: detectedYear
            };

            const initRes = await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                body: JSON.stringify(initiatePayload)
            });
            const initResult = await initRes.json();

            if (!initRes.ok || !initResult.success) {
                throw new Error(initResult.error || "Failed to initiate upload");
            }

            const uploadId = initResult.uploadId;
            const CHUNK_SIZE = 1024 * 1024 * 4; // 4MB chunks
            const totalSize = fileInput.size;
            let start = 0;

            while (start < totalSize) {
                const end = Math.min(start + CHUNK_SIZE, totalSize);
                const chunk = fileInput.slice(start, end);
                const chunkRange = `bytes ${start}-${end - 1}/${totalSize}`;

                // Read chunk as base64
                const base64Chunk = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(chunk);
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                });

                // Update progress feedback
                const pct = Math.round((start / totalSize) * 100);
                statusText.innerText = `Uploading: ${pct}% (${(start / (1024 * 1024)).toFixed(1)}MB of ${(totalSize / (1024 * 1024)).toFixed(1)}MB)`;
                btn.innerText = `Uploading (${pct}%)`;

                const chunkPayload = {
                    action: "uploadChunk",
                    uploadId: uploadId,
                    chunkRange: chunkRange,
                    chunkData: base64Chunk
                };

                const chunkRes = await fetch(GOOGLE_SCRIPT_URL, {
                    method: "POST",
                    body: JSON.stringify(chunkPayload)
                });
                const chunkResult = await chunkRes.json();

                if (!chunkRes.ok || !chunkResult.success) {
                    throw new Error(chunkResult.error || "Chunk upload failed");
                }

                if (chunkResult.status === "completed") {
                    // Send backup formspree notification asynchronously
                    try {
                        const emailData = new FormData();
                        emailData.append("Exam_Title", customTitle);
                        emailData.append("Attached_File", fileInput);
                        fetch("https://formspree.io/f/xojzzdaw", { method: "POST", body: emailData });
                    } catch(e){}

                    // Insert paper into lists
                    globalPapers.unshift(chunkResult.paper);
                    renderPapersList(globalPapers);

                    statusText.style.color = "green";
                    statusText.innerText = "🎉 Success! Paper uploaded and live permanently!";
                    
                    resetUploadForm();
                    
                    setTimeout(() => { statusText.innerText = ""; }, 3000);
                    return;
                }

                start = end;
            }
        } catch (error) {
            console.error("Upload Error:", error);
            statusText.style.color = "red";
            statusText.innerText = `❌ Upload failed: ${error.message}`;
        } finally {
            btn.innerText = "Upload & Go Live";
            btn.disabled = false;
        }
    } else {
        // --- EXPRESS BACKEND UPLOAD (with progress indicator) ---
        statusText.style.color = "#6366f1";
        statusText.innerText = "Reading file...";

        const reader = new FileReader();
        reader.readAsDataURL(fileInput);

        reader.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 50);
                statusText.innerText = `Reading file... ${pct}%`;
                btn.innerText = `Uploading (${pct}%)`;
            }
        };

        reader.onerror = () => {
            statusText.style.color = "red";
            statusText.innerText = "❌ Could not read the file. Please try again.";
            btn.innerText = "Upload & Go Live";
            btn.disabled = false;
        };

        reader.onload = async function () {
            const base64PDF = reader.result;

            const jsonPayload = {
                title: customTitle,
                exam: detectedExam,
                year: detectedYear,
                fileName: fileName,
                pdfData: base64PDF
            };

            try {
                statusText.innerText = "Uploading to server (50%)...";
                btn.innerText = "Uploading (50%)";

                const uploadUrl = BACKEND_URL ? `${BACKEND_URL}/api/upload` : `/api/upload`;
                const response = await fetch(uploadUrl, {
                    method: "POST",
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(jsonPayload)
                });

                let result;
                try {
                    result = await response.json();
                } catch (parseErr) {
                    throw new Error(`Server returned non-JSON response (status ${response.status}). Is the server running?`);
                }

                if (!response.ok || !result.success) {
                    throw new Error(result.message || result.error || `Upload failed (HTTP ${response.status})`);
                }

                // Send backup formspree notification (fire-and-forget)
                try {
                    const emailData = new FormData();
                    emailData.append("Exam_Title", customTitle);
                    emailData.append("Attached_File", fileInput);
                    fetch("https://formspree.io/f/xojzzdaw", { method: "POST", body: emailData });
                } catch(e){}

                globalPapers.unshift(result.paper);
                renderPapersList(globalPapers);

                statusText.style.color = "#10b981";
                statusText.innerText = "🎉 Success! Paper uploaded and live permanently!";

                resetUploadForm();

                setTimeout(() => { statusText.innerText = ""; }, 4000);

            } catch (error) {
                console.error("Upload Error:", error);
                statusText.style.color = "red";
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    statusText.innerText = "❌ Cannot reach server. Make sure the backend is running (npm start).";
                } else {
                    statusText.innerText = `❌ Upload failed: ${error.message}`;
                }
            } finally {
                btn.innerText = "Upload & Go Live";
                btn.disabled = false;
            }
        };
    }
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

// TEST HOOK FOR AUTOMATED SEQUENTIAL UPLOAD TESTING
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("test") === "true") {
        console.log("=== STARTING AUTOMATED SEQUENTIAL UPLOAD TEST ===");
        
        const delay = ms => new Promise(r => setTimeout(r, ms));
        
        async function runAutoTest() {
            try {
                // 1. Expand accordion
                const toggleBtn = document.getElementById("toggle-upload-btn");
                const uploadContent = document.getElementById("upload-content");
                if (toggleBtn && uploadContent && !uploadContent.classList.contains("open")) {
                    toggleBtn.click();
                }
                await delay(500);

                // 2. Select file 1
                console.log("Selecting file 1...");
                const file1 = new File(["mock content 1"], "test1.pdf", { type: "application/pdf" });
                const dt1 = new DataTransfer();
                dt1.items.add(file1);
                const fileInput = document.getElementById("upload-file");
                fileInput.files = dt1.files;
                fileInput.dispatchEvent(new Event("change"));
                
                document.getElementById("upload-custom-title").value = "Auto UPSC Test 1";
                await delay(500);

                // 3. Click upload
                console.log("Uploading file 1...");
                const uploadBtn = document.getElementById("upload-btn");
                uploadBtn.click();

                // 4. Wait for success
                const statusText = document.getElementById("upload-status");
                let success = false;
                for (let i = 0; i < 30; i++) { // wait up to 30 seconds
                    await delay(1000);
                    if (statusText.innerText.includes("Success")) {
                        success = true;
                        break;
                    }
                }

                if (!success) {
                    throw new Error("File 1 upload timed out or failed: " + statusText.innerText);
                }

                console.log("File 1 uploaded successfully! Waiting 2 seconds before selecting file 2...");
                await delay(2000);

                // 5. Select file 2
                console.log("Selecting file 2...");
                const file2 = new File(["mock content 2"], "test2.pdf", { type: "application/pdf" });
                const dt2 = new DataTransfer();
                dt2.items.add(file2);
                fileInput.files = dt2.files;
                fileInput.dispatchEvent(new Event("change"));
                
                document.getElementById("upload-custom-title").value = "Auto UPSC Test 2";
                await delay(500);

                // 6. Click upload
                console.log("Uploading file 2...");
                uploadBtn.click();

                // 7. Wait for success
                success = false;
                for (let i = 0; i < 30; i++) {
                    await delay(1000);
                    if (statusText.innerText.includes("Success")) {
                        success = true;
                        break;
                    }
                }

                if (!success) {
                    throw new Error("File 2 upload timed out or failed: " + statusText.innerText);
                }

                console.log("=== AUTOMATED TEST SUCCESSFUL ===");
            } catch (err) {
                console.error("=== AUTOMATED TEST FAILED ===", err);
            }
        }
        
        runAutoTest();
    }
});