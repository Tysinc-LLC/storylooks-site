// StoryLooks website helpers (no frameworks, works on any phone).
const API = 'https://bppaqhrssszivsecrlse.supabase.co/functions/v1';
const param = (k) => new URLSearchParams(location.search).get(k);

// Shrink a photo on the person's own phone before uploading: longest side 1600 px, JPEG.
// Fast uploads, and well under the server's size limits. If the browser can't read the
// photo (e.g. an iPhone HEIC on some computers), the original is sent instead.
async function shrink(file, maxSide = 1600) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (blob) return new File([blob], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (_) { /* fall through to the original */ }
  return file;
}

// A photo picker box with little previews. Returns a function that gives the chosen files.
function photoPicker(boxId, { max = 1, label } = {}) {
  const box = document.getElementById(boxId);
  const input = box.querySelector('input[type=file]');
  const text = box.querySelector('.drop-text');
  const thumbs = document.getElementById(`${boxId}-thumbs`);
  let files = [];
  input.addEventListener('change', () => {
    files = [...input.files].slice(0, max);
    box.classList.toggle('has', files.length > 0);
    text.textContent = files.length ? `${files.length} photo${files.length > 1 ? 's' : ''} chosen — tap to change` : label;
    thumbs.innerHTML = '';
    for (const f of files) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = URL.createObjectURL(f);
      thumbs.appendChild(img);
    }
  });
  return () => files;
}

function showMessage(el, text, good) {
  el.textContent = text;
  el.className = `msg ${good ? 'good' : 'bad'}`;
}

async function postJSON(path, body) {
  const res = await fetch(`${API}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json().catch(() => ({ ok: false, message: 'Something went wrong. Please try again.' }));
}

async function postForm(path, form) {
  const res = await fetch(`${API}/${path}`, { method: 'POST', body: form });
  return res.json().catch(() => ({ ok: false, message: 'Something went wrong. Please try again.' }));
}
