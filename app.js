/* ============================================================
   段位エディター - app.js
   GAS API連携 + 全ページロジック
   ============================================================ */

// ============================================================
// 設定：GAS APIのURLをここに入れてください
// ============================================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbwljVlA1OipITa2uPEGPxWkjBWbwlBVChxjnQvr-Mpgpxn6wRWlKfaXItKQp0cwnvk5/exec"; // ← デプロイしたGASのWebアプリURLを貼り付ける

// スプレッドシートのシート名
const SHEETS = {
  DANI:       "段位",       // 段位一覧
  CHALLENGES: "挑戦",       // 挑戦中・完了記録
};

// リザルト画像アップロード（ImgBB）- オプション
// https://imgbb.com/ でAPIキーを取得してください（無料）
// 2週間後の自動削除には ImgBB の expiration 設定を使います
const IMGBB_API_KEY = "a8f8ff022ebc34d0cacbaa9254fdd4c2"; // ← 取得したAPIキーを入れる（不要なら空欄）

// ============================================================
// 状態管理
// ============================================================
let currentUser   = null;   // ログインユーザー名
let allDani       = [];     // 全段位データ
let allChallenges = [];     // 全挑戦データ
let myChallengingIds = [];  // 現在挑戦中の段位IDリスト

let pendingChallengeCard = null;   // 挑戦モーダル対象
let pendingResultId = null;        // リザルト提出対象

// ============================================================
// ユーティリティ
// ============================================================

function $(id) { return document.getElementById(id); }

function showToast(msg, type = "info", duration = 3000) {
  const c = $("toast-container");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity 0.3s"; setTimeout(() => t.remove(), 300); }, duration);
}

function setMsg(el, msg, type) {
  el.textContent = msg;
  el.className = `result-msg ${type}`;
  el.classList.remove("hidden");
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// ============================================================
// GAS API 呼び出し
// ============================================================

async function gasGet(params) {
  const url = new URL(GAS_URL);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

async function gasPost(body) {
  // GAS WebアプリはCORSリダイレクトを行うため redirect:"follow" が必要
  // Content-Typeをtext/plainにしてpreflight(OPTIONS)を回避する
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
    redirect: "follow",
  });
  return res.json();
}

// 段位一覧を取得
async function fetchDani() {
  try {
    const r = await gasGet({ action: "read", sheet: SHEETS.DANI });
    if (r.ok) {
      allDani = r.data.rows.filter(d => d.id);
      return allDani;
    }
  } catch(e) {
    console.error("段位取得エラー", e);
  }
  return [];
}

// 挑戦データ取得
async function fetchChallenges() {
  try {
    const r = await gasGet({ action: "read", sheet: SHEETS.CHALLENGES });
    if (r.ok) {
      allChallenges = r.data.rows.filter(d => d.id);
      return allChallenges;
    }
  } catch(e) {
    console.error("挑戦データ取得エラー", e);
  }
  return [];
}

// ============================================================
// スプラッシュ → ログイン
// ============================================================
window.addEventListener("DOMContentLoaded", () => {
  // スプラッシュ終了
  setTimeout(() => {
    $("splash").classList.add("fade-out");
    setTimeout(() => {
      $("splash").remove();
      // ローカルにログイン情報があればそのまま進む
      const saved = localStorage.getItem("dani_user");
      if (saved) {
        currentUser = saved;
        startApp();
      } else {
        $("login-screen").classList.remove("hidden");
      }
    }, 600);
  }, 1600);

  // ログインボタン
  $("login-btn").addEventListener("click", handleLogin);
  $("login-username").addEventListener("keydown", e => { if (e.key === "Enter") handleLogin(); });
});

function handleLogin() {
  const name = $("login-username").value.trim();
  if (!name) { showToast("ユーザー名を入力してください", "error"); return; }
  if (name.length < 2) { showToast("2文字以上で入力してください", "error"); return; }
  currentUser = name;
  localStorage.setItem("dani_user", name);
  $("login-screen").classList.add("hidden");
  startApp();
}

