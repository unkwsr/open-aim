(function () {
  var state = { user: null, tab: 'login', lastMap: null, runTokenPromise: null, scoreSync: null, scoreFeedback: null, scoreRetry: null, paymentPollTimer: 0, paymentCountdownTimer: 0 };
  var root = document.documentElement;
  var scoreRetryTimer = 0;
  var scoreDrains = new Map();
  var scoreOutboxReady = import('./score-outbox.mjs').then(function (module) {
    var storage; try { storage = window.localStorage; } catch (_) {}
    return module.createScoreOutbox({ storage: storage });
  }).catch(function () { return null; });
  function scoreText(vi, en) { return root.lang === 'en' ? en : vi; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]; }); }

  async function api(url, options) {
    var response = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json', 'X-Aim-Language': root.lang === 'en' ? 'en' : 'vi' } }, options));
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) { var error = new Error(data.message || 'Không thể kết nối máy chủ.'); error.code = data.code; error.status = response.status; error.retryAfterMs = Math.max(0, Number(response.headers.get('Retry-After')) || 0) * 1000; throw error; }
    return data;
  }

  function applyAccount(user, scoreSync) {
    if (state.user?.id !== user?.id) { state.scoreSync = null; state.scoreFeedback = null; state.scoreRetry = null; state.outboxStatus = null; clearTimeout(scoreRetryTimer); }
    state.user = user;
    if (scoreSync !== undefined) state.scoreSync = scoreSync;
    if (!user) state.runTokenPromise = null;
    root.classList.toggle('account-logged-in', Boolean(user));
    root.classList.toggle('account-ad-free', Boolean(user && user.adFree));
    root.classList.add('ads-ready');
    var button = document.querySelector('.aim-account-button');
    if (button) button.textContent = user ? user.username : 'Đăng nhập';
    window.dispatchEvent(new Event('aim-account-ready'));
    if (scoreSync !== undefined) window.dispatchEvent(new Event('aim-score-sync'));
    updateAccountScoreStatus();
    if (user) retryQueuedScores(user).catch(function () {});
  }

  function retryQueuedScores(user) {
    if (!user) return Promise.resolve();
    if (scoreDrains.has(user.id)) return scoreDrains.get(user.id);
    var task = deliverQueuedScores(user).finally(function () { scoreDrains.delete(user.id); });
    scoreDrains.set(user.id, task); return task;
  }
  async function deliverQueuedScores(user) {
    clearTimeout(scoreRetryTimer);
    if (!user || state.user?.id !== user.id) return;
    var outbox = await scoreOutboxReady;
    if (!outbox || state.user?.id !== user.id) return;
    var queued = outbox.snapshot(user.id);
    if (!queued.pending) { state.outboxStatus = queued; updateAccountScoreStatus(); return; }
    if (document.visibilityState !== 'visible' || root.classList.contains('aim-gameplay-active') || document.pointerLockElement || navigator.onLine === false) {
      scoreRetryTimer = setTimeout(function () { retryQueuedScores(state.user).catch(function () {}); }, 15000); return;
    }
    var result = await outbox.drain(user.id, function (payload) {
      if (state.user?.id !== user.id) { var error = new Error('Account changed'); error.status = 401; throw error; }
      return api('/api/local/scores', { method: 'POST', body: JSON.stringify(payload) });
    }, function (row, saved) {
      if (state.user?.id !== user.id) return;
      state.scoreSync = saved.scoreSync || state.scoreSync;
      window.dispatchEvent(new CustomEvent('aim-score-delivered', { detail: { mapId: row.mapId, score: row.score, result: row.result, status: saved.status } }));
    });
    if (state.user?.id !== user.id) return;
    state.outboxStatus = result; updateAccountScoreStatus();
    if (result.pending) scoreRetryTimer = setTimeout(function () { retryQueuedScores(state.user).catch(function () {}); }, result.retryAfterMs);
  }

  function updateAccountScoreStatus() {
    var box = document.querySelector('[data-score-sync]');
    if (!box || !state.user) return;
    box.replaceChildren();
    var title = document.createElement('strong'), text = document.createElement('p');
    var pending = state.scoreSync?.pendingCount || 0;
    title.textContent = state.user.emailVerified ? scoreText('Lưu BXH tự động', 'Automatic leaderboard sync') : scoreText('Điểm chờ xác minh email', 'Scores awaiting email verification');
    if (!state.user.emailVerified) {
      text.textContent = pending ? scoreText(pending + ' lượt đã lưu trên server. Xác minh email để tự đưa các kết quả hợp lệ lên BXH; không cần chơi lại.', pending + (pending === 1 ? ' result is' : ' results are') + ' retained on the server. Verify your email to publish eligible results automatically; no replaying required.')
        : scoreText('Bạn có thể chơi ngay khi đã đăng nhập. Kết quả hợp lệ được giữ chờ, chưa xuất hiện công khai cho đến khi xác minh email.', 'You can play while signed in. Eligible results are retained privately until you verify your email.');
    } else if (state.scoreSync?.lastPublished) {
      var count = state.scoreSync.lastPublished.count;
      text.textContent = scoreText(count + ' lượt chờ đã tự chuyển lên BXH. Mỗi map hiển thị thành tích tốt nhất đủ điều kiện.', count + (count === 1 ? ' waiting result was' : ' waiting results were') + ' published automatically. Each map shows your best qualifying result.');
    } else text.textContent = scoreText('Email đã xác minh. Các lượt hợp lệ mới sẽ tự lưu lên BXH.', 'Email verified. New eligible results are saved to the leaderboard automatically.');
    box.append(title, text);
    if (state.outboxStatus?.pending || state.outboxStatus?.blocked) {
      var uploads = document.createElement('p'); uploads.setAttribute('role', 'status');
      uploads.textContent = state.outboxStatus.blocked ? scoreText(state.outboxStatus.blocked + ' lượt chưa gửi đã hết hạn/không có phiên hợp lệ. Không tự đổi thành điểm hợp lệ; liên hệ hỗ trợ nếu cần khôi phục.', state.outboxStatus.blocked + ' unsent results have expired/invalid sessions. They cannot be ranked automatically; contact support if recovery is needed.')
        : scoreText(state.outboxStatus.pending + ' lượt đang chờ gửi từ trình duyệt này. Web sẽ tự thử lại khi có mạng và không đang chơi.', state.outboxStatus.pending + ' results are waiting to upload from this browser. Upload retries automatically when online and not playing.');
      box.append(uploads);
    }
    if (pending) {
      var list = document.createElement('ul');
      (state.scoreSync?.pending || []).slice(0, 5).forEach(function (row) { var item = document.createElement('li'); item.textContent = row.mapName + ' · ' + row.displayScore; list.append(item); });
      box.append(list);
    }
    if (!state.user.emailVerified) {
      var check = document.createElement('button'); check.type = 'button'; check.className = 'aim-account-action';
      check.textContent = scoreText('Tôi đã xác minh · Kiểm tra lại', 'I have verified · Check again');
      var feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
      check.onclick = async function () {
        check.disabled = true;
        try { await refresh(); if (!state.user?.emailVerified) { updateAccountScoreStatus(); var current = document.querySelector('[data-score-sync]'); if (current) { feedback.textContent = scoreText('Chưa nhận xác nhận. Hãy mở link trong email, kể cả thư mục spam.', 'Not confirmed yet. Open the link in your email, including your spam folder.'); current.append(feedback); } } }
        catch (_) { feedback.textContent = scoreText('Không kiểm tra được. Hãy thử lại; điểm đã nhận vẫn được giữ trên server.', 'Could not check. Try again; received scores remain on the server.'); box.append(feedback); }
        finally { check.disabled = false; }
      };
      box.append(check, feedback);
    }
    if (state.scoreFeedback?.kind === 'error' && state.scoreRetry) {
      var retry = document.createElement('button'); retry.type = 'button'; retry.className = 'aim-account-action';
      retry.textContent = scoreText('Thử gửi lại kết quả chưa lưu', 'Retry unsaved result'); retry.onclick = state.scoreRetry;
      box.append(retry);
    }
  }

  function modal() {
    var node = document.querySelector('.aim-account-modal');
    if (!node) {
      node = document.createElement('div');
      state.modalOpener = document.activeElement;
      node.className = 'aim-account-modal';
      node.setAttribute('role', 'dialog'); node.setAttribute('aria-modal', 'true'); node.setAttribute('aria-labelledby', 'aim-account-heading'); node.tabIndex = -1;
      node.addEventListener('click', function (event) { if (event.target === node) close(); });
      node.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
        if (event.key !== 'Tab') return;
        var focusable = Array.from(node.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')).filter(function (element) { return !element.disabled && element.getClientRects().length; });
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (!first) { event.preventDefault(); node.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
      });
      document.body.append(node);
    }
    return node;
  }

  function close() {
    clearInterval(state.paymentPollTimer);
    clearInterval(state.paymentCountdownTimer);
    document.querySelector('.aim-account-modal')?.remove();
    if (state.modalOpener?.isConnected) state.modalOpener.focus();
  }

  function shell(title, content) {
    var node = modal();
    node.innerHTML = '<section class="aim-account-panel"><button class="aim-account-close" aria-label="Đóng">×</button><h2 id="aim-account-heading" tabindex="-1">' + title + '</h2>' + content + '</section>';
    node.querySelector('.aim-account-close').onclick = close;
    node.querySelector('h2').focus({ preventScroll: true });
    return node;
  }

  function authView(mode) {
    state.tab = mode;
    var registering = mode === 'register';
    var node = shell(registering ? 'Tạo tài khoản' : 'Đăng nhập',
      '<p class="aim-account-intro">Lưu thành tích và so tài theo từng map.</p><div class="aim-account-tabs"><button data-tab="login">Đăng nhập</button><button data-tab="register">Đăng ký</button></div>' +
      '<form class="aim-account-form">' +
      (registering ? '<label>Tên tài khoản<input name="username" autocomplete="username" minlength="3" maxlength="24" placeholder="player123" required></label><label>Email khôi phục<input name="email" type="email" autocomplete="email" maxlength="254" placeholder="ban@example.com" required></label>' : '<label>Tài khoản hoặc email<input name="identifier" autocomplete="username" maxlength="254" required autofocus></label>') +
      '<label>Mật khẩu<input name="password" type="password" autocomplete="' + (registering ? 'new-password' : 'current-password') + '" minlength="' + (registering ? '12' : '1') + '" maxlength="128" required></label>' +
      (registering ? '<label>Nhập lại mật khẩu<input name="passwordConfirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><small class="aim-account-hint">Dùng ít nhất 12 ký tự. Email phải được xác minh để lấy lại mật khẩu.</small>' : '<button class="aim-account-link" type="button" data-forgot>Quên mật khẩu?</button>') +
      '<button class="aim-account-action is-primary" type="submit">' + (registering ? 'Tạo tài khoản' : 'Đăng nhập') + '</button><p class="aim-account-msg" role="alert"></p></form>');
    node.querySelectorAll('[data-tab]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.tab === mode); button.onclick = function () { authView(button.dataset.tab); }; });
    var forgot = node.querySelector('[data-forgot]'); if (forgot) forgot.onclick = forgotView;
    node.querySelector('form').onsubmit = async function (event) {
      event.preventDefault(); var form = new FormData(event.currentTarget), message = node.querySelector('.aim-account-msg');
      var submit = event.currentTarget.querySelector('[type="submit"]'); submit.disabled = true; message.textContent = '';
      try {
        var payload = registering ? { username: form.get('username'), email: form.get('email'), password: form.get('password'), passwordConfirm: form.get('passwordConfirm') } : { identifier: form.get('identifier'), password: form.get('password') };
        var data = await api('/api/local/auth/' + mode, { method: 'POST', body: JSON.stringify(payload) });
        applyAccount(data.user, data.scoreSync); accountView();
      } catch (error) { message.textContent = error.message; submit.disabled = false; }
    };
  }

  function forgotView() {
    var node = shell('Quên mật khẩu', '<p>Nhập email đã dùng khi đăng ký. Link đặt lại mật khẩu có hiệu lực trong 30 phút.</p><form class="aim-account-form"><label>Email<input name="email" type="email" autocomplete="email" maxlength="254" required autofocus></label><button class="aim-account-action is-primary" type="submit">Gửi link đặt lại</button><button class="aim-account-link" type="button" data-back>Quay lại đăng nhập</button><p class="aim-account-msg" role="status"></p></form>');
    node.querySelector('[data-back]').onclick = function () { authView('login'); };
    node.querySelector('form').onsubmit = async function (event) {
      event.preventDefault(); var form = new FormData(event.currentTarget), message = node.querySelector('.aim-account-msg'), submit = event.currentTarget.querySelector('[type="submit"]');
      submit.disabled = true; message.textContent = '';
      try { var data = await api('/api/local/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: form.get('email') }) }); message.classList.add('is-success'); message.textContent = data.message; }
      catch (error) { message.textContent = error.message; submit.disabled = false; }
    };
  }

  function accountView() {
    if (!state.user) return authView('login');
    var node = shell('Xin chào, ' + state.user.username,
      '<p>Thành tích của bạn được lưu theo tài khoản và từng map.</p>' +
      '<section class="aim-score-account" data-score-sync aria-live="polite"></section>' +
      (!state.user.email ? '<p>Tài khoản cũ của bạn chưa có email. Hãy liên kết để dùng quên mật khẩu và ghi điểm lên bảng xếp hạng.</p>' : '<p class="aim-account-email">' + scoreText('Email khôi phục: ', 'Recovery email: ') + '<b>' + escapeHtml(state.user.email) + '</b> · ' + (state.user.emailVerified ? scoreText('đã xác minh', 'verified') : scoreText('chưa xác minh — điểm được giữ chờ, chưa lên BXH', 'not verified — scores are retained privately, not ranked yet')) + '</p>') +
      '<div class="aim-verification-actions"><button class="aim-account-link" type="button" data-change-email>' + (state.user.email ? 'Đổi email' : 'Thêm email khôi phục') + '</button>' +
      (state.user.pendingEmail ? '<p class="aim-account-email">Đang chờ xác minh email mới: <b>' + escapeHtml(state.user.pendingEmail) + '</b></p>' : '') +
      ((!state.user.emailVerified || state.user.pendingEmail) ? '<button class="aim-account-link" type="button" data-resend-verification>Gửi lại email xác minh</button>' : '') +
      '</div>' +
      '<div class="aim-account-tabs"><button data-view="ranking">Bảng xếp hạng</button><button data-view="premium">Gỡ quảng cáo</button><button data-view="logout">Đăng xuất</button></div>' +
      (state.user.adFree ? '<div class="aim-premium"><strong>Gói gỡ quảng cáo đang hoạt động</strong><p>Cảm ơn bạn đã ủng hộ duy trì website.</p></div>' : '<div class="aim-premium"><strong>Gỡ quảng cáo vĩnh viễn · 20.000đ / $2 USD</strong><p>Chọn VietQR tại Việt Nam hoặc PayPal cho thanh toán quốc tế.</p><button class="aim-account-action is-primary" data-buy>Chọn phương thức thanh toán</button></div>'));
    node.querySelector('[data-view="ranking"]').onclick = rankingView;
    node.querySelector('[data-view="premium"]').onclick = paymentView;
    node.querySelector('[data-view="logout"]').onclick = async function () { await api('/api/local/auth/logout', { method: 'POST', body: '{}' }); applyAccount(null); authView('login'); };
    node.querySelector('[data-change-email]').onclick = changeEmailView;
    var buy = node.querySelector('[data-buy]'); if (buy) buy.onclick = paymentView;
    var resend = node.querySelector('[data-resend-verification]'); if (resend) resend.onclick = async function () {
      resend.disabled = true;
      try { var response = await api('/api/local/account/resend-verification', { method: 'POST', body: '{}' }); resend.textContent = response.message; }
      catch (error) { resend.textContent = error.message; resend.disabled = false; }
    };
    updateAccountScoreStatus();
  }

  function changeEmailView() {
    if (!state.user) return authView('login');
    var node = shell(state.user.email ? 'Đổi email' : 'Thêm email khôi phục',
      '<p>Email hiện tại chỉ được thay thế sau khi bạn xác minh email mới.</p>' +
      '<form class="aim-account-form" data-email-form>' +
      '<label>Email mới<input name="email" type="email" autocomplete="email" maxlength="254" required autofocus></label>' +
      '<label>Nhập lại email mới<input name="emailConfirm" type="email" autocomplete="off" maxlength="254" required></label>' +
      '<label>Mật khẩu hiện tại<input name="password" type="password" autocomplete="current-password" maxlength="128" required></label>' +
      '<button class="aim-account-action is-primary" type="submit">Gửi link xác minh</button>' +
      '<button class="aim-account-link" type="button" data-back-account>Quay lại tài khoản</button>' +
      '<p class="aim-account-msg" role="alert"></p></form>');
    node.querySelector('[data-back-account]').onclick = accountView;
    node.querySelector('form').onsubmit = async function (event) {
      event.preventDefault();
      var form = new FormData(event.currentTarget), message = node.querySelector('.aim-account-msg'), submit = event.currentTarget.querySelector('[type="submit"]');
      if (String(form.get('email')).trim().toLowerCase() !== String(form.get('emailConfirm')).trim().toLowerCase()) {
        message.textContent = 'Hai địa chỉ email chưa trùng nhau.'; return;
      }
      submit.disabled = true; message.textContent = '';
      try {
        var data = await api('/api/local/account/email', {method:'POST',body:JSON.stringify({email:form.get('email'),emailConfirm:form.get('emailConfirm'),password:form.get('password')})});
        applyAccount(data.user); accountView();
      } catch (error) { message.textContent = error.message; submit.disabled = false; }
    };
  }

  async function paymentView() {
    if (!state.user) return authView('login');
    clearInterval(state.paymentPollTimer); clearInterval(state.paymentCountdownTimer);
    var node = shell('Gỡ quảng cáo vĩnh viễn', '<p>Chọn phương thức thanh toán phù hợp với bạn.</p><div class="aim-payment-options"><button class="aim-payment-option" type="button" data-pay-vietqr><strong>VietQR · 20.000đ</strong><span>Ngân hàng Việt Nam · kích hoạt tự động</span></button><button class="aim-payment-option is-paypal" type="button" data-pay-paypal><strong>PayPal · $2 USD</strong><span>Thanh toán quốc tế qua PayPal</span></button></div><p class="aim-account-msg" role="alert"></p>');
    node.querySelector('[data-pay-vietqr]').onclick = vietQrView;
    node.querySelector('[data-pay-paypal]').onclick = async function () {
      var button = this, message = node.querySelector('.aim-account-msg'); button.disabled = true; message.textContent = 'Đang chuyển tới PayPal…';
      try {
        var data = await api('/api/local/payments/paypal/create', { method: 'POST', body: '{}' });
        if (data.alreadyActive) { await refresh(); return accountView(); }
        if (data.approved) { location.assign('/aim?paypal=return&token=' + encodeURIComponent(data.orderId)); return; }
        if (!/^https:\/\/www\.(sandbox\.)?paypal\.com\//.test(data.approveUrl || '')) throw new Error('PayPal trả về đường dẫn không hợp lệ.');
        location.assign(data.approveUrl);
      } catch (error) { message.textContent = error.message; button.disabled = false; }
    };
  }

  async function vietQrView() {
    if (!state.user) return authView('login');
    clearInterval(state.paymentPollTimer); clearInterval(state.paymentCountdownTimer);
    var node = shell('Gỡ quảng cáo · 20.000đ', '<p>Đang tạo mã thanh toán…</p>');
    try {
      var data = await api('/api/local/payments/ad-free', { method: 'POST', body: '{}' });
      if (data.alreadyActive) { await refresh(); return accountView(); }
      var order = data.order, remaining = Math.max(0, order.expiresAt - data.serverTime), deadline = Date.now() + remaining;
      node = shell('Gỡ quảng cáo · 20.000đ', '<div class="aim-payment"><img src="' + order.qrUrl.replace(/"/g, '&quot;') + '" alt="QR thanh toán 20.000 đồng"><b>Quét QR và giữ nguyên nội dung chuyển khoản</b><code>' + escapeHtml(order.code) + '</code><div class="aim-payment-clock"><span>Còn lại</span><strong data-countdown>15:00</strong></div><p data-pay-status>Đang chờ ngân hàng xác nhận…</p><button class="aim-account-action is-primary" data-new-qr hidden>Tạo mã QR mới</button></div>');
      var countdown = node.querySelector('[data-countdown]'), status = node.querySelector('[data-pay-status]'), image = node.querySelector('.aim-payment img'), renew = node.querySelector('[data-new-qr]');
      renew.onclick = paymentView;
      function renderCountdown() {
        var seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        countdown.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
        if (seconds === 0) expireView();
      }
      function expireView() {
        clearInterval(state.paymentCountdownTimer); clearInterval(state.paymentPollTimer); image.classList.add('is-expired'); status.textContent = 'Mã QR đã hết hạn. Nếu đã chuyển tiền đúng mã, hệ thống vẫn ghi nhận khi webhook đến.'; renew.hidden = false;
      }
      renderCountdown(); state.paymentCountdownTimer = setInterval(renderCountdown, 1000);
      state.paymentPollTimer = setInterval(async function () {
        try {
          var latest = await api('/api/local/payments/' + order.code);
          if (latest.order.status === 'paid') { clearInterval(state.paymentPollTimer); clearInterval(state.paymentCountdownTimer); await refresh(); accountView(); }
          else if (latest.order.status === 'expired') expireView();
        } catch (_) {}
      }, 4000);
    } catch (error) { node.querySelector('p').textContent = error.message; }
  }

  async function handlePaypalReturn() {
    var params = new URLSearchParams(location.search), action = params.get('paypal');
    if (!action) return;
    function cleanPaypalUrl() { var cleanUrl = new URL(location.href); cleanUrl.searchParams.delete('paypal'); cleanUrl.searchParams.delete('token'); cleanUrl.searchParams.delete('PayerID'); history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash); }
    if (action === 'cancel') {
      cleanPaypalUrl();
      var cancelled = shell('Thanh toán đã huỷ', '<p>PayPal chưa trừ tiền. Bạn có thể thử lại hoặc chọn VietQR.</p><button class="aim-account-action is-primary" data-payment-back>Quay lại thanh toán</button>');
      cancelled.querySelector('[data-payment-back]').onclick = paymentView; return;
    }
    var orderId = params.get('token') || '';
    if (action !== 'return' || !/^[A-Z0-9]{1,36}$/.test(orderId)) return;
    if (!state.user) return authView('login');
    var node = shell('Đang xác nhận PayPal', '<p data-paypal-status>Đang kiểm tra giao dịch $2 USD với PayPal…</p>');
    function finishPaypal(user) { cleanPaypalUrl(); applyAccount(user); node = shell('Đã gỡ quảng cáo', '<div class="aim-premium"><strong>Thanh toán PayPal thành công</strong><p>Cảm ơn bạn đã ủng hộ. Quảng cáo đã được tắt cho tài khoản này.</p></div><button class="aim-account-action is-primary" data-done>Hoàn tất</button>'); node.querySelector('[data-done]').onclick = accountView; }
    try {
      var data = await api('/api/local/payments/paypal/capture', { method: 'POST', body: JSON.stringify({ orderId: orderId }) });
      if (!data.pending) return finishPaypal(data.user);
      node.querySelector('[data-paypal-status]').textContent = 'PayPal đang xử lý giao dịch. Đang chờ xác nhận tự động…';
      for (var attempt = 0; attempt < 30; attempt += 1) {
        await new Promise(function (resolve) { setTimeout(resolve, 1000); });
        var latest = await api('/api/local/account');
        if (latest.user && latest.user.adFree) return finishPaypal(latest.user);
      }
      throw new Error('Giao dịch vẫn đang được PayPal xử lý. Bạn có thể thử xác nhận lại sau ít phút.');
    } catch (error) {
      node.querySelector('[data-paypal-status]').textContent = error.message;
      var retry = document.createElement('button'); retry.type = 'button'; retry.className = 'aim-account-action is-primary'; retry.textContent = 'Thử xác nhận lại'; retry.onclick = function () { handlePaypalReturn(); }; node.querySelector('.aim-account-panel').append(retry);
    }
  }

  async function rankingView(initialMapId) {
    if (typeof initialMapId !== 'string') initialMapId = '';
    var node = shell('Bảng xếp hạng', '<div class="aim-ranking-tabs" role="tablist" aria-label="Loại bảng xếp hạng"><button type="button" role="tab" data-rank-tab="global">Toàn cầu</button><button type="button" role="tab" data-rank-tab="map">Theo map</button></div><p class="aim-ranking-note" data-ranking-note></p><div data-ranking><p>Đang tải bảng xếp hạng…</p></div>');
    var target = node.querySelector('[data-ranking]'), note = node.querySelector('[data-ranking-note]');
    function setTab(name) {
      node.querySelectorAll('[data-rank-tab]').forEach(function (button) {
        var active = button.dataset.rankTab === name; button.classList.toggle('is-active', active); button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
    function table(headings, rows) {
      var scroll = document.createElement('div'); scroll.className = 'aim-rank-scroll';
      var result = document.createElement('table'); result.className = 'aim-rank-table';
      var head = document.createElement('thead'), heading = document.createElement('tr');
      headings.forEach(function (text) { var th = document.createElement('th'); th.textContent = text; heading.append(th); }); head.append(heading); result.append(head);
      var tbody = document.createElement('tbody'); rows.forEach(function (values, index) {
        var row = document.createElement('tr'); if (index < 3) row.className = 'is-top-' + (index + 1);
        values.forEach(function (text) { var td = document.createElement('td'); td.textContent = text; row.append(td); }); tbody.append(row);
      }); result.append(tbody); scroll.append(result); return scroll;
    }
    async function globalBoard() {
      setTab('global'); note.textContent = 'Điểm global được cộng từ thứ hạng tốt nhất trên từng map: hạng 1 = 100 điểm, hạng 2 = 99 điểm, giảm dần.';
      target.innerHTML = '<p>Đang tải BXH toàn cầu…</p>';
      try {
        var board = await api('/api/local/ranking?scope=global');
        if (!board.ranking.length) { var empty = document.createElement('p'); empty.textContent = 'Chưa có kết quả hợp lệ để tạo BXH toàn cầu.'; return target.replaceChildren(empty); }
        target.replaceChildren(table(['#', 'Tài khoản', 'Điểm global', 'Map', 'Hạng nhất'], board.ranking.map(function (entry) { return [entry.rank, entry.username, entry.points, entry.maps, entry.wins]; })));
      } catch (error) { var failure = document.createElement('p'); failure.textContent = error.message; target.replaceChildren(failure); }
    }
    async function mapBoard() {
      setTab('map'); note.textContent = 'Mỗi tài khoản chỉ lấy kết quả tốt nhất trên map đã chọn.';
      target.innerHTML = '<div class="aim-account-form"><label>Map<select data-maps><option>Đang tải…</option></select></label></div><div data-map-ranking><p>Chọn map để xem bảng điểm.</p></div>';
      var mapTarget = target.querySelector('[data-map-ranking]');
      try {
        var data = await api('/api/local/ranking'), select = target.querySelector('[data-maps]');
        select.replaceChildren();
        (data.maps.length ? data.maps : [{ mapId: '', mapName: 'Chưa có kết quả', players: 0 }]).forEach(function (map) {
          var option = document.createElement('option'); option.value = map.mapId; option.textContent = map.mapId ? map.mapName + ' · ' + map.players + ' xếp hạng · ' + map.starts + ' lượt chơi' : map.mapName; select.append(option);
        });
        if (initialMapId && Array.from(select.options).some(function (option) { return option.value === initialMapId; })) select.value = initialMapId;
        select.onchange = async function () {
          if (!select.value) return;
          mapTarget.innerHTML = '<p>Đang tải BXH map…</p>';
          try {
            var board = await api('/api/local/ranking?mapId=' + encodeURIComponent(select.value));
            if (!board.ranking.length) { var empty = document.createElement('p'); empty.textContent = 'Map này đã có lượt chơi nhưng chưa có kết quả hoàn thành hợp lệ.'; return mapTarget.replaceChildren(empty); }
            mapTarget.replaceChildren(table(['#', 'Tài khoản', 'Điểm'], board.ranking.map(function (entry) { return [entry.rank, entry.username, entry.displayScore]; })));
          } catch (error) { var failure = document.createElement('p'); failure.textContent = error.message; mapTarget.replaceChildren(failure); }
        };
        if (select.value) select.onchange();
      } catch (error) { var failure = document.createElement('p'); failure.textContent = error.message; mapTarget.replaceChildren(failure); }
    }
    node.querySelector('[data-rank-tab="global"]').onclick = globalBoard;
    node.querySelector('[data-rank-tab="map"]').onclick = mapBoard;
    try {
      if (initialMapId) await mapBoard(); else await globalBoard();
    } catch (error) { var failure = document.createElement('p'); failure.textContent = error.message; target.replaceChildren(failure); }
  }

  async function refresh() {
    var data = await api('/api/local/account'); applyAccount(data.user, data.scoreSync);
  }

  function scoreWatcher() {
    var feedbackVersion = 0;
    var resultHandled = false;
    function removeResultRanking() { document.querySelector('.aim-result-ranking')?.remove(); }
    function renderScoreFeedback() {
      // Only the native, centered result/leaderboard UI is shown. Keep save
      // status in account state, without recreating a game overlay or toast.
      removeResultRanking();
    }
    function feedback(kind, map, parsed, message, version) {
      if (version !== feedbackVersion) return;
      state.scoreFeedback = { kind: kind, map: map, parsed: parsed, message: message, version: version };
      renderScoreFeedback(); updateAccountScoreStatus();
    }
    function submitScore(submittedRun, map, parsed, version) {
      var userId = state.user?.id;
      var attempt = function () {
        if (state.user?.id !== userId) return Promise.resolve();
        feedback('saving', map, parsed, scoreText('Đang gửi ' + parsed.display + '. Vui lòng chờ xác nhận từ server.', 'Uploading ' + parsed.display + '. Waiting for server confirmation.'), version);
        return Promise.resolve(submittedRun).then(function (ticket) {
          var runToken = typeof ticket === 'string' ? ticket : ticket?.token;
          if (!runToken) { var error = new Error('No run ticket'); error.code = ticket?.error ? 'RUN_START_FAILED' : 'INVALID_RUN'; throw error; }
          var payload = { runToken: runToken, score: parsed.score, displayScore: parsed.display, sortMode: parsed.sortMode, result: parsed.tone };
          return scoreOutboxReady.then(function (outbox) {
            outbox?.enqueue({ ...payload, userId: userId, mapId: map.id, expiresAt: ticket?.expiresAt || Date.now() + 2 * 60 * 60 * 1000 });
            return api('/api/local/scores', { method: 'POST', body: JSON.stringify(payload) }).then(function (saved) { outbox?.remove(userId, runToken); if (state.user?.id === userId && outbox) state.outboxStatus = outbox.snapshot(userId); return saved; });
          });
        }).then(function (saved) {
          if (state.user?.id !== userId || !saved) return;
          state.scoreSync = saved.scoreSync || state.scoreSync;
          if (version === feedbackVersion) state.scoreRetry = null;
          if (saved.status === 'pending_verification') {
            feedback('pending', map, parsed, scoreText(parsed.display + ' đã lưu trên server. Xác minh email để tự đưa kết quả hợp lệ lên BXH, không cần chơi lại.', parsed.display + ' is retained on the server. Verify your email to publish eligible results automatically; no replaying required.'), version);
          } else {
            feedback('published', map, parsed, scoreText('Server đã nhận ' + parsed.display + '. BXH lấy thành tích tốt nhất đủ điều kiện của bạn.', 'Server received ' + parsed.display + '. The leaderboard uses your best qualifying result.'), version);
          }
        }).catch(function (error) {
          if (state.user?.id !== userId || version !== feedbackVersion) return;
          state.scoreRetry = ['INVALID_RUN', 'RUN_ALREADY_USED', 'RUN_START_FAILED'].includes(error.code) ? null : attempt;
          var message = error.code === 'PENDING_LIMIT' ? scoreText('Đã giữ tối đa 500 lượt chờ. Xác minh email rồi thử gửi lại lượt này.', 'The 500-result waiting limit was reached. Verify your email, then retry this result.')
            : error.code === 'RUN_START_FAILED' ? scoreText('Không mở được phiên BXH khi bắt đầu lượt do lỗi mạng/server. Điểm chưa lưu; hãy kiểm tra kết nối rồi chơi lượt mới.', 'The leaderboard session could not start because of a network/server error. This score is not saved; check your connection and start a new run.')
            : !state.scoreRetry ? scoreText('Không có phiên hợp lệ hoặc phiên đã hết hạn. Lượt này chưa được lưu lên BXH; hãy bắt đầu lượt mới khi đã đăng nhập.', 'The run session is missing, expired or already used. This result was not saved to the leaderboard; start a new run while signed in.')
            : scoreText('Chưa nhận xác nhận lưu điểm. Có thể do mạng hoặc server bận; hãy thử gửi lại trước khi rời màn này.', 'No save confirmation received. The network or server may be unavailable; retry before leaving this screen.');
          feedback('error', map, parsed, message, version);
          retryQueuedScores(state.user).catch(function () {});
        });
      };
      return attempt();
    }
    function startRun() {
      feedbackVersion += 1; resultHandled = false; state.scoreFeedback = null; state.scoreRetry = null;
      removeResultRanking();
      if (!state.user || !state.lastMap || state.lastMap.ranked === false) { state.runTokenPromise = null; return; }
      state.runTokenPromise = api('/api/local/runs/start', { method: 'POST', body: JSON.stringify({ mapId: state.lastMap.id, mapName: state.lastMap.name }) }).then(function (data) { return { token: data.runToken, expiresAt: data.expiresAt }; }).catch(function (error) { return { error: error.code || error.status || 'NETWORK' }; });
    }
    function acceptScene(scene) {
      if (!scene || !['workshop', 'pw'].includes(scene.source) || scene.ranked === false || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(scene.id)) {
        state.lastMap = null; state.runTokenPromise = null; state.scoreRetry = null;
        return false;
      }
      state.lastMap = { id: scene.id, name: String(scene.name || scene.id).slice(0, 120), type: scene.type, source: scene.source, ranked: true };
      return true;
    }
    window.addEventListener('aim-local-scene', function (event) {
      acceptScene(event.detail);
    });
    window.addEventListener('aim-local-round-start', function (event) {
      var scene = event.detail;
      if (acceptScene(scene)) startRun();
    });
    function scoreFromRecord(record) {
      if (!record || !['cleared', 'time', 'died'].includes(record.end)) return null;
      var byTime = record.type === 'moment' || (record.type == null && record.end === 'cleared');
      var score = byTime ? record.seconds : record.score;
      if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) return null;
      return { score: score, display: String(score), sortMode: byTime ? 'asc' : 'desc', tone: record.end === 'cleared' || (!byTime && record.end === 'time') ? 'success' : 'fail' };
    }
    window.addEventListener('aim-local-result', function (event) {
      if (resultHandled) return;
      var detail = event.detail, record = detail?.record, map = state.lastMap;
      if (!map || map.ranked !== true || detail?.source !== map.source || record?.shareCode !== map.id) return;
      var parsed = scoreFromRecord(record);
      if (!parsed) return;
      var submittedRun = state.runTokenPromise;
      state.runTokenPromise = null;
      resultHandled = true;
      if (!state.user) return feedback('guest', map, parsed, scoreText('Chưa đăng nhập khi bắt đầu lượt. Kết quả có thể lưu trong lịch sử riêng, nhưng không có phiên BXH cho lượt này.', 'You were not signed in when this run started. It may appear in private history, but has no leaderboard session.'), feedbackVersion);
      if (detail?.eligible !== true) return feedback('unranked', map, parsed, scoreText('Lượt có thay đổi cài đặt, tạm dừng bộ đếm hoặc dùng hỗ trợ không hợp lệ nên không ghi BXH.', 'Settings changed, the timer was paused or a disallowed assist was used; this run is not eligible for ranking.'), feedbackVersion);
      submitScore(submittedRun, map, parsed, feedbackVersion);
    });
    // Only numeric records emitted by the native workshop/community history
    // callbacks can submit. Never infer scores from practice/result DOM or a
    // map remembered by another session.
    window.addEventListener('aim-score-sync', function () {
      var info = state.scoreFeedback;
      if (info?.kind !== 'pending' || !state.user?.emailVerified || state.scoreSync?.pendingCount !== 0) return;
      feedback('published', info.map, info.parsed, scoreText('Email đã xác minh. Điểm chờ đã tự chuyển lên BXH.', 'Email verified. Your waiting result was published automatically.'), info.version);
    });
    window.addEventListener('aim-score-delivered', function (event) {
      var info = state.scoreFeedback, saved = event.detail;
      if (info?.kind !== 'error' || info.map.id !== saved.mapId || info.parsed.score !== saved.score || info.parsed.tone !== saved.result) return;
      state.scoreRetry = null;
      var pending = saved.status === 'pending_verification';
      feedback(pending ? 'pending' : 'published', info.map, info.parsed, pending ? scoreText('Đã gửi lại và lưu trên server. Xác minh email để tự lên BXH.', 'Upload recovered and retained on the server. Verify your email to publish it.') : scoreText('Đã tự gửi lại thành công. Điểm đã được server xác nhận.', 'Automatic retry succeeded. Your score is confirmed by the server.'), info.version);
    });
  }

  function adblockCheck() {
    if (state.user?.adFree) return;
    var bait = document.createElement('div'); bait.className = 'adsbox ad-banner advertisement'; bait.style.cssText = 'position:absolute;left:-9999px;width:10px;height:10px'; document.body.append(bait);
    setTimeout(function () {
      var blocked = bait.offsetHeight === 0 || getComputedStyle(bait).display === 'none'; bait.remove();
      if (!blocked || state.user?.adFree || document.querySelector('.aim-adblock-note')) return;
      var note = document.createElement('aside'); note.className = 'aim-adblock-note'; note.innerHTML = '<b>Cảm ơn bạn đã ghé web.</b><br>Quảng cáo đang bị chặn. Nếu thấy hữu ích, bạn có thể <button>ủng hộ 20.000đ</button> để duy trì website.';
      note.querySelector('button').onclick = paymentView; document.body.append(note);
    }, 2500);
  }

  function legacyAuthBridge() {
    var loginActions = new Set(['login', 'welcome-login', 'pw-login', 'pw-board-login']);
    document.addEventListener('click', function (event) {
      var action = event.target.closest('[data-action]')?.dataset.action;
      var profile = event.target.closest('.hall-profile--login, .hall-profile--me');
      if (action === 'local-ranking') {
        event.preventDefault(); event.stopImmediatePropagation();
        rankingView(); return;
      }
      if (!profile && !loginActions.has(action)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      accountView();
    }, true);
    function replaceText(rootNode, before, after) {
      var walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
      var text;
      while ((text = walker.nextNode())) if (text.nodeValue.includes(before)) text.nodeValue = text.nodeValue.replace(before, after);
    }
    function reconcileLegacyLoginUi() {
      document.querySelectorAll('[data-role="guest-sync-hint"]').forEach(function (hint) {
        var mode = state.user ? 'account' : 'guest';
        if (hint.dataset.aimLocalMode === mode) return;
        hint.dataset.aimLocalMode = mode;
        hint.textContent = state.user
          ? 'Thành tích xếp hạng và cài đặt đang được lưu theo tài khoản, dùng được trên thiết bị khác.'
          : 'Kết quả hiện chỉ lưu trên thiết bị này. Đăng nhập để lưu xếp hạng và cài đặt.';
        if (!state.user) {
          var login = document.createElement('button'); login.type = 'button'; login.dataset.action = 'login'; login.textContent = 'Đăng nhập'; hint.append(' ', login);
        }
      });
      document.querySelectorAll('.al-run-pw-login').forEach(function (button) {
        button.dataset.action = 'pw-login';
        button.hidden = Boolean(state.user);
        if (state.user) {
          replaceText(button.parentElement, '登录后打的局才会上榜，游客的成绩不算名次。', 'Đã nhận tài khoản. Các lượt chơi hợp lệ sẽ tự lưu vào bảng xếp hạng.');
          replaceText(button.parentElement, 'Đăng nhập để tự lưu lượt chơi hợp lệ vào bảng xếp hạng.', 'Đã nhận tài khoản. Các lượt chơi hợp lệ sẽ tự lưu vào bảng xếp hạng.');
        }
        else replaceText(button.parentElement, 'Đã nhận tài khoản. Các lượt chơi hợp lệ sẽ tự lưu vào bảng xếp hạng.', 'Đăng nhập để tự lưu lượt chơi hợp lệ vào bảng xếp hạng.');
      });
      document.querySelectorAll('.al-cloud-lb-cta').forEach(function (button) {
        if (button.textContent.trim() !== '登录' && button.dataset.action !== 'local-ranking') return;
        var action = state.user ? 'local-ranking' : 'login';
        var label = state.user ? 'Mở BXH' : 'Đăng nhập';
        button.dataset.action = action;
        if (button.textContent !== label) button.textContent = label;
        if (state.user) {
          replaceText(button.parentElement, '登录后打的局才会上榜，这里会显示你的名次和离上一名的差距。', 'Tài khoản đã đăng nhập. Mở bảng xếp hạng local để xem thành tích theo map.');
          replaceText(button.parentElement, 'Đăng nhập để lưu và xem thành tích theo từng map.', 'Tài khoản đã đăng nhập. Mở bảng xếp hạng local để xem thành tích theo map.');
        }
        else replaceText(button.parentElement, 'Tài khoản đã đăng nhập. Mở bảng xếp hạng local để xem thành tích theo map.', 'Đăng nhập để lưu và xem thành tích theo từng map.');
      });
    }
    function replaceOldDialog() {
      var overlay = document.querySelector('.auth-dialog-overlay');
      if (!overlay || overlay.dataset.aimReplaced) return;
      overlay.dataset.aimReplaced = '1';
      overlay.querySelector('.auth-close-btn')?.click();
      if (!state.user) authView('login');
    }
    window.AimDom.watch(document.body, '.auth-dialog-overlay,[data-role="guest-sync-hint"],.al-run-pw-login,.al-cloud-lb-cta', function () { replaceOldDialog(); reconcileLegacyLoginUi(); });
    window.addEventListener('aim-account-ready', reconcileLegacyLoginUi);
    replaceOldDialog(); reconcileLegacyLoginUi();
  }

  window.AimAccount = Object.freeze({
    isLoggedIn: function () { return Boolean(state.user); },
    user: function () { return state.user; },
    open: accountView,
    openRanking: rankingView,
  });
  var button = document.createElement('button'); button.className = 'aim-account-button'; button.textContent = 'Đăng nhập'; button.onclick = accountView; (document.querySelector('.aim-local-actions') || document.body).append(button);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !state.user) return;
    refresh().then(function () {
      if (document.querySelector('.aim-account-modal [data-change-email]')) accountView();
    }).catch(function () {});
  });
  var accountRefreshAt = 0;
  function refreshAfterVerification(force) {
    if (!state.user || document.visibilityState !== 'visible' || (force !== true && Date.now() - accountRefreshAt < 1500)) return;
    accountRefreshAt = Date.now(); refresh().then(function () { if (document.querySelector('.aim-account-modal [data-change-email]')) accountView(); }).catch(function () {});
  }
  window.addEventListener('focus', refreshAfterVerification);
  window.addEventListener('online', function () { refresh().catch(function () {}); });
  window.addEventListener('aim-gameplay-state', function (event) { if (!event.detail?.active) retryQueuedScores(state.user).catch(function () {}); });
  try { var accountChannel = new BroadcastChannel('aim-account-updates'); accountChannel.onmessage = function (event) { if (event.data === 'email-verified') refreshAfterVerification(true); }; } catch (_) {}
  refresh().catch(function () { applyAccount(null); }).then(handlePaypalReturn).finally(adblockCheck);
  scoreWatcher();
  legacyAuthBridge();
}());
