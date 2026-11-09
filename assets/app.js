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

// ---------- one look, shared by the rating page and the "Your looks" page ----------

function el(tag, cls, text) {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text) x.textContent = text;
  return x;
}

// A row of rating buttons. A tap fills the button in and saves right away; no page change.
function ratingRow(t, look, q, choices, current, round, onSaved) {
  const row = el('div', 'pills');
  const saved = el('span', 'saved', 'Saved');
  for (const c of choices) {
    const b = el('button', `pill${round ? ' round' : ''}${current === c ? ' on' : ''}`, c);
    b.type = 'button';
    b.addEventListener('click', async () => {
      row.querySelectorAll('.pill').forEach((x) => x.classList.toggle('on', x === b));
      saved.classList.remove('show');
      const r = await postJSON('account', { t, action: 'rate', look: look.id, q, a: c }).catch(() => ({ ok: false }));
      saved.textContent = r.ok ? 'Saved' : 'Not saved, tap again';
      saved.classList.add('show');
      if (onSaved) onSaved(r.ok, c);
    });
    row.appendChild(b);
  }
  row.appendChild(saved);
  return row;
}

// A heart that saves the item to Favorites (or takes it off) without leaving the page.
function heartButton(t, lookId, n, hearted) {
  const b = el('button', `heart${hearted ? ' on' : ''}`);
  b.type = 'button';
  const paint = () => {
    const on = b.classList.contains('on');
    b.textContent = on ? '♥' : '♡';
    b.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites');
  };
  paint();
  b.addEventListener('click', async () => {
    const on = !b.classList.contains('on');
    b.classList.toggle('on', on);
    paint();
    const r = await postJSON('account', { t, action: 'favorite', look: lookId, p: n, on }).catch(() => ({ ok: false }));
    if (!r.ok) { b.classList.toggle('on', !on); paint(); }
  });
  return b;
}

// The full look: title, photo, story, items (heart + Shop), and the two quick ratings if asked for.
function lookCard(t, look, { label, ratings = true } = {}) {
  const card = el('div', 'rate-look');
  if (label) card.appendChild(el('div', 'kicker', label));
  card.appendChild(el('h3', '', look.title));
  if (look.image) { const img = el('img'); img.src = look.image; img.alt = look.title; img.loading = 'lazy'; card.appendChild(img); }
  if (look.story) card.appendChild(el('p', 'story', look.story));
  if (look.products?.length) {
    card.appendChild(el('div', 'shop-head', 'Shop this look'));
    for (const p of look.products) {
      const row = el('div', 'item');
      const text = el('div', 'item-text');
      text.append(el('div', 'item-brand', p.brand), el('div', 'item-name', p.label || p.name));
      if (p.label) text.appendChild(el('div', 'item-price', p.name));
      text.appendChild(el('div', 'item-price', p.price));
      const shop = el('a', 'btn small', 'Shop');
      shop.href = p.shop;
      shop.target = '_blank';
      shop.rel = 'noopener';
      row.append(text, heartButton(t, look.id, p.n, p.hearted), shop);
      card.appendChild(row);
    }
  }
  if (ratings) {
    const tip = el('p', 'fine hidden');
    tip.innerHTML = `Sorry that one missed. A few more photos of you usually help a lot. <a href="manage.html?t=${encodeURIComponent(t)}#photos">Add photos</a>`;
    card.appendChild(el('div', 'rate-q', "Does this look like you? (1 = not at all, 5 = that's me)"));
    card.appendChild(ratingRow(t, look, 'looks_like_me', ['1', '2', '3', '4', '5'], look.looks_like_me, true,
      (ok, c) => tip.classList.toggle('hidden', !(ok && Number(c) <= 2))));
    card.appendChild(tip);
    card.appendChild(el('div', 'rate-q', 'Would you wear it?'));
    card.appendChild(ratingRow(t, look, 'would_wear', ['Yes', 'Maybe', 'No'], look.would_wear, false));
  }
  return card;
}

// A look that isn't ready yet: still being made, or (app drops) arriving later in the week.
function waitingCard(look, label) {
  const card = el('div', 'rate-look waiting');
  if (label) card.appendChild(el('div', 'kicker', label));
  if (look.upcoming) {
    const day = new Date(look.release_at).toLocaleDateString('en-US', { weekday: 'long' });
    card.append(el('h3', '', `Arrives ${day}`), el('p', 'muted', 'A new look drops on its day.'));
  } else {
    card.append(el('h3', '', look.title || 'Your next look'), el('div', 'spinner'),
      el('p', 'muted', 'Making your look… it usually takes about a minute.'));
  }
  return card;
}