// ============================================================
// アプリ起動
// ============================================================
async function startApp() {
  $("app").classList.remove("hidden");
  $("nav-username-display").textContent = currentUser;
  $("mypage-username-display").textContent = `${currentUser} さんのプロフィール`;

  // ナビゲーション
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active", "hidden"));
      document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
      const target = $(`page-${tab.dataset.page}`);
      target.classList.remove("hidden");
      target.classList.add("active");
      if (tab.dataset.page === "mypage") renderMyPage();
    });
  });

  $("logout-btn").addEventListener("click", () => {
    if (confirm("ログアウトしますか？")) {
      localStorage.removeItem("dani_user");
      location.reload();
    }
  });

  // データ読み込み
  await loadAll();

  // 登録フォーム初期化
  initRegisterForm();
  // フィルター初期化
  initFilters();
  // モーダル設定
  initModals();
}

async function loadAll() {
  await Promise.all([fetchDani(), fetchChallenges()]);
  updateMyChallengingIds();
  renderDaniGrid();
}

function updateMyChallengingIds() {
  myChallengingIds = allChallenges
    .filter(c => c.username === currentUser && c.status === "挑戦中")
    .map(c => c.daniId);
}

// ============================================================
// 段位挑戦ページ：グリッド描画
// ============================================================
function renderDaniGrid(list = null) {
  const grid = $("dani-grid");
  const data = list || allDani;

  if (!data.length) {
    grid.innerHTML = '<div class="empty-state">段位がまだ登録されていません<br>「段位登録」から作成してみましょう！</div>';
    return;
  }

  grid.innerHTML = "";
  data.forEach((d, i) => {
    const songs    = parseSongs(d.songs);
    const tags     = parseTags(d.tags);
    const isChall  = myChallengingIds.includes(d.id);
    const challCount = allChallenges.filter(c => c.daniId === d.id && c.status === "挑戦中").length;

    const card = document.createElement("div");
    card.className = `dani-card${isChall ? " is-challenging" : ""}`;
    card.style.animationDelay = `${i * 40}ms`;

    card.innerHTML = `
      <div class="card-top"></div>
      <div class="card-body">
        <div class="card-game-badge">${escHtml(d.game)}</div>
        <div class="card-title">${escHtml(d.name)}</div>
        <div class="card-author">by ${escHtml(d.author)}</div>
        <div class="card-songs">
          ${songs.slice(0,3).map(s => `
            <div class="card-song-item">
              <span class="song-level-badge ${levelClass(s.diff)}">${escHtml(s.diff||"")}</span>
              <span>${escHtml(s.name)}</span>
              ${s.level ? `<span style="margin-left:auto;font-size:0.72rem;color:var(--text-secondary)">Lv.${escHtml(s.level)}</span>` : ""}
            </div>
          `).join("")}
          ${songs.length > 3 ? `<div class="card-song-item" style="color:var(--text-secondary);font-size:0.75rem">他 ${songs.length-3} 曲...</div>` : ""}
        </div>
        <div class="card-life">❤️ LIFE: ${escHtml(String(d.life||""))}</div>
        ${d.comment ? `<div class="card-comment">${escHtml(d.comment)}</div>` : ""}
        ${tags.length ? `<div class="card-tags">${tags.map(t=>`<span class="tag-badge">${escHtml(t)}</span>`).join("")}</div>` : ""}
        ${(d.dateFrom||d.dateTo) ? `<div class="card-period">📅 ${escHtml(d.dateFrom||"")} 〜 ${escHtml(d.dateTo||"")}</div>` : ""}
      </div>
      <div class="card-footer">
        <span class="challenge-count-badge">挑戦中: ${challCount}人</span>
        <button class="btn btn-sm ${isChall ? "btn-success" : "btn-primary"} btn-challenge" data-id="${d.id}">
          ${isChall ? "✅ 挑戦中" : "🏆 挑戦する"}
        </button>
      </div>
    `;

    // クリックで詳細モーダル
    card.querySelector(".card-body").addEventListener("click", () => openDaniModal(d));
    card.querySelector(".card-footer .btn-challenge").addEventListener("click", e => {
      e.stopPropagation();
      if (isChall) {
        openDaniModal(d);
      } else {
        handleChallenge(d);
      }
    });

    grid.appendChild(card);
  });

  // 挑戦中バナー更新
  updateChallengeBanner();
}

