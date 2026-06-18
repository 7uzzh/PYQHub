// ==========================================
// 0. GOOGLE SHEETS PIPELINE CONFIGURATION
// ==========================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxuh6YNDA1mup5mGEo16TNJyxS3bAci1XAmXfCe5y-VaJqLghR7_yDmoVUgl4RGDv3/exec";

// ==========================================
// 1. DATA FETCH & LIVE GOOGLE SHEET RENDER
// ==========================================
async function loadAllPapers() {
    const paperList = document.getElementById("paper-list");
    paperList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #1e3a8a; padding: 20px;">Loading papers from Live Database...</p>`;

    try {
        // 1. Fetch static papers from local JSON file
        const jsonResponse = await fetch("data/papers.json");
        const jsonPapers = await jsonResponse.json();

        // 2. Fetch live papers from Google Sheet
        const sheetResponse = await fetch(GOOGLE_SCRIPT_URL);
        const sheetPapers = await sheetResponse.json();

        // Dono data mix karo (Sheet wale papers upar dikhenge)
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

        // Live Search Handler
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
// 2. FILE UPLOAD & GOOGLE SHEET ENTRY PIPELINE
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

    btn.innerText = "Saving to Cloud... Please wait...";
    btn.disabled = true;
    statusText.style.color = "#1e3a8a";
    statusText.innerText = "Processing permanent upload...";

    // First push the file to Formspree to generate email + permanent link storage backup
    const emailData = new FormData();
    emailData.append("Exam_Title", customTitle);
    emailData.append("Attached_File", fileInput);

    fetch("https://formspree.io/f/xojzzdaw", {
        method: "POST",
        body: emailData,
        headers: { 'Accept': 'application/json' }
    })
    .then(response => {
        // Formspree par file chali gayi, ab details Google Sheet mein daalenge
        let detectedExam = "Other";
        let upperTitle = customTitle.toUpperCase();
        if (upperTitle.includes("BPSC")) detectedExam = "BPSC";
        else if (upperTitle.includes("SSC")) detectedExam = "SSC";
        else if (upperTitle.includes("RAILWAY")) detectedExam = "Railway";

        const yearMatch = customTitle.match(/\b(20\d{2})\b/);
        let detectedYear = yearMatch ? yearMatch[0] : "2026";

        // Formspree attachment ya dynamic backup link representation
        let temporaryLink = "https://formspree.io/submissions"; 

        const payload = {
            title: customTitle,
            exam: detectedExam,
            year: detectedYear,
            pdf: temporaryLink
        };

        // Send to Google Sheets
        return fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors", // bypass cross-origin restrictions smoothly
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    })
    .then(() => {
        statusText.style.color = "green";
        statusText.innerText = "🎉 Success! Paper details recorded and live!";
        
        document.getElementById("upload-custom-title").value = "";
        document.getElementById("upload-file").value = "";
        
        setTimeout(() => {
            loadAllPapers();
            statusText.innerText = "";
        }, 1500);
    })
    .catch(error => {
        console.error("Pipeline Error:", error);
        statusText.style.color = "red";
        statusText.innerText = "Upload failed. Please check connection!";
    })
    .finally(() => {
        btn.innerText = "Upload & Go Live";
        btn.disabled = false;
    });
}