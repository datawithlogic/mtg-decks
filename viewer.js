/* Generic deck-map viewer.
 * Reads <script type="application/json" id="deck-data"> from the page and
 * renders the full deck map: groups, chips, synergy clusters w/ deep-dives,
 * relationship highlighting, Scryfall card modal, builder/share views.
 *
 * Interaction model:
 *  - Pointer (desktop): hover = highlight related chips + tooltip;
 *    click = card modal.
 *  - Touch: first tap = highlight related chips + info bar at bottom;
 *    second tap on the same chip = card modal. Tap elsewhere clears.
 *  - Modal (both): shows the card's role in this deck and a tappable
 *    "related in this deck" chip row, so relationships stay explorable
 *    without leaving the popup.
 *
 * Default view = share (friend-facing). ?view=builder shows diff markers.
 */
(function () {
  const data = JSON.parse(document.getElementById("deck-data").textContent);
  const TOUCH = window.matchMedia("(hover: none)").matches;
  const esc = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  document.title = data.name + " — Deck Map";

  /* ---------- build DOM ---------- */
  const chipHtml = (c) => {
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
      <div class="chips">${g.cards.map(chipHtml).join("")}</div>
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
      <span>${TOUCH
        ? "<b style='color:var(--text)'>tap card</b> = light up synergies · <b style='color:var(--text)'>tap again</b> = image &amp; text · <b style='color:var(--text)'>tap cluster</b> = deep-dive"
        : "<b style='color:var(--text)'>hover</b> = light up synergies · <b style='color:var(--text)'>click card</b> = image &amp; text · <b style='color:var(--text)'>click cluster</b> = deep-dive"}</span>
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
    <div class="touchbar" id="touchbar"></div>
    <div id="overlay"><div id="cardBox"></div></div>`;

  /* ---------- shared state ---------- */
  const tip = document.getElementById("tip");
  const touchbar = document.getElementById("touchbar");
  const chips = [...document.querySelectorAll(".chip")];
  const detail = document.getElementById("clusterDetail");
  let pinned = null;      // pinned cluster key
  let selected = null;    // touch: currently selected chip

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
  function clearSelection() {
    if (selected) selected.classList.remove("sel");
    selected = null;
    touchbar.classList.remove("show");
    pinned ? light([pinned]) : clearLight();
  }

  /* ---------- pointer (hover) interactions ---------- */
  if (!TOUCH) {
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
  }

  /* ---------- chip tap/click ---------- */
  chips.forEach((c) => {
    c.addEventListener("click", (e) => {
      e.stopPropagation();
      if (TOUCH && c.dataset.k && selected !== c) {
        // first tap: select + show relationships
        if (selected) selected.classList.remove("sel");
        selected = c;
        c.classList.add("sel");
        light(c.dataset.k.split(" "));
        const more = c.dataset.name ? " — <i>tap again for card details</i>" : "";
        touchbar.innerHTML = `<b>${esc(c.textContent)}</b>${c.dataset.tip ? " · " + esc(c.dataset.tip) : ""}${more}`;
        touchbar.classList.add("show");
        return;
      }
      // second tap (touch) or any click (pointer): open card
      if (c.dataset.name) openCard(c.dataset.name);
    });
  });
  // tap on empty space clears touch selection
  document.addEventListener("click", (e) => {
    if (TOUCH && !e.target.closest(".chip") && !e.target.closest("#overlay")) clearSelection();
  });

  /* ---------- cluster deep-dive panel ---------- */
  const clusterMap = Object.fromEntries(data.clusters.map((c) => [c.k, c]));
  document.querySelectorAll(".cluster").forEach((cl) => {
    cl.addEventListener("click", (e) => {
      e.stopPropagation();
      const k = cl.dataset.k;
      if (pinned === k) {
        pinned = null; clearLight(); detail.style.display = "none";
        document.querySelectorAll(".cluster").forEach((x) => x.classList.remove("active"));
        return;
      }
      pinned = k;
      clearSelection();
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

  /* ---------- related-card computation (for the modal) ---------- */
  function relatedTo(chip) {
    if (!chip || !chip.dataset.k) return [];
    const mine = chip.dataset.k.split(" ");
    const share = document.body.classList.contains("share");
    return chips.filter((o) => {
      if (o === chip || !o.dataset.k || !o.dataset.name) return false;
      if (share && o.closest(".pulled")) return false;
      return o.dataset.k.split(" ").some((t) => mine.includes(t));
    }).slice(0, 10);
  }

  /* ---------- card modal ---------- */
  const overlay = document.getElementById("overlay");
  const cardBox = document.getElementById("cardBox");
  const cache = {};
  const closeCard = () => { overlay.classList.remove("open"); };

  async function openCard(name) {
    const srcChip = chips.find((c) => c.dataset.name === name);
    overlay.classList.add("open");
    cardBox.innerHTML = '<div class="loading">Fetching from Scryfall…</div>';
    let body;
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
      body = `
        ${img ? `<img src="${img}" alt="${esc(c.name)}">` : ""}
        <div class="info">
          <h3>${esc(c.name)} <small>${esc(c.mana_cost || face.mana_cost || "")}</small></h3>
          <div class="tl">${esc(c.type_line)} · ${esc(c.set_name)} (${c.set.toUpperCase()})${c.power ? ` · ${c.power}/${c.toughness}` : ""}</div>
          <div class="oracle">${esc(oracle)}</div>
          ${c.flavor_text ? `<div class="flavor">${esc(c.flavor_text)}</div>` : ""}
          <a href="${c.scryfall_uri}" target="_blank" rel="noopener">Scryfall ↗</a>
          &nbsp;·&nbsp; <a href="https://edhrec.com/route/?cc=${encodeURIComponent(c.name)}" target="_blank" rel="noopener">EDHREC ↗</a>
          &nbsp;·&nbsp; <a href="${tcg}" target="_blank" rel="noopener">TCGplayer ↗</a>
          <!--EXTRA-->
        </div>`;
    } catch (e) {
      body = `<div class="info"><h3>${esc(name)}</h3><p>Couldn't fetch card data (offline?).</p>
        <a href="https://scryfall.com/search?q=${encodeURIComponent('!"' + name + '"')}" target="_blank" rel="noopener">Search on Scryfall ↗</a>
        <!--EXTRA--></div>`;
    }
    // role-in-deck + related chips: relationships stay visible inside the modal
    let extra = "";
    if (srcChip && srcChip.dataset.tip) {
      extra += `<div class="roletip"><span class="relLbl">Role in this deck</span>${esc(srcChip.dataset.tip)}</div>`;
    }
    const rel = relatedTo(srcChip);
    if (rel.length) {
      extra += `<div class="relLbl">Related in this deck</div><div class="chips rel">${
        rel.map((o) => `<span class="chip" data-rel="${esc(o.dataset.name)}">${esc(o.textContent)}</span>`).join("")
      }</div>`;
    }
    cardBox.innerHTML = `<button class="close">✕</button>` + body.replace("<!--EXTRA-->", extra);
    cardBox.querySelector(".close").addEventListener("click", closeCard);
    cardBox.querySelectorAll("[data-rel]").forEach((o) =>
      o.addEventListener("click", () => openCard(o.dataset.rel)));
  }

  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeCard(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCard(); });

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
