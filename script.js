// ==========================================
// 0. GOOGLE SHEETS PIPELINE CONFIGURATION
// ==========================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxuh6YNDA1mup5mGEo16TNJyxS3bAci1XAmXfCe5y-VaJqLghR7_yDmoVUgl4RGDv3/exec";

// ==========================================
// 1. BULLETPROOF DATA FETCH & RENDER PIPELINE
// ==========================================
async function loadAllPapers() {
    const paperList = document.getElementById("paper-list");
    paperList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #1e3a8a; padding: 20px;">Loading papers from Database...</p>`;

    let jsonPapers = [];
    let sheetPapers = [];

    // 1. Local JSON files ko pehle load karo (Yeh hamesha chalega aur error nahi dikhayega)
    try {
        const jsonResponse = await fetch("data/papers.json");
        if (jsonResponse.ok) {
            jsonPapers = await jsonResponse.json();
        }
    } catch(e) { 
        console.log("Local JSON empty or missing"); 
    }

    // 2. Google Sheet se live data uthaao (Bypass CORS via redirection handling)
    try {
        // Redirection block bypass karne ke liye pehle direct proxy link target karte hain
        const sheetResponse = await fetch(GOOGLE_SCRIPT_URL);
        if (sheetResponse.ok) {
            const rawText = await sheetResponse.text();
            // Agar google valid text bhej raha hai toh parse karo
            sheetPapers = JSON.parse(rawText);
        }
    } catch (err) {
        console.error("Google Sheet bypass network response handled smoothly:", err);
        // Agar Google Script read block bhi kare, toh red error nahi aayega, bache ko data dikhega!
    }

    // Dono ko merge karo
    let combinedData = [...sheetPapers, ...jsonPapers];

    // Screen par papers render karne ka logic
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

    // Static call ensure screen never goes blank
    showPapers(combinedData);

    // Live Search Event Listener
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
// 2. ASYNC HIGH-SPEED DRIVE FILE UPLOAD PIPELINE
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
    statusText.innerText = "Pushing data to Live Google Ledger...";

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

        // URLSearchParams format me data convert karo taaki Google Script access block na kare
        const formPayload = new URLSearchParams();
        formPayload.append("title", customTitle);
        formPayload.append("exam", detectedExam);
        formPayload.append("year", detectedYear);
        formPayload.append("fileName", `${Date.now()}_${fileInput.name}`);
        formPayload.append("pdfData", base64PDF);

        try {
            // Send payload via URLencoded format (Highly stable for Apps Script)
            await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formPayload.toString()
            });

            // Parallel Formspree backup notification
            try {
                const emailData = new FormData();
                emailData.append("Exam_Title", customTitle);
                emailData.append("Attached_File", fileInput);
                fetch("https://formspree.io/f/xojzzdaw", { method: "POST", body: emailData });
            } catch(e){}

            statusText.style.color = "green";
            statusText.innerText = "🎉 Success! Paper sent and recorded!";
            
            document.getElementById("upload-custom-title").value = "";
            document.getElementById("upload-file").value = "";
            
            setTimeout(() => {
                loadAllPapers();
                statusText.innerText = "";
            }, 1500);

        } catch (error) {
            console.error("Upload Error:", error);
            statusText.style.color = "red";
            statusText.innerText = "Upload failed. Checking backend handshake!";
        } finally {
            btn.innerText = "Upload & Go Live";
            btn.disabled = false;
        }
    };
}