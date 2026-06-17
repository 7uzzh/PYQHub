import os
import json
import re

papers = []

def extract_info(filename):
    name = filename.replace(".pdf", "")

    # default values
    exam = "Unknown"
    year = "Unknown"

    # YEAR extract (4 digit)
    year_match = re.search(r"(20\d{2})", name)
    if year_match:
        year = year_match.group(1)

    # EXAM guess (basic rules)
    upper = name.upper()

    if "SSC" in upper:
        if "CGL" in upper:
            exam = "SSC CGL"
        else:
            exam = "SSC"
    elif "BPSC" in upper:
        exam = "BPSC"
    elif "RAILWAY" in upper or "NTPC" in upper:
        exam = "Railway"
    elif "AKU" in upper:
        exam = "AKU"

    return name, exam, year


papers = []

for file in os.listdir("uploads"):
    if file.endswith(".pdf"):
        name, exam, year = extract_info(file)

        papers.append({
            "id": name.lower().replace(" ", "-"),
            "title": name.replace("_", " "),
            "exam": exam,
            "year": year,
            "keywords": name.lower().split("-"),
            "pdf": f"uploads/{file}"
        })

with open("data/papers.json", "w") as f:
    json.dump(papers, f, indent=2)

print(f"{len(papers)} papers added.")