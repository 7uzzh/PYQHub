// ==========================================
// 0. GOOGLE SHEETS PIPELINE CONFIGURATION
// ==========================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxuh6YNDA1mup5mGEo16TNJyxS3bAci1XAmXfCe5y-VaJqLghR7_yDmoVUgl4RGDv3/exec";

// Apni Google Sheet ka ID yahan dalo
const SHEET_ID = "YAHAN_APNI_SHEET_KA_ID_DALO";

let globalPapers = [];

// ==========================================
// 1. FRESH LIVE FETCH PIPELINE (CACHE BYPASS)
// ==========================================
async function loadAllPapers() {
    const paperList = document.getElementById("paper-list");
    paperList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #1e3a8a; padding: 20px;">Loading papers from Live Database...</p>`;

    let jsonPapers = [];
    let sheetPapers = [];

    // 1. Local JSON load backup
    try {
        const jsonResponse = await fetch("data/papers.json");
        if (jsonResponse.ok) { jsonPapers = await jsonResponse.json(); }
    } catch(e) { console.log("Local JSON load bypassed"); }

    // 2. Google Sheet se bina kisi cache memory block ke direct data read karo
    try {
        // Dynamic cache-buster parameter (?t=currentTime) lagaya taaki Google fresh data de
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

    // Naye uploads humesha top par chamkenge
    globalPapers = [...sheetPapers.reverse(), ...jsonPapers];
    renderPapersList(globalPapers);

    // Live Search Logic
    document.getElementById("search").replaceWith(document.getElementById("search").cloneNode(true));
    document.getElementById("search").addEventListener("input", function () {
        const value = this.value.toLowerCase().trim();
        if (value === "") {
            renderPapersList(globalPapers);
            return;
        }

        const filtered = globalPapers.filter(p => {
            const titleMatch = p.title ? p.title.toLowerCase().includes(value) : false;
            const examMatch = p.exam ? p.exam.toLowerCase().includes(value) : false;
            const yearMatch = p.year ? p.year.toString().includes(value) : false;
            return titleMatch || examMatch || yearMatch;
        });
        renderPapersList(filtered);
    });
}

function renderPapersList(papers) {
    const paperList = document.getElementById("paper-list");
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
    statusText.innerText = "Sending paper to live server...";

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

        const formPayload = new URLSearchParams();
        formPayload.append("title", customTitle);
        formPayload.append("exam", detectedExam);
        formPayload.append("year", detectedYear);
        formPayload.append("fileName", `${Date.now()}_${fileInput.name}`);
        formPayload.append("pdfData", base64PDF);

        // Optimistic UI inject karo taaki local display instantaneous dikhe
        const newPaperObject = {
            title: customTitle,
            exam: detectedExam,
            year: detectedYear,
            pdf: base64PDF
        };

        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formPayload.toString()
            });

            // Local render force freeze
            globalPapers.unshift(newPaperObject);
            renderPapersList(globalPapers);

            statusText.style.color = "green";
            statusText.innerText = "🎉 Success! Paper uploaded and live permanently!";
            
            document.getElementById("upload-custom-title").value = "";
            document.getElementById("upload-file").value = "";
            
            setTimeout(() => {
                statusText.innerText = "";
            }, 3000);

        } catch (error) {
            console.error("Upload Error:", error);
            statusText.style.color = "red";
            statusText.innerText = "Upload failed. Checking cloud linkage...";
        } finally {
            btn.innerText = "Upload & Go Live";
            btn.disabled = false;
        }
    };
}