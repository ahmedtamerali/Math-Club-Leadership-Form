// ========================================================
// MATH & MECHANICS CLUB — STUDENT APPLICATION SCRIPT
// (Vercel Ready with Client-side Auto Image Compression)
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('leadershipForm');
  const submitBtn = document.getElementById('submitBtn');
  const formContainer = document.getElementById('formContainer');
  const successCard = document.getElementById('successCard');
  const candidateIdDisplay = document.getElementById('candidateIdDisplay');
  const copyIdBtn = document.getElementById('copyIdBtn');

  // Question Word Counters
  setupWordCounter('aboutYourself', 'aboutCounter');
  setupWordCounter('passionReason', 'passionCounter');
  setupWordCounter('seasonPlans', 'plansCounter');

  // File Upload Handlers (Strictly Photo Proofs)
  setupDropzone('gradePhotoTerm1', 'dropzoneTerm1', 'defaultViewTerm1', 'previewTerm1', 'imgPreviewTerm1', 'fileNameTerm1', 'fileSizeTerm1', 'removeTerm1', 'term1Error');
  setupDropzone('gradePhotoTerm2', 'dropzoneTerm2', 'defaultViewTerm2', 'previewTerm2', 'imgPreviewTerm2', 'fileNameTerm2', 'fileSizeTerm2', 'removeTerm2', 'term2Error');

  // Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Please fix the errors in the form before submitting.', 'error');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', document.getElementById('fullName').value.trim());
      formData.append('phone', document.getElementById('phoneNumber').value.trim());
      formData.append('email', document.getElementById('emailAddress').value.trim());
      formData.append('about', document.getElementById('aboutYourself').value.trim());
      formData.append('passion', document.getElementById('passionReason').value.trim());
      formData.append('plans', document.getElementById('seasonPlans').value.trim());

      const rawFile1 = document.getElementById('gradePhotoTerm1').files[0];
      const rawFile2 = document.getElementById('gradePhotoTerm2').files[0];

      // Automatically compress photos so they upload instantly & fit Vercel payload limits
      showToast('Preparing photos for upload...', 'info');
      const compressedFile1 = await compressImage(rawFile1);
      const compressedFile2 = await compressImage(rawFile2);

      formData.append('gradePhotoTerm1', compressedFile1, compressedFile1.name);
      formData.append('gradePhotoTerm2', compressedFile2, compressedFile2.name);

      const response = await fetch('/api/apply', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.success) {
        formContainer.classList.add('hidden');
        successCard.classList.remove('hidden');
        candidateIdDisplay.textContent = data.applicantId;

        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('Application submitted successfully!', 'success');
      } else {
        showToast(data.error || 'Failed to submit application. Please check your connection.', 'error');
      }
    } catch (err) {
      console.error('Submission error:', err);
      showToast('Network error while uploading. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  });

  // Copy Reference ID
  if (copyIdBtn) {
    copyIdBtn.addEventListener('click', () => {
      const id = candidateIdDisplay.textContent;
      navigator.clipboard.writeText(id).then(() => {
        showToast('Candidate ID copied to clipboard!', 'success');
        copyIdBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => {
          copyIdBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy ID';
        }, 2000);
      });
    });
  }

  // --- Client-Side Photo Compressor (Crucial for Vercel 4.5MB Limits) ---
  function compressImage(file, maxDimension = 1600, quality = 0.85) {
    return new Promise((resolve) => {
      if (!file || !file.type.startsWith('image/')) {
        return resolve(file);
      }

      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                const compressedFile = new File([blob], newName, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => resolve(file);
        img.src = readerEvent.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  }

  // --- Helper Functions ---

  function setupWordCounter(inputId, counterId) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    if (!input || !counter) return;

    input.addEventListener('input', () => {
      const text = input.value.trim();
      const words = text ? text.split(/\s+/).length : 0;
      counter.textContent = `${words} word${words === 1 ? '' : 's'}`;
    });
  }

  function setupDropzone(inputId, dropzoneId, defaultId, previewId, imgId, nameId, sizeId, removeBtnId, errorId) {
    const input = document.getElementById(inputId);
    const dropzone = document.getElementById(dropzoneId);
    const defaultView = document.getElementById(defaultId);
    const preview = document.getElementById(previewId);
    const imgPreview = document.getElementById(imgId);
    const fileName = document.getElementById(nameId);
    const fileSize = document.getElementById(sizeId);
    const removeBtn = document.getElementById(removeBtnId);
    const errorEl = document.getElementById(errorId);

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
      });
    });

    input.addEventListener('change', () => {
      handleFiles(input.files);
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length) {
        input.files = e.dataTransfer.files;
        handleFiles(input.files);
      }
    });

    function handleFiles(files) {
      if (!files || files.length === 0) return;
      const file = files[0];

      if (!file.type.startsWith('image/')) {
        showError(errorEl, 'Please upload a valid image photo (PNG, JPG, WEBP, etc.)');
        input.value = '';
        return;
      }

      if (file.size > 25 * 1024 * 1024) {
        showError(errorEl, 'Photo exceeds 25MB limit. Please choose a smaller photo.');
        input.value = '';
        return;
      }

      clearError(errorEl);

      const reader = new FileReader();
      reader.onload = (e) => {
        imgPreview.src = e.target.result;
        fileName.textContent = file.name;
        fileSize.textContent = formatBytes(file.size);
        defaultView.classList.add('hidden');
        preview.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      input.value = '';
      imgPreview.src = '';
      preview.classList.add('hidden');
      defaultView.classList.remove('hidden');
      input.click();
    });
  }

  function validateForm() {
    let isValid = true;

    const name = document.getElementById('fullName');
    const nameErr = document.getElementById('nameError');
    if (!name.value.trim() || name.value.trim().length < 3) {
      showError(nameErr, 'Please enter your full name (at least 3 characters).');
      isValid = false;
    } else {
      clearError(nameErr);
    }

    const phone = document.getElementById('phoneNumber');
    const phoneErr = document.getElementById('phoneError');
    const phoneClean = phone.value.replace(/[^0-9+]/g, '');
    if (!phoneClean || phoneClean.length < 8) {
      showError(phoneErr, 'Please enter a valid active phone/WhatsApp number.');
      isValid = false;
    } else {
      clearError(phoneErr);
    }

    const email = document.getElementById('emailAddress');
    const emailErr = document.getElementById('emailError');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value.trim())) {
      showError(emailErr, 'Please provide a valid email address.');
      isValid = false;
    } else {
      clearError(emailErr);
    }

    const term1 = document.getElementById('gradePhotoTerm1');
    const term1Err = document.getElementById('term1Error');
    if (!term1.files || term1.files.length === 0) {
      showError(term1Err, 'Term 1 Grade Photo is strictly required.');
      isValid = false;
    } else {
      clearError(term1Err);
    }

    const term2 = document.getElementById('gradePhotoTerm2');
    const term2Err = document.getElementById('term2Error');
    if (!term2.files || term2.files.length === 0) {
      showError(term2Err, 'Term 2 Grade Photo is strictly required.');
      isValid = false;
    } else {
      clearError(term2Err);
    }

    const about = document.getElementById('aboutYourself');
    const aboutErr = document.getElementById('aboutError');
    if (!about.value.trim()) {
      showError(aboutErr, 'Please answer this question.');
      isValid = false;
    } else {
      clearError(aboutErr);
    }

    const passion = document.getElementById('passionReason');
    const passionErr = document.getElementById('passionError');
    if (!passion.value.trim()) {
      showError(passionErr, 'Please answer this question.');
      isValid = false;
    } else {
      clearError(passionErr);
    }

    const plans = document.getElementById('seasonPlans');
    const plansErr = document.getElementById('plansError');
    if (!plans.value.trim()) {
      showError(plansErr, 'Please answer this question.');
      isValid = false;
    } else {
      clearError(plansErr);
    }

    const check = document.getElementById('declarationCheck');
    const checkErr = document.getElementById('checkError');
    if (!check.checked) {
      showError(checkErr, 'You must confirm that your contact and grade photo proofs are genuine.');
      isValid = false;
    } else {
      clearError(checkErr);
    }

    return isValid;
  }

  function showError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.classList.add('visible');
  }

  function clearError(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.remove('visible');
  }

  function setLoading(loading) {
    const text = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.btn-spinner');
    if (loading) {
      submitBtn.disabled = true;
      text.classList.add('hidden');
      spinner.classList.remove('hidden');
    } else {
      submitBtn.disabled = false;
      text.classList.remove('hidden');
      spinner.classList.add('hidden');
    }
  }

  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
});

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info');
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
