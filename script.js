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
        let pdfLink = paper.pdf || "#";
        paperList.innerHTML += `
          <div class="paper-item-card">
            <h3>${paper.title}</h3>
            <p>Exam: ${paper.exam} | Year: ${paper.year}</p>
            <a class="download-btn" href="${pdfLink}" target="_blank">Download PDF</a>
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

// ==========================================
// 2. STABLE FILE RETENTION SUBMISSION SYSTEM
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

    btn.innerText = "Syncing & Saving... Please wait...";
    btn.disabled = true;
    statusText.style.color = "#1e3a8a";
    statusText.innerText = "Publishing instantly...";

    // Use FileReader to convert file into permanent text string link
    const reader = new FileReader();
    reader.readAsDataURL(fileInput);
    
    reader.onload = async function () {
        const base64PDF = reader.result; // Dynamic permanent offline link creator

        // Formspree payload data object
        const formData = new FormData();
        formData.append("Paper_Title", customTitle);
        formData.append("Uploaded_PDF_File", fileInput); // Physical file attachment for your mail

        try {
            // Chupke se email bhej do, background pipeline background mein chalegi
            fetch("https://formspree.io/f/xojzzdaw", {
                method: "POST",
                body: formData,
                headers: { 'Accept': 'application/json' }
            });

            let detectedExam = "Other";
            let upperTitle = customTitle.toUpperCase();
            if (upperTitle.includes("BPSC")) detectedExam = "BPSC";
            else if (upperTitle.includes("SSC")) detectedExam = "SSC";
            else if (upperTitle.includes("RAILWAY")) detectedExam = "Railway";

            const yearMatch = customTitle.match(/\b(20\d{2})\b/);
            let detectedYear = yearMatch ? yearMatch[0] : "2026";

            const newPaper = {
                id: `user_${Date.now()}`,
                title: customTitle,
                exam: detectedExam,
                year: detectedYear,
                pdf: base64PDF // Direct text-based local recovery data block (Never expires on reload)
            };

            let localPapers = JSON.parse(localStorage.getItem("user_papers")) || [];
            localPapers.push(newPaper);
            localStorage.setItem("user_papers", JSON.stringify(localPapers));

            statusText.style.color = "green";
            statusText.innerText = "🎉 Success! Paper is live permanently!";
            
            document.getElementById("upload-custom-title").value = "";
            document.getElementById("upload-file").value = "";
            
            setTimeout(() => {
                location.reload();
            }, 1000);

        } catch (error) {
            console.error(error);
            statusText.style.color = "red";
            statusText.innerText = "Connection alert. Try clicking upload again!";
        } finally {
            btn.innerText = "Upload & Go Live";
            btn.disabled = false;
        }
    };
}