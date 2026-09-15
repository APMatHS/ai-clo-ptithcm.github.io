# Exam Shuffler

A browser-based application for generating multiple randomized versions of Microsoft Word (.docx) multiple-choice exams while preserving the original document formatting.

> No installation required. Runs entirely in the browser.

---

## ✨ Features

- 🔀 Shuffle question order
- 🔀 Shuffle answer choices (A/B/C/D)
- ✅ Automatically update answer keys
- 📊 Export Answer Key to Excel
- 📈 Export CLO Statistics by exam version
- 📄 Export BM06 and BM08 answer/rubric forms
- 🧾 Read administrative metadata from the content before Question 1
- 📝 Renumber questions automatically
- 🖼 Preserve images
- 📐 Preserve equations (OMML / MathType)
- 📋 Preserve tables
- 🎨 Preserve Word formatting
- 💻 Runs completely offline after loading
- 🌐 Cross-platform (Windows, macOS, Linux)

---

## Screenshots

> (Add screenshots here)

### Main Interface

![Main](screenshots/main.png)

### Generated Exam

![Exam](screenshots/exam.png)

### Answer Key

![Answer](screenshots/answer.png)

---

## Project Structure

```
exam-shuffler/
│
├── index.html
├── css/
├── assets/
├── js/
│   ├── config/
│   ├── docx/
│   ├── shuffle/
│   ├── excel/
│   ├── qr/
│   ├── utils/
│   └── appShuffle.js
│
├── docs/
└── README.md
```

---

## How It Works

```
DOCX
   │
   ▼
Read XML
   │
   ▼
Split Questions
   │
   ▼
Analyze Questions
   │
   ▼
Shuffle Questions
   │
   ▼
Shuffle Choices
   │
   ▼
Renumber Questions
   │
   ▼
Build DOCX
   │
   ├────────► Export DOCX
   │
   └────────► Export Excel
                    │
                    ├── Answer Key
                    └── CLO Statistics
```

---

## Technologies

- JavaScript (ES Modules)
- JSZip
- ExcelJS
- DOMParser
- WordprocessingML (OpenXML)

---

## Supported Content

✔ Multiple Choice Questions

✔ Images

✔ Tables

✔ OMML Equations

✔ MathType Equations

✔ Multiple Paragraph Choices

✔ Rich Text Formatting

---

## Output

### Word

- Randomized exams
- Preserved formatting
- Updated question numbering
- Updated answer labels

### Excel

- Answer Key
- CLO Statistics

---

## Browser Support

- Google Chrome ✅
- Microsoft Edge ✅
- Firefox ✅

---

## Roadmap

### Version 1.0

- [x] DOCX Reader
- [x] Question Splitter
- [x] Answer Extractor
- [x] Question Shuffle
- [x] Choice Shuffle
- [x] Question Renumber
- [x] DOCX Export
- [x] Excel Answer Export
- [x] CLO Statistics Export

### Future

- [ ] QR Code for answer verification
- [ ] Moodle XML export
- [ ] Batch processing
- [ ] Drag & Drop interface
- [ ] PDF export
- [ ] Desktop application (Windows/macOS)

---

## License

MIT License

---

## Author

Developed by **Phan Hoang Nam**

Email: hoangnam.sp101@gmail.com

---

## Acknowledgements

This project uses several open-source libraries:

- JSZip
- ExcelJS

Thanks to the open-source community.

# Exam Shuffler

![Version](https://img.shields.io/badge/version-v1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow)
![OpenXML](https://img.shields.io/badge/OpenXML-DOCX-orange)
![Platform](https://img.shields.io/badge/platform-Web-lightgrey)

Professional browser-based DOCX exam randomization tool that preserves Word formatting, equations, images, tables, and generates answer keys with CLO statistics.
