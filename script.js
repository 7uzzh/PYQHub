fetch("data/papers.json")
  .then(response => response.json())
  .then(data => {

    const paperList = document.getElementById("paper-list");

    function showPapers(papers) {
      paperList.innerHTML = "";

      papers.forEach(paper => {
        paperList.innerHTML += `
          <div class="card">
            <h3>${paper.title}</h3>
            <p>${paper.exam} | ${paper.year}</p>
            <a href="${paper.pdf}">Download PDF</a>
          </div>
        `;
      });
    }

    showPapers(data);

    document
      .getElementById("search")
      .addEventListener("input", function () {

        const value = this.value.toLowerCase();

        const filtered = data.filter(p =>
  p.title.toLowerCase().includes(value) ||
  p.exam.toLowerCase().includes(value) ||
  (p.keywords && p.keywords.join(" ").toLowerCase().includes(value))
);

        showPapers(filtered);
      });
  });