function updateChallengeBanner() {
  const banner = $("challenge-active-banner");
  const list   = $("challenge-active-list");
  if (!myChallengingIds.length) { banner.classList.add("hidden"); return; }
  const names = allDani
    .filter(d => myChallengingIds.includes(d.id))
    .map(d => d.name);
  list.textContent = names.join("、");
  banner.classList.remove("hidden");
}

// ============================================================
// 挑戦登録
// ============================================================
async function handleChallenge(dani) {
  if (myChallengingIds.length >= 3) {
    showToast("挑戦できる段位は最大3つまでです", "error"); return;
  }
  if (myChallengingIds.includes(dani.id)) {
    showToast("すでに挑戦中です", "info"); return;
  }
  if (!confirm(`「${dani.name}」に挑戦しますか？`)) return;

  const rec = {
    id:        generateId(),
    daniId:    dani.id,
    daniName:  dani.name,
    username:  currentUser,
    status:    "挑戦中",
    score:     "",
    exScore:   "",
    lifeLeft:  "",
    passDate:  "",
    imageUrl:  "",
    createdAt: new Date().toISOString(),
  };

  try {
    const r = await gasPost({ action: "append", sheet: SHEETS.CHALLENGES, row: rec });
    if (r.ok) {
      showToast(`「${dani.name}」に挑戦登録しました！`, "success");
      await loadAll();
    } else {
      showToast("エラー: " + r.error, "error");
    }
  } catch(e) {
    showToast("通信エラーが発生しました", "error");
  }
}

// ============================================================
// 段位詳細モーダル
// ============================================================
function openDaniModal(d) {
  const songs  = parseSongs(d.songs);
  const tags   = parseTags(d.tags);
  const isChall = myChallengingIds.includes(d.id);
  const challRec = allChallenges.find(c => c.daniId === d.id && c.username === currentUser && c.status === "挑戦中");

  $("modal-dani-content").innerHTML = `
    <div class="modal-dani-header">
      <div class="modal-dani-title">${escHtml(d.name)}</div>
      <div class="modal-dani-meta">
        <span class="card-game-badge">${escHtml(d.game)}</span>
        <span style="font-size:0.8rem;color:var(--text-secondary)">by ${escHtml(d.author)}</span>
        ${tags.map(t=>`<span class="tag-badge">${escHtml(t)}</span>`).join("")}
      </div>
    </div>

    <div class="modal-songs">
      <div class="modal-songs-title">収録曲 (${songs.length}曲)</div>
      ${songs.map((s,i) => `
        <div class="modal-song-row">
          <span class="modal-song-num">${i+1}</span>
          <span class="modal-song-name">${escHtml(s.name)}</span>
          <span class="song-level-badge ${levelClass(s.diff)}">${escHtml(s.diff||"")}</span>
          ${s.level ? `<span class="modal-song-diff">Lv.${escHtml(s.level)}</span>` : ""}
        </div>
      `).join("")}
    </div>

    <div class="modal-info-grid">
      <div class="modal-info-item">
        <div class="modal-info-label">LIFE</div>
        <div class="modal-info-value" style="color:var(--chunithm-green)">❤️ ${escHtml(String(d.life||""))}</div>
      </div>
      <div class="modal-info-item">
        <div class="modal-info-label">ライフ減少</div>
        <div class="modal-info-value">${escHtml(d.lifeDecrease||"設定なし")}</div>
      </div>
      <div class="modal-info-item">
        <div class="modal-info-label">回復方法</div>
        <div class="modal-info-value">${escHtml(d.lifeRecover||"設定なし")}</div>
      </div>
      <div class="modal-info-item">
        <div class="modal-info-label">期間</div>
        <div class="modal-info-value" style="font-size:0.8rem">${escHtml(d.dateFrom||"")  }${(d.dateFrom&&d.dateTo)?" 〜 ":""}${escHtml(d.dateTo||"") || "期間なし"}</div>
      </div>
    </div>

    ${d.condition ? `
      <div class="modal-comment">
        <div class="modal-comment-label">条件詳細</div>
        <div class="modal-comment-text">${escHtml(d.condition)}</div>
      </div>
    ` : ""}

    ${d.comment ? `
      <div class="modal-comment">
        <div class="modal-comment-label">一言</div>
        <div class="modal-comment-text">${escHtml(d.comment)}</div>
      </div>
    ` : ""}

    <div class="modal-actions" id="modal-dani-actions">
      ${isChall ? `
        <button class="btn btn-success" onclick="openResultModal('${d.id}', '${escHtml(d.name).replace(/'/g,"\\'")}')">🎯 リザルト提出</button>
        <button class="btn btn-danger" onclick="handleWithdraw('${challRec?.id||""}', '${d.name.replace(/'/g,"\\'")}')">❌ 参加取り消し</button>
      ` : myChallengingIds.length >= 3 ? `
        <button class="btn btn-ghost" disabled>挑戦上限（3つ）に達しています</button>
      ` : `
        <button class="btn btn-primary" onclick="handleChallengeFromModal('${d.id}')">🏆 挑戦する</button>
      `}
      <button class="btn btn-ghost" onclick="document.getElementById('modal-dani').classList.add('hidden')">閉じる</button>
    </div>
  `;

  $("modal-dani").classList.remove("hidden");
}

