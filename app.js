/* HEIC Converter — application logic
   Everything runs in the browser: HEIC decode via heic2any, re-encode via Canvas.
   No file is ever uploaded. */
(function () {
  'use strict';

  var MAX_FILES = 50;
  var $ = function (id) { return document.getElementById(id); };
  var drop = $('drop'), input = $('file'), list = $('list'), resultsBox = $('results');
  var qEl = $('quality'), wEl = $('maxw'), fEl = $('format'), bgEl = $('bg');
  var btnC = $('convert'), btnD = $('dlAll'), btnR = $('clear');
  var errEl = $('err'), prog = $('prog'), totals = $('totals'), resTitle = $('resTitle');

  var files = [], results = [];

  /* ---------- helpers ---------- */
  function bytes(n) {
    if (n === 0 || n == null) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }
  function extFor(fmt) {
    return fmt === 'image/webp' ? 'webp' : fmt === 'image/png' ? 'png' : 'jpg';
  }
  function isHeic(f) {
    return /\.(heic|heif|hif)$/i.test(f.name) ||
           /image\/(heic|heif)/i.test(f.type || '');
  }
  function setProg(pct, on) {
    prog.classList.toggle('on', !!on);
    prog.firstElementChild.style.width = pct + '%';
  }
  function showErr(t) { errEl.textContent = t || ''; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- file intake ---------- */
  function addFiles(arr) {
    showErr('');
    var ok = [], bad = [];
    for (var i = 0; i < arr.length; i++) {
      var f = arr[i];
      if (!f.type || f.type.indexOf('image/') !== 0) { bad.push(f.name); continue; }
      ok.push(f);
    }
    if (bad.length) showErr('Skipped non-image file(s): ' + bad.join(', '));
    var room = MAX_FILES - files.length;
    if (ok.length > room) {
      showErr('Limit is ' + MAX_FILES + ' files per batch. Only the first ' + room + ' were added.');
      ok = ok.slice(0, Math.max(0, room));
    }
    files = files.concat(ok);
    syncButtons();
  }

  function syncButtons() {
    btnC.disabled = !files.length;
    btnR.disabled = !files.length;
    btnD.disabled = !results.some(function (r) { return !r.error; });
  }

  drop.addEventListener('click', function () { input.click(); });
  input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });

  /* ---------- HEIC decode ---------- */
  function decodeHeic(file) {
    return new Promise(function (res, rej) {
      if (typeof heic2any === 'undefined') {
        rej(new Error('HEIC decoder failed to load — check your connection and reload.'));
        return;
      }
      var blob = file.slice(0, file.size, file.type || 'image/heic');
      heic2any({ blob: blob, toType: 'image/jpeg', quality: 1 })
        .then(function (out) {
          var b = Array.isArray(out) ? out[0] : out;
          res(b);
        })
        .catch(function (e) {
          rej(new Error('Could not decode ' + file.name + ' (' + (e && e.message ? e.message : 'unsupported HEIC') + ')'));
        });
    });
  }

  function loadImageEl(blobOrFile) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blobOrFile);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); res(img); };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        rej(new Error('Unsupported or corrupt image file.'));
      };
      img.src = url;
    });
  }

  /* ---------- conversion ---------- */
  function convertOne(file, fmt, quality, maxW, bgMode) {
    var srcBlob = file;

    if (isHeic(file)) {
      return decodeHeic(file).then(function (decoded) {
        return convertBlob(decoded, file, fmt, quality, maxW, bgMode);
      });
    }
    return convertBlob(srcBlob, file, fmt, quality, maxW, bgMode);
  }

  function convertBlob(blob, file, fmt, quality, maxW, bgMode) {
    return loadImageEl(blob).then(function (img) {
      var ow = img.naturalWidth || img.width;
      var oh = img.naturalHeight || img.height;
      if (!ow || !oh) throw new Error('Image has zero dimensions.');

      var scale = Math.min(1, maxW / ow);
      var tw = Math.max(1, Math.round(ow * scale));
      var th = Math.max(1, Math.round(oh * scale));

      var src = document.createElement('canvas');
      src.width = ow; src.height = oh;
      var sctx = src.getContext('2d');
      sctx.drawImage(img, 0, 0, ow, oh);

      var dst = document.createElement('canvas');
      dst.width = tw; dst.height = th;
      var dctx = dst.getContext('2d');

      // JPEG has no alpha — fill with the chosen background first
      if (fmt === 'image/jpeg') {
        var col = bgMode === 'ffffff' ? '#ffffff' : bgMode === '000000' ? '#000000' : '#ffffff';
        dctx.fillStyle = col;
        dctx.fillRect(0, 0, tw, th);
      }
      dctx.imageSmoothingEnabled = true;
      dctx.imageSmoothingQuality = 'high';
      dctx.drawImage(src, 0, 0, ow, oh, 0, 0, tw, th);

      return new Promise(function (res) {
        dst.toBlob(function (out) {
          if (!out) { res({ error: 'Encoding failed' }); return; }
          var base = (file.name || 'image').replace(/\.[^.]+$/, '').replace(/[^\w\-. ]+/g, '') || 'image';
          res({
            origName: file.name, origSize: file.size, blob: out,
            outName: base + '.' + extFor(fmt),
            ow: ow, oh: oh, tw: tw, th: th, fmt: fmt, wasHeic: isHeic(file)
          });
        }, fmt, quality / 100);
      });
    });
  }

  /* ---------- rendering ---------- */
  function render() {
    list.innerHTML = '';
    var okCount = 0, origTotal = 0, outTotal = 0;

    results.forEach(function (r) {
      var el = document.createElement('div');
      el.className = 'item';

      if (r.error) {
        el.innerHTML =
          '<div class="thumb">⚠️</div>' +
          '<div class="meta"><div class="name">' + esc(r.origName) + '</div>' +
          '<div class="sizes"><span style="color:var(--err)">' + esc(r.error) + '</span></div></div>' +
          '<div class="acts"></div>';
        list.appendChild(el);
        return;
      }

      okCount++;
      origTotal += r.origSize;
      outTotal += r.blob.size;

      var saved = r.origSize - r.blob.size;
      var pct = r.origSize ? (saved / r.origSize * 100) : 0;
      var cls = pct > 5 ? 'good' : (pct < -5 ? 'bad' : 'same');
      var url = URL.createObjectURL(r.blob);
      var srcFmt = (r.origName.split('.').pop() || '').toUpperCase();

      el.innerHTML =
        '<div class="thumb"><img src="' + url + '" alt=""></div>' +
        '<div class="meta">' +
          '<div class="name">' + esc(r.origName) +
            (srcFmt ? ' <span class="pill">' + esc(srcFmt) + '</span>' : '') + '</div>' +
          '<div class="sizes">' +
            '<span>Original: <b>' + bytes(r.origSize) + '</b></span>' +
            '<span>Output: <b>' + bytes(r.blob.size) + '</b></span>' +
            '<span>Saved: <span class="delta ' + cls + '">' + (pct >= 0 ? '▼' : '▲') + ' ' +
              Math.abs(pct).toFixed(1) + '%</span></span>' +
            '<span>' + r.ow + '×' + r.oh + ' → <b>' + r.tw + '×' + r.th + '</b></span>' +
            '<span>' + r.fmt.replace('image/', '').toUpperCase() + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="acts"><a download="' + esc(r.outName) + '" href="' + url + '">Download</a></div>';
      list.appendChild(el);
    });

    resultsBox.hidden = results.length === 0;
    if (okCount) {
      var tot = origTotal ? (1 - outTotal / origTotal) * 100 : 0;
      totals.innerHTML = '<b>' + okCount + '</b> file' + (okCount > 1 ? 's' : '') + ' · ' +
        bytes(origTotal) + ' → <b>' + bytes(outTotal) + '</b> · saved <b>' + tot.toFixed(1) + '%</b>';
    } else { totals.textContent = ''; }
  }

  /* ---------- actions ---------- */
  btnC.addEventListener('click', function () {
    if (!files.length) return;
    showErr('');
    results = [];
    render();
    btnC.disabled = true; btnD.disabled = true;

    var fmt = fEl.value, q = parseInt(qEl.value, 10);
    var mw = parseInt(wEl.value, 10), bg = bgEl.value;
    var done = 0;
    setProg(0, true);

    var chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () {
        return convertOne(f, fmt, q, mw, bg)
          .catch(function (e) { return { origName: f.name, error: e.message || String(e) }; })
          .then(function (r) {
            results.push(r);
            done++;
            setProg(Math.round(done / files.length * 100), true);
            render();
          });
      });
    });

    chain.then(function () {
      setProg(100, false);
      btnC.disabled = false;
      syncButtons();
      var failed = results.filter(function (r) { return r.error; });
      if (failed.length) {
        showErr(failed.length + ' file(s) could not be converted: ' +
          failed.map(function (f) { return f.origName; }).join(', '));
      }
    });
  });

  btnD.addEventListener('click', function () {
    var i = 0;
    function next() {
      if (i >= results.length) return;
      var r = results[i++];
      if (r.error) { next(); return; }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(r.blob);
      a.download = r.outName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(next, 180);
    }
    next();
  });

  btnR.addEventListener('click', function () {
    files = []; results = [];
    render();
    showErr('');
    setProg(0, false);
    syncButtons();
  });

  /* ---------- live labels ---------- */
  function syncLabels() {
    $('qv').textContent = qEl.value;
    $('wv').textContent = wEl.value;
    var q = parseInt(qEl.value, 10);
    $('qHint').textContent =
      q >= 90 ? '90+ = maximum quality, large files' :
      q >= 70 ? q + ' = visually lossless for photos' :
      q >= 45 ? q + ' = good quality, noticeably smaller' :
                q + ' = small files, visible artefacts';
    $('wHint').textContent = 'Original size is kept when it is smaller than ' + wEl.value + 'px';
    $('fmtHint').textContent =
      fEl.value === 'image/webp' ? 'Smallest files. Supported by all modern browsers and apps.' :
      fEl.value === 'image/png' ? 'Lossless. Best for graphics, logos and transparency — large files.' :
                                  'Best choice for email, Word, Photoshop and every device.';
  }
  qEl.addEventListener('input', syncLabels);
  wEl.addEventListener('input', syncLabels);
  fEl.addEventListener('change', syncLabels);
  syncLabels();
})();
