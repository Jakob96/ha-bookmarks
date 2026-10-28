class HABookmarksPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: "open"});
    this._hass = null;
    this._bookmarks = [];
    this._loaded = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    try {
      const data = await this._hass.callWS({type: "ha_bookmarks/get"});
      this._bookmarks = Array.isArray(data?.bookmarks) ? data.bookmarks : [];
    } catch (err) {
      this._bookmarks = [];
      this._loadError = "Kunde inte läsa bokmärken. Kontrollera installationen och ladda om sidan.";
    }
    this._render();
  }

  async _save() {
    await this._hass.callWS({type: "ha_bookmarks/save", bookmarks: this._bookmarks});
    this._render();
  }

  _esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    }[c]));
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;color:var(--primary-text-color)}
        .wrap{max-width:1100px;margin:0 auto;padding:24px 18px 48px}
        .top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        h1{font-size:26px;margin:0 0 8px;font-weight:500}
        .muted{color:var(--secondary-text-color);margin:0 0 22px}
        button{border:0;border-radius:10px;padding:10px 15px;cursor:pointer;font:inherit}
        .primary{background:var(--primary-color);color:var(--text-primary-color,white)}
        .secondary{background:var(--secondary-background-color);color:var(--primary-text-color)}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
        .card{background:var(--ha-card-background,var(--card-background-color));border:1px solid var(--divider-color);border-radius:14px;padding:16px;min-height:112px;display:flex;flex-direction:column;gap:12px}
        .bookmark{color:var(--primary-text-color);text-decoration:none;font-size:17px;font-weight:500;overflow-wrap:anywhere}
        .url{color:var(--secondary-text-color);font-size:12px;overflow-wrap:anywhere}
        .actions{display:flex;gap:8px;margin-top:auto}
        .actions button{padding:7px 10px;font-size:13px}
        .form{background:var(--secondary-background-color);border-radius:14px;padding:18px;margin:18px 0 24px}
        label{display:block;font-size:14px;margin:12px 0 5px}
        input{box-sizing:border-box;width:100%;padding:11px;border-radius:8px;border:1px solid var(--divider-color);background:var(--primary-background-color);color:var(--primary-text-color);font:inherit}
        .form-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
        .empty{padding:28px;text-align:center;border:1px dashed var(--divider-color);border-radius:14px;color:var(--secondary-text-color)}
        .error{color:var(--error-color);margin:12px 0}
      </style>
      <div class="wrap">
        <div class="top"><div><h1>Bokmärken</h1><p class="muted">Dina sparade länkar samlade på ett ställe.</p></div>
        <button class="primary" id="add">＋ Lägg till bokmärke</button></div>
        ${this._loadError ? `<div class="error">${this._esc(this._loadError)}</div>` : ""}
        <div id="formhost"></div><div class="grid" id="grid"></div>
      </div>`;
    this.shadowRoot.getElementById("add").addEventListener("click", () => this._showForm());
    const grid = this.shadowRoot.getElementById("grid");
    if (!this._bookmarks.length) {
      grid.innerHTML = '<div class="empty">Inga bokmärken ännu. Klicka på ”Lägg till bokmärke” för att skapa ditt första.</div>';
    } else {
      grid.innerHTML = this._bookmarks.map(b => `
        <div class="card">
          <a class="bookmark" href="${this._esc(b.url)}" target="_blank" rel="noopener noreferrer">🔖 ${this._esc(b.title)}</a>
          <div class="url">${this._esc(b.url)}</div>
          <div class="actions"><button class="secondary" data-edit="${this._esc(b.id)}">Redigera</button><button class="secondary" data-delete="${this._esc(b.id)}">Ta bort</button></div>
        </div>`).join("");
      grid.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => this._showForm(btn.dataset.edit)));
      grid.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", async () => {
        const item = this._bookmarks.find(x => x.id === btn.dataset.delete);
        if (item && confirm(`Ta bort bokmärket "${item.title}"?`)) {
          this._bookmarks = this._bookmarks.filter(x => x.id !== btn.dataset.delete);
          try { await this._save(); } catch(e) { alert("Kunde inte spara ändringen."); }
        }
      }));
    }
  }

  _showForm(id = null) {
    const old = this._bookmarks.find(b => b.id === id) || {title:"",url:""};
    const host = this.shadowRoot.getElementById("formhost");
    host.innerHTML = `
      <form class="form" id="bookmark-form">
        <h2 style="margin:0;font-size:19px">${id ? "Redigera bokmärke" : "Lägg till bokmärke"}</h2>
        <label for="title">Namn</label><input id="title" maxlength="100" required value="${this._esc(old.title)}" placeholder="Exempelvis Min router">
        <label for="url">URL</label><input id="url" type="url" maxlength="2048" required value="${this._esc(old.url)}" placeholder="https:// eller http://">
        <div class="form-actions"><button type="button" class="secondary" id="cancel">Avbryt</button><button type="submit" class="primary">Spara</button></div>
        <div id="error" role="alert" class="error"></div>
      </form>`;
    host.querySelector("#cancel").addEventListener("click", () => {host.innerHTML = "";});
    host.querySelector("form").addEventListener("submit", async e => {
      e.preventDefault();
      const title = host.querySelector("#title").value.trim();
      const url = host.querySelector("#url").value.trim();
      if (!/^https?:\/\//i.test(url)) {
        host.querySelector("#error").textContent = "URL måste börja med http:// eller https://.";
        return;
      }
      const item = {id: id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), title, url, icon:"mdi:bookmark"};
      if (id) this._bookmarks = this._bookmarks.map(b => b.id === id ? item : b);
      else this._bookmarks.push(item);
      try {
        await this._save();
        this.shadowRoot.getElementById("formhost").innerHTML = "";
      } catch(err) {
        host.querySelector("#error").textContent = "Kunde inte spara bokmärket. Kontrollera integrationen och försök igen.";
      }
    });
  }
}
if (!customElements.get("ha-bookmarks-panel")) customElements.define("ha-bookmarks-panel", HABookmarksPanel);