window.handleChallengeFromModal = async (daniId) => {
  const d = allDani.find(d => d.id === daniId);
  if (d) {
    $("modal-dani").classList.add("hidden");
    await handleChallenge(d);
  }
};

// 参加取り消し
window.handleWithdraw = async (challengeRecId, daniName) => {
  if (!confirm(`「${daniName}」の挑戦を取り消しますか？`)) return;
  try {
    const r = await gasPost({ action: "delete", sheet: SHEETS.CHALLENGES, keyCol: "id", keyValue: challengeRecId });
    if (r.ok) {
      showToast("挑戦を取り消しました", "success");
      $("modal-dani").classList.add("hidden");
      await loadAll();
    } else {
      showToast("エラー: " + r.error, "error");
    }
  } catch(e) {
    showToast("通信エラーが発生しました", "error");
  }
};

// ============================================================
// リザルト提出モーダル
// ============================================================
function openResultModal(daniId, daniName) {
  pendingResultId = daniId;
  $("modal-result-dani-name").textContent = daniName;
  $("result-score").value = "";
  $("result-ex").value = "";
  $("result-life").value = "";
  document.querySelectorAll("input[name=result-pass]").forEach(r => r.checked = false);
  $("result-image").value = "";
  $("result-submit-msg").classList.add("hidden");
  $("modal-dani").classList.add("hidden");
  $("modal-result").classList.remove("hidden");
}
window.openResultModal = openResultModal;

