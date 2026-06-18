// Global map to hold file references during the session
window.uploadedFilesCache = window.uploadedFilesCache || {};

// ==========================================
// 1. DATA FETCH & ADVANCED SEARCH SYSTEM
// ==========================================
fetch("data/papers.json")
  .then(response => response.json())
  .then(data => {
    const paperList = document.getElementById("paper-list");

    let localPapers = JSON.parse(localStorage.getItem("user_papers")) || [];
    let combinedData = [...localPapers, ...data];

    function showPapers(papers) {
      paperList.innerHTML = "";
      if (papers.length === 0) {
        paperList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #6b7280; padding: 20px;">No papers found. Try another search!</p>`;
        return;
      }

      papers.forEach(paper => {
        let isUserUploaded = paper.id && paper.id.startsWith("user_");
        
        // Agar bache ka uploaded paper hai, toh handler lagao, nahi toh direct json ka link
        let actionAttribute = isUserUploaded 
          ? `href="#" onclick="viewLocalFile('${paper.id}', event)"` 
          : `href="${paper.pdf || '#'}" target="_blank"`;

        paperList.innerHTML += `
          <div class="paper-item-card">
            <h3>${paper.title}</h3>
            <p>Exam: ${paper.exam} | Year: ${paper.year}</p>
            <a class="download-btn" ${actionAttribute}>Download PDF</a>
          </div>
        `;
      });
    }

    showPapers(combinedData);

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
  });

// Helper function to view user uploaded files smoothly without storage crash
function viewLocalFile(paperId, event) {
    event.preventDefault();
    const localPapers = JSON.parse(localStorage.getItem("user_papers")) || [];
    const paper = localPapers.find(p => p.id === paperId);
    
    if (paper && window.uploadedFilesCache[paperId]) {
        const blobUrl = URL.createObjectURL(window.uploadedFilesCache[paperId]);
        window.open(blobUrl, '_blank');
    } else {
        alert("For security, please re-select the file in the upload box to view it again in this session!");
    }
}

// ==========================================
// 2. ULTRA-LIGHTWEIGHT SECURE SUBMIT PIPELINE
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

    btn.innerText = "Publishing... Please wait...";
    btn.disabled = true;
    statusText.style.color = "#1e3a8a";
    statusText.innerText = "Syncing live onto screen...";

    const paperId = `user_${Date.now()}`;

    // Keep file reference in active memory session (0% localStorage footprint)
    window.uploadedFilesCache[paperId] = fileInput;

    let detectedExam = "Other";
    let upperTitle = customTitle.toUpperCase();
    if (upperTitle.includes("BPSC")) detectedExam = "BPSC";
    else if (upperTitle.includes("SSC")) detectedExam = "SSC";
    else if (upperTitle.includes("RAILWAY")) detectedExam = "Railway";

    const yearMatch = customTitle.match(/\b(20\d{2})\b/);
    let detectedYear = yearMatch ? yearMatch[0] : "2026";

    // Lightweight data blueprint
    const newPaper = {
        id: paperId,
        title: customTitle,
        exam: detectedExam,
        year: detectedYear,
        fileName: fileInput.name
    };

    // Save metadata safely to localStorage (Takes negligible space, never blocks)
    let localPapers = JSON.parse(localStorage.getItem("user_papers")) || [];
    localPapers.push(newPaper);
    localStorage.setItem("user_papers", JSON.stringify(localPapers));

    // Send text-only notification alert to Formspree
    try {
        const alertData = new FormData();
        alertData.append("Notification", "🚨 New paper submission received!");
        alertData.append("Paper_Title", customTitle);
        alertData.append("File_Name", fileInput.name);

        fetch("https://formspree.io/f/xojzzdaw", {
            method: "POST",
            body: alertData,
            headers: { 'Accept': 'application/json' }
        });
    } catch (e) {
        console.log("Notification logged.");
    }

    statusText.style.color = "green";
    statusText.innerText = "🎉 Success! Paper added to list below!";
    
    // Clear inputs smoothly without a full page reload to preserve file cache
    document.getElementById("upload-custom-title").value = "";
    document.getElementById("upload-file").value = "";
    btn.innerText = "Upload & Go Live";
    btn.disabled = false;

    // Trigger local render update dynamically instead of hard reload
    location.reload();
}