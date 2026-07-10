/* Generic deck-map viewer.
 * Reads <script type="application/json" id="deck-data"> from the page and
 * renders the full deck map: groups, chips, synergy clusters w/ deep-dives,
 * hover highlighting, Scryfall card modal, builder/share views.
 * Default view = share (friend-facing). ?view=builder shows diff markers.
 */
(function () {
  const data = JSON.parse(document.getElementById("deck-data").textContent);
  const esc = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  document.title = data.name + " — Deck Map";

  /* ---------- build DOM ---------- */
  const chipHtml = (c, group) => {
    const cls = ["chip", c.cmdr ? "cmdr" : "", c.otter ? "otter" : "", c.new ? "new" : ""]
      .filter(Boolean).join(" ");
    const nm = c.name === null ? "" : ` data-name="${esc(c.name || c.n)}"`;
    const tags = c.tags ? ` data-k="${esc(c.tags)}"` : "";
    const tip = c.tip ? ` data-tip="${esc(c.tip)}"` : "";
    const mv = c.mv != null ? `<span class="mv">${esc(c.mv)}</span>` : "";
    return `<span class="${cls}"${nm}${tags}${tip}>${esc(c.n)}${mv}</span>`;
  };

  const groupHtml = (g, extraClass = "") => `
    <section class="group ${extraClass}">
      <h3>${esc(g.title)}</h3>
      <div class="desc">${esc(g.desc || "")}</div>
      <div class="chips">${g.cards.map((c) => chipHtml(c, g)).join("")}</div>
    </section>`;

  document.body.innerHTML = `
    <button id="viewToggle"></button>
    <h1>${esc(data.name)}</h1>
    <div class="sub">${esc(data.sub)}${data.revnote ? `<span class="revnote"> · ${esc(data.revnote)}</span>` : ""}</div>
    <div class="key">
      <span><i style="background:#2d2818;border:1px solid var(--gold)"></i>commander</span>
      <span class="diffkey"><i style="background:var(--panel2);border:1px solid var(--green)"></i>＋ new this rev</span>
      <span class="diffkey"><i style="background:#241a1c;border:1px solid #5a3a3a"></i>－ pulled this rev</span>
      ${data.accentLabel ? `<span><i style="background:var(--panel2);box-shadow:inset 3px 0 0 var(--u);border:1px solid #303a52"></i>${esc(data.accentLabel)}</span>` : ""}
      <span><b style="color:var(--text)">hover</b> = light up synergies · <b style="color:var(--text)">tap card</b> = image &amp; text · <b style="color:var(--text)">tap cluster</b> = deep-dive</span>
    </div>
    <div class="layout">
      <aside class="legend">
        <h2>Synergy clusters</h2>
        <div id="clusterDetail"></div>
        ${data.clusters.map((cl) =>
          `<div class="cluster" data-k="${esc(cl.k)}"><b>${esc(cl.label)}</b><span>${esc(cl.blurb)}</span></div>`).join("")}
        ${data.hint ? `<div class="hint">${esc(data.hint)}</div>` : ""}
      </aside>
      <main class="groups">
        ${data.groups.map((g) => groupHtml(g)).join("")}
        ${data.pulled ? groupHtml(data.pulled, "pulled") : ""}
      </main>
    </div>
    <div class="tip" id="tip"></div>
    <div id="overlay"><div id="cardBox"></div></div>`;

  /* ---------- hover highlighting ---------- */
  const tip = document.getElementById("tip");
  const chips = [...document.querySelectorAll(".chip")];
  const detail = document.getElementById("clusterDetail");
  let pinned = null;

  function light(keys) {
    document.body.classList.add("filtering");
    chips.forEach((c) => {
      const k = (c.dataset.k || "").split(" ");
      c.classList.toggle("lit", keys.some((x) => k.includes(x)));
    });
  }
  function clearLight() {
    document.body.classList.remove("filtering");
    chips.forEach((c) => c.classList.remove("lit"));
  }

  chips.forEach((c) => {
    c.addEventListener("mouseenter", () => {
      if (c.dataset.k) light(c.dataset.k.split(" "));
      if (c.dataset.tip) { tip.textContent = c.dataset.tip; tip.style.display = "block"; }
    });
    c.addEventListener("mousemove", (e) => {
      tip.style.left = Math.min(e.clientX + 14, innerWidth - 320) + "px";
      tip.style.top = e.clientY + 16 + "px";
    });
    c.addEventListener("mouseleave", () => {
      tip.style.display = "none";
      pinned ? light([pinned]) : clearLight();
    });
  });

  /* ---------- cluster deep-dive panel ---------- */
  const clusterMap = Object.fromEntries(data.clusters.map((c) => [c.k, c]));
  document.querySelectorAll(".cluster").forEach((cl) => {
    cl.addEventListener("click", () => {
      const k = cl.dataset.k;
      if (pinned === k) {
        pinned = null; clearLight(); detail.style.display = "none";
        document.querySelectorAll(".cluster").forEach((x) => x.classList.remove("active"));
        return;
      }
      pinned = k;
      document.querySelectorAll(".cluster").forEach((x) => x.classList.toggle("active", x === cl));
      light([k]);
      const d = clusterMap[k];
      detail.innerHTML = `<h4>${esc(d.label)}</h4>
        <p><span class="lbl">How it works</span>${esc(d.how)}</p>
        <p><span class="lbl">Example line</span>${esc(d.ex)}</p>
        <p class="why"><span class="lbl">Deckbuilding principle</span>${esc(d.why)}</p>`;
      detail.style.display = "block";
      if (innerWidth <= 760) detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  /* ---------- card click → Scryfall modal ---------- */
  const overlay = document.getElementById("overlay");
  const cardBox = document.getElementById("cardBox");
  const cache = {};
  const closeCard = () => overlay.classList.remove("open");

  async function openCard(name) {
    overlay.classList.add("open");
    cardBox.innerHTML = '<div class="loading">Fetching from Scryfall…</div>';
    try {
      if (!cache[name]) {
        const r = await fetch("https://api.scryfall.com/cards/named?fuzzy=" + encodeURIComponent(name));
        if (!r.ok) throw new Error("not found");
        cache[name] = await r.json();
      }
      const c = cache[name];
      const face = c.card_faces && !c.image_uris ? c.card_faces[0] : c;
      const img = (face.image_uris || c.image_uris || {}).normal;
      const oracle = c.card_faces
        ? c.card_faces.map((f) => `${f.name}  ${f.mana_cost || ""}\n${f.type_line}\n${f.oracle_text || ""}`).join("\n———\n")
        : c.oracle_text || "";
      const tcg = (c.purchase_uris && c.purchase_uris.tcgplayer) ||
        "https://www.tcgplayer.com/search/magic/product?q=" + encodeURIComponent(c.name);
      cardBox.innerHTML = `
        <button class="close">✕</button>
        ${img ? `<img src="${img}" alt="${esc(c.name)}">` : ""}
        <div class="info">
          <h3>${esc(c.name)} <small>${esc(c.mana_cost || face.mana_cost || "")}</small></h3>
          <div class="tl">${esc(c.type_line)} · ${esc(c.set_name)} (${c.set.toUpperCase()})${c.power ? ` · ${c.power}/${c.toughness}` : ""}</div>
          <div class="oracle">${esc(oracle)}</div>
          ${c.flavor_text ? `<div class="flavor">${esc(c.flavor_text)}</div>` : ""}
          <a href="${c.scryfall_uri}" target="_blank" rel="noopener">Scryfall ↗</a>
          &nbsp;·&nbsp; <a href="https://edhrec.com/route/?cc=${encodeURIComponent(c.name)}" target="_blank" rel="noopener">EDHREC ↗</a>
          &nbsp;·&nbsp; <a href="${tcg}" target="_blank" rel="noopener">TCGplayer ↗</a>
        </div>`;
    } catch (e) {
      cardBox.innerHTML = `<button class="close">✕</button>
        <div class="info"><h3>${esc(name)}</h3><p>Couldn't fetch card data (offline?).</p>
        <a href="https://scryfall.com/search?q=${encodeURIComponent('!"' + name + '"')}" target="_blank" rel="noopener">Search on Scryfall ↗</a></div>`;
    }
    cardBox.querySelector(".close").addEventListener("click", closeCard);
  }
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeCard(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCard(); });
  chips.forEach((c) => {
    if (c.dataset.name) c.addEventListener("click", () => openCard(c.dataset.name));
  });

  /* ---------- builder / share view toggle ---------- */
  const toggleBtn = document.getElementById("viewToggle");
  function setView(share) {
    document.body.classList.toggle("share", share);
    toggleBtn.textContent = share ? "🔧 Builder view" : "👁 Share view";
    try {
      const u = new URL(location.href);
      share ? u.searchParams.delete("view") : u.searchParams.set("view", "builder");
      history.replaceState(null, "", u);
    } catch (e) {}
  }
  toggleBtn.addEventListener("click", () => setView(!document.body.classList.contains("share")));
  let builder = false;
  try { builder = new URL(location.href).searchParams.get("view") === "builder"; } catch (e) {}
  setView(!builder); /* default = share (QR/friend-facing); ?view=builder for James */
})();