$("result-submit-btn")?.addEventListener("click", async () => {
  const score    = $("result-score").value.trim();
  const exScore  = $("result-ex").value.trim();
  const lifeLeft = $("result-life").value.trim();
  const passEl   = document.querySelector("input[name=result-pass]:checked");
  const imageFile = $("result-image").files[0];
  const msgEl    = $("result-submit-msg");

  if (!score && !exScore) { setMsg(msgEl, "スコアかExスコアを入力してください", "error"); return; }
  if (!passEl) { setMsg(msgEl, "合否を選択してください", "error"); return; }

  $("result-submit-btn").disabled = true;
  $("result-submit-btn").textContent = "提出中...";

  try {
    let imageUrl = "";
    // ImgBBへのアップロード
    if (imageFile && IMGBB_API_KEY && IMGBB_API_KEY !== "YOUR_IMGBB_API_KEY_HERE") {
      const fd = new FormData();
      fd.append("image", imageFile);
      fd.append("expiration", "1209600"); // 14日 = 2週間
      fd.append("key", IMGBB_API_KEY);
      const imgRes = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: fd });
      const imgData = await imgRes.json();
      if (imgData.success) imageUrl = imgData.data.url;
    }

    // 対象の挑戦レコードを探す
    const rec = allChallenges.find(c => c.daniId === pendingResultId && c.username === currentUser && c.status === "挑戦中");
    if (!rec) { setMsg(msgEl, "挑戦記録が見つかりません", "error"); return; }

    const passed = passEl.value === "合格";
    const updates = {
      score:    score,
      exScore:  exScore,
      lifeLeft: lifeLeft,
      status:   passed ? "合格" : "不合格",
      passDate: passed ? new Date().toISOString() : "",
      imageUrl: imageUrl,
    };

    const r = await gasPost({ action: "update", sheet: SHEETS.CHALLENGES, keyCol: "id", keyValue: rec.id, updates });
    if (r.ok) {
      showToast(passed ? "🎉 合格おめでとうございます！" : "お疲れ様でした！結果を記録しました", passed ? "success" : "info");
      $("modal-result").classList.add("hidden");
      await loadAll();
    } else {
      setMsg(msgEl, "エラー: " + r.error, "error");
    }
  } catch(e) {
    setMsg(msgEl, "通信エラーが発生しました", "error");
  } finally {
    $("result-submit-btn").disabled = false;
    $("result-submit-btn").textContent = "提出する";
  }
});

// ============================================================
// マイページ
// ============================================================
function renderMyPage() {
  const myChallenging = allChallenges.filter(c => c.username === currentUser && c.status === "挑戦中");
  const myPassed      = allChallenges.filter(c => c.username === currentUser && c.status === "合格");

  // 挑戦中リスト
  const challEl = $("my-challenges");
  if (!myChallenging.length) {
    challEl.innerHTML = '<div class="empty-state">現在挑戦中の段位はありません</div>';
  } else {
    challEl.innerHTML = myChallenging.map(c => {
      const dani = allDani.find(d => d.id === c.daniId);
      return `
        <div class="challenge-item">
          <div class="challenge-item-title">${escHtml(c.daniName)}</div>
          <div class="challenge-item-sub">
            ${dani ? `機種: ${escHtml(dani.game)}` : ""}
            &nbsp;｜&nbsp; 登録日: ${formatDate(c.createdAt)}
          </div>
          <div class="challenge-item-actions">
            <button class="btn btn-success btn-sm" onclick="openResultModal('${c.daniId}','${escHtml(c.daniName).replace(/'/g,"\\'")}')">🎯 リザルト提出</button>
            <button class="btn btn-danger btn-sm" onclick="handleWithdraw('${c.id}','${escHtml(c.daniName).replace(/'/g,"\\'")}')">❌ 取り消し</button>
          </div>
        </div>
      `;
    }).join("");
  }

  // 合格済みリスト
  const passedEl = $("my-passed");
  if (!myPassed.length) {
    passedEl.innerHTML = '<div class="empty-state">まだ合格した段位はありません</div>';
  } else {
    passedEl.innerHTML = [...myPassed].sort((a,b) => new Date(b.passDate) - new Date(a.passDate)).map(c => {
      const dani = allDani.find(d => d.id === c.daniId);
      return `
        <div class="passed-item">
          <div class="passed-item-header">
            <div>
              <div class="passed-item-title">${escHtml(c.daniName)}</div>
              <div class="passed-item-sub">${dani ? escHtml(dani.game) : ""}</div>
            </div>
            <span class="passed-badge">✅ 合格</span>
          </div>
          <div class="passed-item-sub">
            ${c.lifeLeft ? `<span class="passed-life">残LIFE: ${escHtml(c.lifeLeft)}</span>&nbsp; ` : ""}
            ${c.score   ? `<span class="passed-score">スコア: ${escHtml(c.score)}</span>&nbsp; ` : ""}
            ${c.exScore ? `<span class="passed-score">Ex: ${escHtml(c.exScore)}</span>` : ""}
          </div>
          <div class="passed-item-sub" style="margin-top:4px">合格日: ${formatDate(c.passDate)}</div>
          ${c.imageUrl ? `<img src="${escHtml(c.imageUrl)}" alt="リザルト" style="width:100%;border-radius:8px;margin-top:8px;max-height:200px;object-fit:contain;">` : ""}
        </div>
      `;
    }).join("");
  }
}

