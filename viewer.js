/* Generic deck-map viewer.
 * Reads <script type="application/json" id="deck-data"> from the page and
 * renders the full deck map: groups, chips, synergy clusters w/ deep-dives,
 * relationship highlighting, Scryfall card modal, builder/share views.
 *
 * Color system: every cluster gets a stable color (palette below, assigned
 * by cluster order). Legend entries carry their color on the left edge;
 * when relationships light up, each related card's border takes the color
 * of the cluster it shares with the selected card, so you can tell WHICH
 * synergy connects them. Card modal + touch bar show colored cluster
 * badges; tapping a badge in the modal jumps to that cluster's deep-dive.
 *
 * Interaction model:
 *  - Pointer (desktop): hover = highlight related chips + tooltip;
 *    click = card modal.
 *  - Touch: first tap = highlight related chips + info bar at bottom;
 *    second tap on the same chip = card modal. Tap elsewhere clears.
 *  - Cluster click = deep-dive panel, inserted DIRECTLY BELOW that cluster.
 *
 * Default view = share (friend-facing). ?view=builder shows diff markers.
 */
(function () {
  const data = JSON.parse(document.getElementById("deck-data").textContent);
  const TOUCH = window.matchMedia("(hover: none)").matches;
  const esc = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  document.title = data.name + " — Deck Map";

  /* ---------- cluster colors ----------
   * Okabe-Ito categorical palette (colorblind-safe), dark-bg adapted.
   * Methodology: standards/deck-map-ux.md (local). Assigned by cluster
   * order; a cluster may override via optional "color" field. Max 9. */
  const PALETTE = ["#56B4E9", "#E69F00", "#CC79A7", "#009E73", "#F0E442",
                   "#4A90D9", "#D55E00", "#9B7FE8", "#BDBDBD"];
  const clusterColor = {};
  data.clusters.forEach((c, i) => { clusterColor[c.k] = c.color || PALETTE[i % PALETTE.length]; });
  const clusterMap = Object.fromEntries(data.clusters.map((c) => [c.k, c]));
  const badge = (k, attrs = "") =>
    `<span class="cbadge" ${attrs} style="border-color:${clusterColor[k]};color:${clusterColor[k]}">${esc(clusterMap[k].label)}</span>`;

  /* ---------- build DOM ---------- */
  const chipHtml = (c) => {
    const cls = ["chip", c.cmdr ? "cmdr" : "", c.otter ? "otter" : "", c.new ? "new" : ""]
      .filter(Boolean).join(" ");
    const nm = c.name === null ? "" : ` data-name="${esc(c.name || c.n)}"`;
    const tags = c.tags ? ` data-k="${esc(c.tags)}"` : "";
    const tip = c.tip ? ` data-tip="${esc(c.tip)}"` : "";
    const mv = c.mv != null ? `<span class="mv">${esc(c.mv)}</span>` : "";
    const cnt = c.count > 1 ? `${c.count}× ` : "";
    return `<span class="${cls}"${nm}${tags}${tip}>${cnt}${esc(c.n)}${mv}</span>`;
  };

  const groupHtml = (g, extraClass = "") => `
    <section class="group ${extraClass}">
      <h3>${esc(g.title)}</h3>
      <div class="desc">${esc(g.desc || "")}</div>
      <div class="chips">${g.cards.map(chipHtml).join("")}</div>
    </section>`;

  document.body.innerHTML = `
    <button id="viewToggle"></button>
    <button id="draftToggle">☑ Sleeve check</button>
    <a class="backlink" href="../index.html">← All decks</a>
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
        ${data.clusters.map((cl) =>
          `<div class="cluster" data-k="${esc(cl.k)}" style="border-left:4px solid ${clusterColor[cl.k]}">
             <b>${esc(cl.label)}</b><span>${esc(cl.blurb)}</span></div>`).join("")}
        <div id="clusterDetail"></div>
        ${data.hint ? `<div class="hint">${esc(data.hint)}</div>` : ""}
      </aside>
      <main class="groups">
        ${data.groups.map((g) => groupHtml(g)).join("")}
        ${data.lands ? `
        <section class="group">
          <h3>${esc(data.lands.title)}</h3>
          <div class="desc">${esc(data.lands.desc || "")}</div>
          <details><summary>Show the full mana base (${data.lands.cards.reduce((s, c) => s + (c.count || 1), 0)} lands)</summary>
            <div class="chips">${data.lands.cards.map(chipHtml).join("")}</div>
          </details>
        </section>` : ""}
        ${data.pulled ? groupHtml(data.pulled, "pulled") : ""}
      </main>
    </div>
    <div id="checklist"></div>
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

  /* light up chips sharing a tag with `keys`; border takes the color of
     the shared cluster(s). Multi-cluster: conic-gradient segments (equal
     arcs, max 4) so a card in 2 clusters shows 50/50, etc. Lit borders are
     2px — 1px segments are imperceptible. See standards/deck-map-ux.md. */
  function unlitStyle(c) {
    c.style.borderColor = ""; c.style.borderWidth = ""; c.style.background = "";
  }
  function light(keys) {
    document.body.classList.add("filtering");
    chips.forEach((c) => {
      const k = (c.dataset.k || "").split(" ");
      const shared = keys.filter((x) => k.includes(x)).slice(0, 4);
      c.classList.toggle("lit", shared.length > 0);
      if (!shared.length) { unlitStyle(c); return; }
      c.style.borderWidth = "2px";
      if (shared.length === 1) {
        c.style.borderColor = clusterColor[shared[0]];
        c.style.background = "";
      } else {
        const seg = 360 / shared.length;
        const stops = shared.map((s, i) =>
          `${clusterColor[s]} ${i * seg}deg ${(i + 1) * seg}deg`).join(",");
        const inner = c.classList.contains("cmdr") ? "#2d2818" : "var(--panel2)";
        c.style.borderColor = "transparent";
        c.style.background = `linear-gradient(${inner},${inner}) padding-box, conic-gradient(from 45deg, ${stops}) border-box`;
      }
    });
  }
  function clearLight() {
    document.body.classList.remove("filtering");
    chips.forEach((c) => { c.classList.remove("lit"); unlitStyle(c); });
  }
  function clearSelection() {
    if (selected) selected.classList.remove("sel");
    selected = null;
    touchbar.classList.remove("show");
    pinned ? light([pinned]) : clearLight();
  }

  /* ---------- card identity (type line) prefetch ----------
   * One batched Scryfall /cards/collection call per deck, cached in
   * localStorage for 7 days, so hover/tap boxes can show what a card IS. */
  const typeMap = {};
  async function prefetchTypes() {
    const names = [...new Set(chips.map((c) => c.dataset.name).filter(Boolean))];
    const key = "deckTypes:" + (data.slug || location.pathname);
    try {
      const s = JSON.parse(localStorage.getItem(key) || "null");
      if (s && Date.now() - s.ts < 6048e5 && s.map) { Object.assign(typeMap, s.map); return; }
    } catch (e) {}
    try {
      const lookup = {};
      for (let i = 0; i < names.length; i += 75) {
        const r = await fetch("https://api.scryfall.com/cards/collection", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifiers: names.slice(i, i + 75).map((n) => ({ name: n.split(" // ")[0] })) })
        }).then((r) => r.json());
        (r.data || []).forEach((c) => {
          const entry = { t: c.type_line, m: c.mana_cost || (c.card_faces ? c.card_faces[0].mana_cost : "") };
          lookup[c.name] = entry;
          (c.card_faces || []).forEach((f) => { lookup[f.name] = entry; });
        });
      }
      names.forEach((n) => { const e = lookup[n] || lookup[n.split(" // ")[0]]; if (e) typeMap[n] = e; });
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), map: typeMap }));
    } catch (e) { /* offline: boxes just omit the type line */ }
  }
  /* ---------- mana at a glance ----------
   * Computed from verified casting costs (typeMap): colored pip demand,
   * i.e. which colors your lands must produce and how badly. Hybrid pips
   * split fractionally. Rendered with MTG's semantic WUBRG colors — a
   * separate encoding domain from the cluster palette (see standards). */
  function renderMana() {
    const counts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    chips.forEach((c) => {
      if (!c.dataset.name || c.closest(".pulled")) return;
      const m = (typeMap[c.dataset.name] || {}).m || "";
      for (const tok of m.match(/{[^}]+}/g) || []) {
        const inner = tok.slice(1, -1);
        if (/^[WUBRG]$/.test(inner)) counts[inner] += 1;
        else if (inner.includes("/")) {
          const parts = inner.split("/").filter((p) => /^[WUBRG]$/.test(p));
          parts.forEach((p) => { counts[p] += 1 / parts.length; });
        }
      }
    });
    const MC = { W: "#e8dfb8", U: "#4aa3df", B: "#9b7fb8", R: "#e05c4b", G: "#4fbf78" };
    const NAMES = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (!total) return;
    const active = Object.entries(counts).filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const bar = active.map(([k, v]) =>
      `<i style="width:${(v / total * 100).toFixed(1)}%;background:${MC[k]}" title="${NAMES[k]}"></i>`).join("");
    const txt = active.map(([k, v]) =>
      `<span style="color:${MC[k]}">●</span> ${NAMES[k]} ${Math.round(v)} (${Math.round(v / total * 100)}%)`).join(" &nbsp;·&nbsp; ");
    const sec = document.createElement("section");
    sec.className = "group mana";
    sec.innerHTML = `<h3>Mana at a glance</h3>
      ${data.manaNote ? `<div class="desc">${esc(data.manaNote)}</div>` : ""}
      <div class="manabar">${bar}</div>
      <div class="manacounts">${txt}<span class="manahint"> — colored symbols in casting costs: what this deck needs its lands to produce</span></div>`;
    document.querySelector(".groups").prepend(sec);
  }
  const prefetchPromise = prefetchTypes();
  prefetchPromise.then(renderMana);

  /* ---------- sleeve-check view ----------
   * A completeness checklist for physically assembling the deck:
   * grouped by card type (from typeMap), alphabetical within, checkbox
   * state persisted in localStorage per deck. ?sleeve=1 opens directly. */
  function fullDeckItems() {
    const items = []; const seen = new Set();
    const take = (c) => {
      if (c.name === null) return;
      const nm = c.name || c.n;
      if (seen.has(nm)) return;
      seen.add(nm);
      items.push({ n: c.n, name: nm, count: c.count || 1, cmdr: !!c.cmdr });
    };
    data.groups.forEach((g) => g.cards.forEach(take));
    if (data.lands) data.lands.cards.forEach(take);
    return items;
  }
  function bucketOf(item) {
    if (item.cmdr) return "Commander";
    const t = ((typeMap[item.name] || {}).t || "").split("//")[0];
    for (const b of ["Creature", "Planeswalker", "Battle", "Instant", "Sorcery", "Enchantment", "Artifact", "Land"])
      if (t.includes(b)) return b;
    return "Other";
  }
  function buildChecklist() {
    const wrap = document.getElementById("checklist");
    const items = fullDeckItems();
    const key = "sleeved:" + (data.slug || "deck");
    let state = {};
    try { state = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) {}
    const order = ["Commander", "Creature", "Planeswalker", "Battle", "Instant", "Sorcery", "Enchantment", "Artifact", "Land", "Other"];
    const buckets = {};
    items.forEach((it) => { const b = bucketOf(it); (buckets[b] = buckets[b] || []).push(it); });
    Object.values(buckets).forEach((a) => a.sort((x, y) => x.n.localeCompare(y.n)));
    const total = items.reduce((s, i) => s + i.count, 0);
    wrap.innerHTML = `<h2>Sleeve check</h2>
      <div class="clprog" id="clprog"></div>
      <button id="clreset">Reset checklist</button>
      ${order.filter((b) => buckets[b]).map((b) => {
        const n = buckets[b].reduce((s, i) => s + i.count, 0);
        return `<div class="clsec"><h3>${b} <span class="mv">${n}</span></h3><div class="rows">${
          buckets[b].map((it) =>
            `<label class="clrow${state[it.name] ? " done" : ""}" data-cl="${esc(it.name)}">
               <input type="checkbox" ${state[it.name] ? "checked" : ""}>
               <span class="clcount">${it.count > 1 ? it.count + "×" : ""}</span>
               <span>${esc(it.n)}</span></label>`).join("")
        }</div></div>`;
      }).join("")}`;
    const prog = () => {
      const done = items.filter((i) => state[i.name]).reduce((s, i) => s + i.count, 0);
      document.getElementById("clprog").textContent = `${done} / ${total} cards sleeved`;
    };
    prog();
    wrap.querySelectorAll(".clrow").forEach((r) => r.addEventListener("click", (e) => {
      e.preventDefault();
      const nm = r.dataset.cl;
      state[nm] = !state[nm]; if (!state[nm]) delete state[nm];
      r.classList.toggle("done", !!state[nm]);
      r.querySelector("input").checked = !!state[nm];
      localStorage.setItem(key, JSON.stringify(state));
      prog();
    }));
    document.getElementById("clreset").addEventListener("click", () => {
      localStorage.setItem(key, "{}"); buildChecklist();
    });
  }
  const draftBtn = document.getElementById("draftToggle");
  let draftBuilt = false;
  function setDraft(on) {
    document.body.classList.toggle("draft", on);
    draftBtn.textContent = on ? "← Back to map" : "☑ Sleeve check";
    if (on && !draftBuilt) prefetchPromise.then(() => { buildChecklist(); draftBuilt = true; });
    try {
      const u = new URL(location.href);
      on ? u.searchParams.set("sleeve", "1") : u.searchParams.delete("sleeve");
      history.replaceState(null, "", u);
    } catch (e) {}
  }
  draftBtn.addEventListener("click", () => setDraft(!document.body.classList.contains("draft")));
  try { if (new URL(location.href).searchParams.get("sleeve") === "1") setDraft(true); } catch (e) {}

  /* hover/tap info box content: what it IS · role · which clusters */
  function infoHtml(c) {
    const t = typeMap[c.dataset.name];
    const badges = c.dataset.k ? c.dataset.k.split(" ").map((k) => badge(k)).join(" ") : "";
    return `${t ? `<div class="tiptype">${esc(t.t)}${t.m ? " · " + esc(t.m) : ""}</div>` : ""}` +
      `${c.dataset.tip ? `<div>${esc(c.dataset.tip)}</div>` : ""}` +
      `${badges ? `<div class="tbbadges">${badges}</div>` : ""}`;
  }

  /* ---------- pointer (hover) interactions ---------- */
  if (!TOUCH) {
    chips.forEach((c) => {
      c.addEventListener("mouseenter", () => {
        if (c.dataset.k) light(c.dataset.k.split(" "));
        const html = infoHtml(c);
        if (html) { tip.innerHTML = html; tip.style.display = "block"; }
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
        const t = typeMap[c.dataset.name];
        const badges = c.dataset.k.split(" ").map((k) => badge(k)).join(" ");
        const more = c.dataset.name ? " <i>· tap again for card details</i>" : "";
        touchbar.innerHTML = `<div><b>${esc(c.textContent)}</b>${t ? ` <span class="tiptype" style="display:inline">${esc(t.t)}</span>` : ""}${more}</div>
          ${c.dataset.tip ? `<div class="tbtip">${esc(c.dataset.tip)}</div>` : ""}
          <div class="tbbadges">${badges}</div>`;
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

  /* ---------- cluster deep-dive panel (inserted below clicked cluster) --- */
  function openCluster(k, scroll) {
    const cl = document.querySelector(`.cluster[data-k="${k}"]`);
    if (!cl) return;
    pinned = k;
    clearSelection();
    document.querySelectorAll(".cluster").forEach((x) => x.classList.toggle("active", x === cl));
    light([k]);
    const d = clusterMap[k];
    const col = clusterColor[k];
    detail.innerHTML = `<h4 style="color:${col}">${esc(d.label)}</h4>
      <p><span class="lbl">How it works</span>${esc(d.how)}</p>
      <p><span class="lbl">Example line</span>${esc(d.ex)}</p>
      <p class="why"><span class="lbl">Deckbuilding principle</span>${esc(d.why)}</p>`;
    detail.style.borderColor = col;
    cl.insertAdjacentElement("afterend", detail);   // detail sits right under its cluster
    detail.style.display = "block";
    if (scroll) cl.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function closeCluster() {
    pinned = null; clearLight(); detail.style.display = "none";
    document.querySelectorAll(".cluster").forEach((x) => x.classList.remove("active"));
  }
  document.querySelectorAll(".cluster").forEach((cl) => {
    cl.addEventListener("click", (e) => {
      e.stopPropagation();
      pinned === cl.dataset.k ? closeCluster() : openCluster(cl.dataset.k, false);
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
    }).slice(0, 10).map((o) => {
      const shared = mine.find((t) => o.dataset.k.split(" ").includes(t));
      return { el: o, color: clusterColor[shared] };
    });
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
    /* deck-context layers: role, cluster membership badges, related cards */
    let extra = "";
    if (srcChip && srcChip.dataset.tip) {
      extra += `<div class="roletip"><span class="relLbl">Role in this deck</span>${esc(srcChip.dataset.tip)}</div>`;
    }
    if (srcChip && srcChip.dataset.k) {
      extra += `<span class="relLbl">Synergy clusters</span><div class="tbbadges">${
        srcChip.dataset.k.split(" ").map((k) => badge(k, `data-cluster="${esc(k)}"`)).join(" ")
      }</div>`;
    }
    const rel = relatedTo(srcChip);
    if (rel.length) {
      extra += `<span class="relLbl">Related in this deck</span><div class="chips rel">${
        rel.map((r) => `<span class="chip" data-rel="${esc(r.el.dataset.name)}" style="border-color:${r.color}">${esc(r.el.textContent)}</span>`).join("")
      }</div>`;
    }
    cardBox.innerHTML = `<button class="close">✕</button>` + body.replace("<!--EXTRA-->", extra);
    cardBox.querySelector(".close").addEventListener("click", closeCard);
    cardBox.querySelectorAll("[data-rel]").forEach((o) =>
      o.addEventListener("click", () => openCard(o.dataset.rel)));
    /* badge click → close modal, open that cluster's deep-dive in place */
    cardBox.querySelectorAll("[data-cluster]").forEach((b) =>
      b.addEventListener("click", () => { closeCard(); openCluster(b.dataset.cluster, true); }));
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
