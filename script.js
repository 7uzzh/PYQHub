// ==========================================
// 0. GOOGLE SHEETS & DRIVE ENGINE CONFIGURATION
// ==========================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCY-COa-u-GSwvOzdhqzsemGpqjS4Gtb8gBFQn6JL3Tj06IsL1G6GC39RsN-wozAII/exec";

// ==========================================
// 1. DATA FETCH & LIVE RENDER PIPELINE
// ==========================================
async function loadAllPapers() {
    const paperList = document.getElementById("paper-list");
    paperList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #1e3a8a; padding: 20px;">Loading papers from Live Database...</p>`;

    let jsonPapers = [];
    let sheetPapers = [];

    // Local JSON backup data fetch karo (agar hai toh)
    try {
        const jsonResponse = await fetch("data/papers.json");
        jsonPapers = await jsonResponse.json();
    } catch(e) { console.log("Local JSON load bypassed"); }

    // Google Sheet se live uploaded papers fetch karo
    try {
        const sheetResponse = await fetch(GOOGLE_SCRIPT_URL);
        if (sheetResponse.ok) {
            sheetPapers = await sheetResponse.json();
        }
    } catch (err) {
        console.error("Google Sheet Fetch Error:", err);
    }

    // Dono ko aapas me mix karo (Naye papers upar dikhenge)
    let combinedData = [...sheetPapers, ...jsonPapers];

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

    // Instant Search Handler
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
    statusText.innerText = "Uploading to Cloud Drive and recording entry...";

    const reader = new FileReader();
    reader.readAsDataURL(fileInput); // Convert PDF to dynamic base64 string for safe transport
    
    reader.onload = async function () {
        const base64PDF = reader.result;

        // Auto exam type logic detection
        let detectedExam = "Other";
        let upperTitle = customTitle.toUpperCase();
        if (upperTitle.includes("BPSC")) detectedExam = "BPSC";
        else if (upperTitle.includes("SSC")) detectedExam = "SSC";
        else if (upperTitle.includes("RAILWAY")) detectedExam = "Railway";

        const yearMatch = customTitle.match(/\b(20\d{2})\b/);
        let detectedYear = yearMatch ? yearMatch[0] : "2026";

        const payload = {
            title: customTitle,
            exam: detectedExam,
            year: detectedYear,
            fileName: `${Date.now()}_${fileInput.name}`,
            pdfData: base64PDF
        };

        try {
            // Push directly to Google Script Engine
            await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors", // Bypasses browser strict CORS policy safely
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Parallel Email Notification via Formspree Backup
            try {
                const emailData = new FormData();
                emailData.append("Exam_Title", customTitle);
                emailData.append("Attached_File", fileInput);
                fetch("https://formspree.io/f/xojzzdaw", { method: "POST", body: emailData });
            } catch(e){}

            statusText.style.color = "green";
            statusText.innerText = "🎉 Success! Paper uploaded and live permanently!";
            
            document.getElementById("upload-custom-title").value = "";
            document.getElementById("upload-file").value = "";
            
            setTimeout(() => {
                loadAllPapers();
                statusText.innerText = "";
            }, 1500);

        } catch (error) {
            console.error("Pipeline Error:", error);
            statusText.style.color = "red";
            statusText.innerText = "Upload failed. Checking database link...";
        } finally {
            btn.innerText = "Upload & Go Live";
            btn.disabled = false;
        }
    };
}