// ============================================================
// 段位登録フォーム
// ============================================================
function initRegisterForm() {
  let songCount = 0;

  function addSong() {
    if (songCount >= 5) { showToast("曲は最大5曲まで追加できます", "error"); return; }
    songCount++;
    const idx = songCount;
    const entry = document.createElement("div");
    entry.className = "song-entry";
    entry.dataset.songIdx = idx;
    entry.innerHTML = `
      <div class="song-entry-header">
        <span class="song-entry-num">曲 ${idx}</span>
        ${idx > 1 ? `<button type="button" class="btn btn-danger btn-sm remove-song">✕ 削除</button>` : ""}
      </div>
      <div class="form-group">
        <label class="form-label">曲名 <span class="required">*</span></label>
        <input type="text" class="text-input song-name" placeholder="曲名を入力...">
      </div>
      <div class="form-row-2">
        <div class="form-group" style="margin:0">
          <label class="form-label">難易度（任意）</label>
          <input type="text" class="text-input song-diff" placeholder="例: MASTER、EXPERT">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">レベル（任意）</label>
          <input type="text" class="text-input song-level" placeholder="例: 13+">
        </div>
      </div>
    `;
    entry.querySelector(".remove-song")?.addEventListener("click", () => {
      entry.remove();
      songCount--;
      document.querySelectorAll(".song-entry").forEach((e, i) => {
        e.querySelector(".song-entry-num").textContent = `曲 ${i+1}`;
      });
    });
    $("song-list").appendChild(entry);
  }

  // 初期1曲
  addSong();
  $("add-song-btn").addEventListener("click", addSong);

  // ライフ減り方：カスタム選択時に記入欄を表示
  $("reg-life-decrease").addEventListener("change", () => {
    $("reg-life-decrease-custom").classList.toggle("hidden", $("reg-life-decrease").value !== "カスタム");
  });

  // 回復の仕方：カスタム選択時に記入欄を表示
  $("reg-life-recover").addEventListener("change", () => {
    $("reg-life-recover-custom").classList.toggle("hidden", $("reg-life-recover").value !== "カスタム");
  });

  // プレビュー
  $("reg-preview-btn").addEventListener("click", () => {
    const data = collectRegisterForm();
    if (!data) return;
    showPreview(data);
  });

  // 投稿
  $("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = collectRegisterForm();
    if (!data) return;

    const submitBtn = $("register-form").querySelector("button[type=submit]");
    submitBtn.disabled = true; submitBtn.textContent = "投稿中...";

    const rec = {
      id:            generateId(),
      name:          data.name,
      game:          data.game,
      author:        currentUser,
      dateFrom:      data.dateFrom,
      dateTo:        data.dateTo,
      songs:         JSON.stringify(data.songs),
      life:          data.life,
      lifeDecrease:  data.lifeDecrease,
      lifeRecover:   data.lifeRecover,
      condition:     data.condition,
      comment:       data.comment,
      tags:          data.tags,
      createdAt:     new Date().toISOString(),
    };

    try {
      const r = await gasPost({ action: "append", sheet: SHEETS.DANI, row: rec });
      const msgEl = $("reg-result");
      if (r.ok) {
        setMsg(msgEl, "✅ 段位を投稿しました！", "success");
        $("register-form").reset();
        $("song-list").innerHTML = "";
        songCount = 0;
        addSong();
        // カスタム記入欄を再度隠す
        $("reg-life-decrease-custom").classList.add("hidden");
        $("reg-life-recover-custom").classList.add("hidden");
        await loadAll();
        showToast("段位を投稿しました！", "success");
      } else {
        setMsg(msgEl, "エラー: " + r.error, "error");
      }
    } catch(e) {
      console.error(e);
      setMsg($("reg-result"), "通信エラー: " + e.message, "error");
    } finally {
      submitBtn.disabled = false; submitBtn.textContent = "🚀 段位を投稿する";
    }
  });
}

