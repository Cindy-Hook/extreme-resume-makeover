// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
}

// Generic AI scorer form handler, used by resume-scorer.html and linkedin-scorer.html
function initScorerForm(config) {
  const form = document.getElementById(config.formId);
  if (!form) return;
  const fileInput = document.getElementById(config.fileInputId);
  const dropZone = document.getElementById(config.dropZoneId);
  const fileNameEl = document.getElementById(config.fileNameId);
  const resultBox = document.getElementById(config.resultBoxId);
  const scoreNumberEl = document.getElementById(config.scoreNumberId);
  const scoreBarEl = document.getElementById(config.scoreBarId);
  const feedbackEl = document.getElementById(config.feedbackId);
  const submitBtn = document.getElementById(config.submitBtnId);
  const errorEl = document.getElementById(config.errorId);

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      updateFileName();
    }
  });
  fileInput.addEventListener('change', updateFileName);

  function updateFileName() {
    if (fileInput.files.length) {
      fileNameEl.textContent = fileInput.files[0].name;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const emailField = document.getElementById(config.emailId);
    const email = emailField.value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailPattern.test(email)) {
      errorEl.textContent = 'Please enter a valid email address.';
      return;
    }
    if (!fileInput.files.length) {
      errorEl.textContent = 'Please upload your ' + config.fileLabel + ' before submitting.';
      return;
    }
    if (fileInput.files[0].type !== 'application/pdf') {
      errorEl.textContent = 'Please upload a PDF file.';
      return;
    }

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.innerHTML = '<span class="spinner"></span> Scoring...';
    resultBox.classList.remove('visible');

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('email', email);

    let score, feedback, isPlaceholder;
    try {
      const res = await fetch(config.endpoint, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Scoring service unavailable');
      const data = await res.json();
      score = data.score;
      feedback = data.feedback;
      isPlaceholder = !!data.placeholder;
    } catch (err) {
      const fallback = generateFallbackScore();
      score = fallback.score;
      feedback = fallback.feedback;
      isPlaceholder = true;
    }

    showResult(score, feedback, isPlaceholder);
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  });

  function generateFallbackScore() {
    const score = Math.floor(Math.random() * 26) + 65;
    return { score, feedback: config.fallbackFeedback };
  }

  function showResult(score, feedback, isPlaceholder) {
    resultBox.classList.add('visible');
    scoreNumberEl.textContent = score + '/100';
    setTimeout(() => { scoreBarEl.style.width = score + '%'; }, 50);
    feedbackEl.textContent = feedback;
    const note = resultBox.querySelector('.placeholder-note');
    if (note) note.style.display = isPlaceholder ? 'block' : 'none';
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
