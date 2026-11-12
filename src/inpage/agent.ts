/**
 * Mindstack's small on-page UI: related-reading chip, "save this?" offer and
 * save confirmations. Injected with chrome.scripting.executeScript, so it must be
 * self-contained: no imports, no module-scope references, no async/await.
 *
 * Privacy: it renders inside a closed shadow root from the extension's isolated
 * world, so the website's own scripts can't read the user's reading history.
 */
export interface AgentRelated {
  title: string;
  url: string;
  snippet: string;
}

export interface AgentConfig {
  related: AgentRelated[];
  /** Offer to save once the user has actually read the page. */
  offerSave: boolean;
  /** Visible, focused time on the page before the save offer, in ms. */
  engageMs: number;
  /** Fraction of the page scrolled before the save offer (0-1). */
  minScroll: number;
  /** 'open' only in test builds, so tests can inspect it. */
  shadowMode: 'open' | 'closed';
  /** Only make sure the agent exists; don't replace the current suggestions. */
  keepExisting?: boolean;
}

export function mindstackAgent(config: AgentConfig): void {
  const w = window as any;
  if (w.__mindstackAgent) {
    if (!config.keepExisting) w.__mindstackAgent.configure(config);
    return;
  }

  const host = document.createElement('div');
  host.id = 'mindstack-agent';
  host.style.cssText = 'all: initial; position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;';
  const root = host.attachShadow({ mode: config.shadowMode });
  root.innerHTML =
    '<style>' +
    ':host{all:initial}' +
    '.card{font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1f2937;background:#fff;' +
    'border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.16);width:320px;max-width:calc(100vw - 40px);' +
    'overflow:hidden;animation:in .18s ease-out}' +
    '@keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
    '.pill{display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 12px;border:0;background:none;font:inherit;color:inherit;width:100%;text-align:left}' +
    '.head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #f3f4f6;font-weight:600}' +
    '.logo{width:18px;height:18px;border-radius:5px;background:#2196F3;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex:none}' +
    '.grow{flex:1;min-width:0}' +
    '.x{border:0;background:none;color:#9ca3af;cursor:pointer;font-size:16px;line-height:1;padding:2px 4px}' +
    '.x:hover{color:#374151}' +
    'ul{list-style:none;margin:0;padding:6px 0;max-height:260px;overflow:auto}' +
    'li{padding:6px 12px}' +
    'a{color:#1976D2;text-decoration:none;font-weight:500}a:hover{text-decoration:underline}' +
    '.snip{color:#6b7280;font-size:12px;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
    '.foot{display:flex;gap:8px;align-items:center;padding:8px 12px;border-top:1px solid #f3f4f6}' +
    '.btn{border:0;border-radius:8px;background:#2196F3;color:#fff;font:inherit;font-weight:600;padding:6px 12px;cursor:pointer}' +
    '.btn:hover{background:#1976D2}' +
    '.link{border:0;background:none;color:#6b7280;font:inherit;font-size:12px;cursor:pointer;padding:0}' +
    '.link:hover{color:#374151;text-decoration:underline}' +
    '.msg{padding:10px 12px;display:flex;gap:8px;align-items:center}' +
    '.ok{color:#047857}.err{color:#b91c1c}' +
    '</style><div id="slot"></div>';
  const slot = root.getElementById('slot') as HTMLElement;

  let current = config;
  let dismissed = false; // the user closed something: no more unprompted chips on this page
  let saveOffered = false;
  let busy = false;
  let hideTimer = 0;

  const el = (tag: string, cls?: string, text?: string): HTMLElement => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const logo = () => el('span', 'logo', 'M');
  const closeButton = (onClose: () => void) => {
    const x = el('button', 'x', '×');
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', onClose);
    return x;
  };
  const clear = () => {
    window.clearTimeout(hideTimer);
    while (slot.firstChild) slot.removeChild(slot.firstChild);
  };
  const autoHide = (ms: number) => {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(clear, ms);
  };
  const dismiss = () => {
    dismissed = true;
    clear();
  };
  const send = (message: object) => {
    try {
      chrome.runtime.sendMessage(message).catch(() => undefined);
    } catch (e) {
      // Extension was updated or reloaded; this page's agent is orphaned.
    }
  };
  const save = () => {
    if (busy) return;
    busy = true;
    showMessage('progress', 'Saving to Mindstack…');
    send({ type: 'MS_SAVE_PAGE' });
  };
  const muteSite = () => {
    send({ type: 'MS_MUTE_SITE', host: location.hostname });
    dismiss();
  };
  const isWebUrl = (u: string) => /^https?:\/\//i.test(u);

  function showRelatedPill() {
    clear();
    const n = current.related.length;
    const card = el('div', 'card');
    const pill = el('button', 'pill');
    pill.appendChild(logo());
    pill.appendChild(el('span', 'grow', n === 1 ? 'You’ve read 1 related page' : 'You’ve read ' + n + ' related pages'));
    pill.addEventListener('click', showRelatedList);
    card.appendChild(pill);
    slot.appendChild(card);
    const x = closeButton(dismiss);
    x.style.position = 'absolute';
    x.style.top = '8px';
    x.style.right = '8px';
    card.style.position = 'relative';
    card.appendChild(x);
    autoHide(15000);
  }

  function showRelatedList() {
    clear();
    const card = el('div', 'card');
    const head = el('div', 'head');
    head.appendChild(logo());
    head.appendChild(el('span', 'grow', 'Related from your reading'));
    head.appendChild(closeButton(dismiss));
    card.appendChild(head);
    const list = el('ul');
    current.related.forEach((r) => {
      const li = el('li');
      if (isWebUrl(r.url)) {
        const a = el('a', '', r.title || r.url) as HTMLAnchorElement;
        a.href = r.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        li.appendChild(a);
      } else {
        li.appendChild(el('div', '', r.title));
      }
      if (r.snippet) li.appendChild(el('div', 'snip', r.snippet));
      list.appendChild(li);
    });
    card.appendChild(list);
    const foot = el('div', 'foot');
    if (current.offerSave) {
      const b = el('button', 'btn', 'Save this page');
      b.addEventListener('click', save);
      foot.appendChild(b);
    }
    foot.appendChild(el('span', 'grow'));
    const mute = el('button', 'link', 'Not on this site');
    mute.addEventListener('click', muteSite);
    foot.appendChild(mute);
    card.appendChild(foot);
    slot.appendChild(card);
  }

  function showSaveOffer() {
    if (dismissed || busy || slot.firstChild) return;
    saveOffered = true;
    const card = el('div', 'card');
    const head = el('div', 'head');
    head.appendChild(logo());
    head.appendChild(el('span', 'grow', 'Worth remembering?'));
    head.appendChild(closeButton(dismiss));
    card.appendChild(head);
    const body = el('div', 'msg', 'Save this page to your Mindstack to get a summary and find it later.');
    body.style.color = '#4b5563';
    card.appendChild(body);
    const foot = el('div', 'foot');
    const b = el('button', 'btn', 'Save');
    b.addEventListener('click', save);
    foot.appendChild(b);
    foot.appendChild(el('span', 'grow'));
    const mute = el('button', 'link', 'Not on this site');
    mute.addEventListener('click', muteSite);
    foot.appendChild(mute);
    card.appendChild(foot);
    slot.appendChild(card);
    autoHide(20000);
  }

  function showMessage(kind: string, text: string) {
    clear();
    const card = el('div', 'card');
    const row = el('div', 'msg');
    row.appendChild(logo());
    row.appendChild(el('span', 'grow ' + (kind === 'success' ? 'ok' : kind === 'error' ? 'err' : ''), text));
    row.appendChild(closeButton(clear));
    card.appendChild(row);
    slot.appendChild(card);
    if (kind === 'success') autoHide(5000);
  }

  // Engagement: count visible, focused time and how far the page was scrolled.
  let engagedMs = 0;
  let maxScroll = 0;
  const trackScroll = () => {
    const h = document.documentElement.scrollHeight;
    if (h > 0) maxScroll = Math.max(maxScroll, Math.min(1, (window.scrollY + window.innerHeight) / h));
  };
  window.addEventListener('scroll', trackScroll, { passive: true });
  trackScroll();
  const tick = window.setInterval(() => {
    if (!current.offerSave || saveOffered || dismissed) return;
    if (document.visibilityState === 'visible' && document.hasFocus()) engagedMs += 1000;
    if (engagedMs >= current.engageMs && maxScroll >= current.minScroll) showSaveOffer();
  }, 1000);

  const onMessage = (msg: any) => {
    if (!msg || msg.type !== 'MS_TOAST') return;
    if (msg.kind !== 'progress') busy = false;
    showMessage(msg.kind, msg.text);
  };
  try {
    chrome.runtime.onMessage.addListener(onMessage);
  } catch (e) {
    // ignore: orphaned agent
  }

  function configure(next: AgentConfig) {
    current = next;
    if (next.related.length > 0) {
      // At most one unprompted chip per page: related reading wins, and its
      // expanded list already has a "Save this page" button.
      saveOffered = true;
      window.setTimeout(() => {
        if (!dismissed && !busy && !slot.firstChild) showRelatedPill();
      }, 1200);
    }
  }

  w.__mindstackAgent = {
    configure,
    destroy() {
      window.clearInterval(tick);
      window.removeEventListener('scroll', trackScroll);
      host.remove();
      delete w.__mindstackAgent;
    },
  };
  (document.body || document.documentElement).appendChild(host);
  configure(config);
}