function collectRegisterForm() {
  const name = $("reg-name").value.trim();
  const game = $("reg-game").value.trim();
  const life = $("reg-life").value.trim();

  if (!name) { showToast("段位名を入力してください", "error"); return null; }
  if (!game) { showToast("機種を入力してください", "error"); return null; }
  if (!life) { showToast("LIFEを入力してください", "error"); return null; }

  // カスタム値を解決：セレクトで「カスタム」が選ばれていたら記入欄の値を使う
  const decreaseRaw = $("reg-life-decrease").value;
  const lifeDecrease = decreaseRaw === "カスタム"
    ? $("reg-life-decrease-custom").value.trim() || "カスタム"
    : decreaseRaw;

  const recoverRaw = $("reg-life-recover").value;
  const lifeRecover = recoverRaw === "カスタム"
    ? $("reg-life-recover-custom").value.trim() || "カスタム"
    : recoverRaw;

  const songs = [];
  document.querySelectorAll(".song-entry").forEach(e => {
    const n = e.querySelector(".song-name").value.trim();
    if (n) songs.push({
      name:  n,
      diff:  e.querySelector(".song-diff").value.trim(),
      level: e.querySelector(".song-level").value.trim(),
    });
  });
  if (!songs.length) { showToast("曲を最低1曲追加してください", "error"); return null; }

  return {
    name, game, life,
    dateFrom:     $("reg-date-from").value,
    dateTo:       $("reg-date-to").value,
    songs,
    lifeDecrease,
    lifeRecover,
    condition:    $("reg-condition").value.trim(),
    comment:      $("reg-comment").value.trim(),
    tags:         $("reg-tags").value.trim(),
  };
}

function showPreview(data) {
  const songs = data.songs;
  $("preview-content").innerHTML = `
    <div class="modal-dani-header">
      <div class="modal-dani-title">${escHtml(data.name)}</div>
      <div class="modal-dani-meta">
        <span class="card-game-badge">${escHtml(data.game)}</span>
        <span style="font-size:0.8rem;color:var(--text-secondary)">by ${escHtml(currentUser)}</span>
        ${parseTags(data.tags).map(t=>`<span class="tag-badge">${escHtml(t)}</span>`).join("")}
      </div>
    </div>
    <div class="modal-songs">
      <div class="modal-songs-title">収録曲</div>
      ${songs.map((s,i) => `
        <div class="modal-song-row">
          <span class="modal-song-num">${i+1}</span>
          <span class="modal-song-name">${escHtml(s.name)}</span>
          ${s.diff ? `<span class="song-level-badge ${levelClass(s.diff)}">${escHtml(s.diff)}</span>` : ""}
          ${s.level ? `<span class="modal-song-diff">Lv.${escHtml(s.level)}</span>` : ""}
        </div>
      `).join("")}
    </div>
    <div class="modal-info-grid">
      <div class="modal-info-item"><div class="modal-info-label">LIFE</div><div class="modal-info-value" style="color:var(--chunithm-green)">❤️ ${escHtml(data.life)}</div></div>
      <div class="modal-info-item"><div class="modal-info-label">ライフ減少</div><div class="modal-info-value">${escHtml(data.lifeDecrease||"設定なし")}</div></div>
      <div class="modal-info-item"><div class="modal-info-label">回復方法</div><div class="modal-info-value">${escHtml(data.lifeRecover||"設定なし")}</div></div>
      <div class="modal-info-item"><div class="modal-info-label">期間</div><div class="modal-info-value" style="font-size:0.8rem">${data.dateFrom||""}${(data.dateFrom&&data.dateTo)?" 〜 ":""}${data.dateTo||"期間なし"}</div></div>
    </div>
    ${data.condition ? `<div class="modal-comment"><div class="modal-comment-label">条件詳細</div><div class="modal-comment-text">${escHtml(data.condition)}</div></div>` : ""}
    ${data.comment ? `<div class="modal-comment"><div class="modal-comment-label">一言</div><div class="modal-comment-text">${escHtml(data.comment)}</div></div>` : ""}
  `;
  $("modal-preview").classList.remove("hidden");
}

// ============================================================
// フィルター
// ============================================================
function initFilters() {
  function getFilteredList() {
    const game   = $("filter-game").value;
    const tag    = $("filter-tag").value;
    const search = $("filter-search").value.toLowerCase();
    return allDani.filter(d => {
      if (game   && d.game  !== game)       return false;
      if (tag    && !parseTags(d.tags).includes(tag)) return false;
      if (search && !d.name.toLowerCase().includes(search) && !d.comment?.toLowerCase().includes(search)) return false;
      return true;
    });
  }

  function refreshSelects() {
    const games = [...new Set(allDani.map(d => d.game).filter(Boolean))];
    const tags  = [...new Set(allDani.flatMap(d => parseTags(d.tags)))];
    const gSel = $("filter-game");
    const tSel = $("filter-tag");
    const gv = gSel.value, tv = tSel.value;
    gSel.innerHTML = `<option value="">すべての機種</option>${games.map(g=>`<option value="${escHtml(g)}">${escHtml(g)}</option>`).join("")}`;
    tSel.innerHTML = `<option value="">すべてのタグ</option>${tags.map(t=>`<option value="${escHtml(t)}">${escHtml(t)}</option>`).join("")}`;
    gSel.value = gv; tSel.value = tv;
  }

  // データ読み込み後に呼ばれるよう上書き
  const _loadAll = loadAll;
  loadAll = async () => {
    await _loadAll();
    refreshSelects();
  };

  ["filter-game","filter-tag","filter-search"].forEach(id => {
    $(id)?.addEventListener("input", () => renderDaniGrid(getFilteredList()));
    $(id)?.addEventListener("change", () => renderDaniGrid(getFilteredList()));
  });

  $("filter-reset")?.addEventListener("click", () => {
    $("filter-game").value = "";
    $("filter-tag").value  = "";
    $("filter-search").value = "";
    renderDaniGrid();
  });
}

// ============================================================
// モーダル共通
// ============================================================
function initModals() {
  $("modal-close")?.addEventListener("click",         () => $("modal-dani").classList.add("hidden"));
  $("modal-result-close")?.addEventListener("click",  () => $("modal-result").classList.add("hidden"));
  $("modal-preview-close")?.addEventListener("click", () => $("modal-preview").classList.add("hidden"));

  [$("modal-dani"), $("modal-result"), $("modal-preview")].forEach(m => {
    m?.addEventListener("click", e => { if (e.target === m) m.classList.add("hidden"); });
  });
}

// ============================================================
// ヘルパー関数
// ============================================================

function parseSongs(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function parseTags(raw) {
  if (!raw) return [];
  return raw.split(/[,、，]/).map(t => t.trim()).filter(Boolean);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function levelClass(diff) {
  const map = {
    "BASIC":"lv-BASIC","ADVANCED":"lv-ADVANCED","EXPERT":"lv-EXPERT",
    "MASTER":"lv-MASTER","ULTIMA":"lv-ULTIMA","WORLD'S END":"lv-ULTIMA",
  };
  return map[diff] || "lv-custom";
}
