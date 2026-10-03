/* ============================================================
   KERVAN YOLU — icons.js
   Arayüz simgeleri (SVG, 32×32). Harici görsel yok.
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

KY.Icons = (function () {
  const S = (inner) => `<svg viewBox="0 0 32 32" aria-hidden="true">${inner}</svg>`;
  const tierCol = ['#9a8b7a', '#b9bec6', '#d6dce4', '#eee6d2', '#f2c38a'];
  const armorCol = ['#b4a585', '#8a5f3c', '#7d8893', '#56627a', '#a33a2a'];
  const I = {
    yarma: S('<path d="M6 26 L22 10 L25 7 L24 11 L9 27 Z" fill="#d9dee6"/><path d="M5 23 l4 4 -2 2 -4-4z" fill="#b8923e"/><path d="M8 7 C18 5 26 12 26 22" fill="none" stroke="#ffe7a8" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>'),
    kasirga: S('<path d="M16 5c7 0 11 4 11 9s-5 8-10 8-7-3-7-6 3-5 6-5 4 2 4 3" fill="none" stroke="#e6f1ff" stroke-width="2.6" stroke-linecap="round"/><path d="M5 22c3 4 8 5 12 5" fill="none" stroke="#9fc4ff" stroke-width="2.2" stroke-linecap="round"/><path d="M4 15c0 3 1 5 3 7" fill="none" stroke="#9fc4ff" stroke-width="2" stroke-linecap="round"/>'),
    demir: S('<path d="M16 4 L26 8 V15 C26 21 22 26 16 28 C10 26 6 21 6 15 V8 Z" fill="#7d8893" stroke="#d9e2ee" stroke-width="1.6"/><path d="M16 8 V24 M10 14 H22" stroke="#e7c46a" stroke-width="2.2"/>'),
    atesTopu: S('<circle cx="18" cy="15" r="7" fill="#ff8a2a"/><circle cx="19" cy="14" r="4" fill="#ffe08a"/><path d="M11 18 C7 20 5 23 4 27 C8 25 11 24 13 22" fill="#ff6a1a" opacity=".85"/><path d="M13 12 C9 11 7 9 6 6 C10 7 12 8 14 10" fill="#ffb040" opacity=".8"/>'),
    alevHalka: S('<ellipse cx="16" cy="22" rx="11" ry="4.5" fill="none" stroke="#ff6a1a" stroke-width="2.4"/><path d="M8 21 C8 16 11 15 10 11 C13 13 14 16 13 20Z M16 20 C15 14 18 12 17 7 C21 10 21 15 19 20Z M22 21 C22 17 24 16 24 13 C26 15 27 18 25 21Z" fill="#ffb040"/>'),
    sifa: S('<circle cx="16" cy="16" r="10" fill="none" stroke="#9df08a" stroke-width="2" opacity=".7"/><path d="M16 9 V23 M9 16 H23" stroke="#e8ffd8" stroke-width="3.2" stroke-linecap="round"/>'),
    potR: S('<path d="M13 5h6v5l5 7a7 7 0 1 1-16 0l5-7z" fill="#e8e0d0" opacity=".3"/><path d="M9.5 18a6.5 6.5 0 0 0 13 0z" fill="#d8453a"/><path d="M13 5h6v5l5 7a7 7 0 1 1-16 0l5-7z" fill="none" stroke="#efe6d2" stroke-width="1.4"/><rect x="12" y="3" width="8" height="3" rx="1" fill="#8a5a36"/>'),
    potR2: S('<path d="M11 4h10v5l6 8a9 9 0 1 1-22 0l6-8z" fill="#e8e0d0" opacity=".3"/><path d="M7 18a9 8 0 0 0 18 0z" fill="#d8453a"/><path d="M11 4h10v5l6 8a9 9 0 1 1-22 0l6-8z" fill="none" stroke="#f0d898" stroke-width="1.5"/><rect x="10" y="2" width="12" height="3" rx="1" fill="#b8923e"/>'),
    potB: S('<path d="M13 5h6v5l5 7a7 7 0 1 1-16 0l5-7z" fill="#e8e0d0" opacity=".3"/><path d="M9.5 18a6.5 6.5 0 0 0 13 0z" fill="#3f82d8"/><path d="M13 5h6v5l5 7a7 7 0 1 1-16 0l5-7z" fill="none" stroke="#efe6d2" stroke-width="1.4"/><rect x="12" y="3" width="8" height="3" rx="1" fill="#8a5a36"/>'),
    potB2: S('<path d="M11 4h10v5l6 8a9 9 0 1 1-22 0l6-8z" fill="#e8e0d0" opacity=".3"/><path d="M7 18a9 8 0 0 0 18 0z" fill="#3f82d8"/><path d="M11 4h10v5l6 8a9 9 0 1 1-22 0l6-8z" fill="none" stroke="#f0d898" stroke-width="1.5"/><rect x="10" y="2" width="12" height="3" rx="1" fill="#b8923e"/>'),
    toz: S('<path d="M16 5 L21 13 L16 20 L11 13 Z" fill="#7fb6ff"/><path d="M16 5 L21 13 L16 13 Z" fill="#cfe3ff"/><path d="M6 27 C8 22 12 21 16 21 C20 21 24 22 26 27 Z" fill="#9aa8c0"/><circle cx="24" cy="8" r="1.6" fill="#fff"/><circle cx="8" cy="11" r="1.2" fill="#fff"/>'),
    ipek: S('<rect x="6" y="9" width="20" height="14" rx="7" fill="#b3372e"/><ellipse cx="9" cy="16" rx="3" ry="7" fill="#d8574a"/><path d="M12 11 C18 13 18 19 12 21" stroke="#f0c070" stroke-width="1.4" fill="none"/>'),
    cay: S('<rect x="7" y="10" width="18" height="15" rx="2" fill="#7a5636"/><rect x="7" y="10" width="18" height="4" fill="#5e4430"/><path d="M16 16 C12 16 11 21 16 23 C21 21 20 16 16 16 Z" fill="#7da64a"/>'),
    porselen: S('<path d="M12 5 H20 V8 C25 11 26 18 22 24 L20 27 H12 L10 24 C6 18 7 11 12 8 Z" fill="#e9eef5"/><path d="M10 15 C14 13 18 17 22 15 M11 20 C15 18 18 22 21 20" stroke="#3f6fb8" stroke-width="1.6" fill="none"/>'),
    baharat: S('<path d="M9 11 C9 7 23 7 23 11 L25 25 C25 28 7 28 7 25 Z" fill="#b08a55"/><path d="M11 10 C13 6 19 6 21 10 Z" fill="#d9772a"/><circle cx="14" cy="8" r="1.6" fill="#a33a2a"/><circle cx="18" cy="8.5" r="1.4" fill="#e0b44a"/>'),
    tuz: S('<path d="M8 24 L12 12 L17 16 L20 8 L25 24 Z" fill="#efeae0"/><path d="M12 12 L14 24 M20 8 L19 24" stroke="#c9bfae" stroke-width="1.2"/>'),
    kilim: S('<rect x="6" y="6" width="20" height="20" fill="#7a2f5a"/><path d="M16 9 L22 16 L16 23 L10 16 Z" fill="#e0b44a"/><path d="M16 12 L19 16 L16 20 L13 16 Z" fill="#2f6f73"/><path d="M6 6 H26 M6 26 H26" stroke="#e7c46a" stroke-width="2"/>'),
    coin: S('<circle cx="16" cy="16" r="10" fill="#e0b13a"/><circle cx="16" cy="16" r="7" fill="none" stroke="#fff1b8" stroke-width="1.5"/><rect x="14" y="12" width="4" height="8" fill="#b8862b"/>'),
    bag: S('<path d="M8 12 H24 L26 27 H6 Z" fill="currentColor" opacity=".9"/><path d="M11 12 C11 6 21 6 21 12" fill="none" stroke="currentColor" stroke-width="2.2"/>'),
    person: S('<circle cx="16" cy="10" r="5" fill="currentColor"/><path d="M6 27 C7 19 11 17 16 17 C21 17 25 19 26 27 Z" fill="currentColor"/>'),
    star: S('<path d="M16 4 L19 12 L27 12 L21 17 L23 26 L16 21 L9 26 L11 17 L5 12 L13 12 Z" fill="currentColor"/>'),
    camel: S('<path d="M5 20 C5 15 8 13 11 13 C12 9 15 9 16 12 C17 9 20 9 21 12 C22 11 23 7 25 6 C27 6 28 8 27 9 L26 10 C25 12 25 15 24 17 L24 27 H22 L21 20 H11 L10 27 H8 L8 21 Z" fill="currentColor"/>'),
    map: S('<path d="M5 8 L12 5 L20 8 L27 5 V24 L20 27 L12 24 L5 27 Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 5 V24 M20 8 V27" stroke="currentColor" stroke-width="1.6"/>'),
    gear: S('<path d="M16 5 L18 8 L22 7 L22 11 L26 13 L24 16 L26 19 L22 21 L22 25 L18 24 L16 27 L14 24 L10 25 L10 21 L6 19 L8 16 L6 13 L10 11 L10 7 L14 8 Z" fill="currentColor"/><circle cx="16" cy="16" r="4" fill="#161a22"/>'),
    lock: S('<rect x="9" y="14" width="14" height="11" rx="2" fill="#a39d90"/><path d="M11 14 V11 C11 6 21 6 21 11 V14" fill="none" stroke="#a39d90" stroke-width="2.4"/>'),
    close: S('<path d="M9 9 L23 23 M23 9 L9 23" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
    sound: S('<path d="M6 13 H11 L17 8 V24 L11 19 H6 Z" fill="currentColor"/><path d="M21 11 C23 13 23 19 21 21 M24 8 C28 12 28 20 24 24" stroke="currentColor" stroke-width="2" fill="none"/>'),
    paw: S('<ellipse cx="16" cy="21" rx="7" ry="6" fill="currentColor"/><ellipse cx="8" cy="13" rx="2.8" ry="3.6" fill="currentColor"/><ellipse cx="13" cy="8.5" rx="2.8" ry="3.6" fill="currentColor"/><ellipse cx="19" cy="8.5" rx="2.8" ry="3.6" fill="currentColor"/><ellipse cx="24" cy="13" rx="2.8" ry="3.6" fill="currentColor"/>'),
    meat: S('<path d="M19 5 C26 5 29 12 25 17 C22 21 16 21 14 18 L9 23 C10 26 7 28 5 26 C3 27 1 24 4 23 C3 21 5 19 7 20 L12 15 C9 12 12 5 19 5 Z" fill="#b5523a"/><path d="M18 8 C23 8 25 12 23 15" stroke="#e8a07a" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="5" cy="24" r="1.6" fill="#efe6d2"/>'),
    salve: S('<rect x="8" y="12" width="16" height="15" rx="3" fill="#dfe7d8"/><rect x="8" y="17" width="16" height="10" rx="3" fill="#5fae5a"/><rect x="7" y="7" width="18" height="6" rx="2" fill="#8a5a36"/><path d="M13 21 h6 M16 18 v6" stroke="#eaffea" stroke-width="2"/>'),
    herb: S('<path d="M16 29 C16 20 15 13 16 5" stroke="#4f7a32" stroke-width="2" fill="none"/><path d="M16 12 C10 11 7 7 7 4 C12 4 15 7 16 12 Z M16 16 C22 15 25 11 25 8 C20 8 17 11 16 16 Z M16 21 C10 20 8 17 8 14 C13 14 15 17 16 21 Z" fill="#7fcf5a"/><circle cx="16" cy="5" r="2" fill="#ffd46b"/>'),
    amulet: S('<path d="M9 4 C9 10 23 10 23 4" stroke="#b8923e" stroke-width="1.8" fill="none"/><circle cx="16" cy="19" r="8.5" fill="#d9b25c"/><circle cx="16" cy="19" r="5.5" fill="#2f6f73"/><path d="M16 15 L18 19 L16 23 L14 19 Z" fill="#9ff0e0"/>'),
    crown: S('<path d="M5 24 L7 10 L12 16 L16 7 L20 16 L25 10 L27 24 Z" fill="currentColor"/><rect x="5" y="25" width="22" height="3" rx="1" fill="currentColor"/><circle cx="16" cy="18" r="2" fill="#161a22"/>'),
    quest: S('<path d="M9 5 H23 V27 L16 22 L9 27 Z" fill="currentColor"/>')
  };
  function item(it) {
    if (!it) return '';
    if (it.type === 'weapon') {
      const url = KY.Swords && KY.Swords.iconURL(it.id);
      if (url) return `<img src="${url}" alt="" draggable="false">`;
      const c = tierCol[it.tier] || tierCol[0];
      return S(`<path d="M7 25 L22 10 L26 6 L25 11 L10 26 Z" fill="${c}"/><path d="M6 21 l5 5 -2 2 -5-5z" fill="${it.tier >= 3 ? '#e0b44a' : '#8a6a45'}"/><path d="M4 26 l2 2 -2 2 -2-2z" fill="#5a3e28"/>`);
    }
    if (it.type === 'pet') {
      const url = KY.Swords && KY.Swords.iconURL(it.id);
      return url ? `<img src="${url}" alt="" draggable="false">` : `<span style="color:#e7c46a;display:block;width:100%;height:100%">${I.paw}</span>`;
    }
    if (it.type !== 'weapon' && it.type !== 'pet' && KY.Avatar && KY.Avatar.iconURL) {
      const url = KY.Avatar.iconURL(it.id);
      if (url) return `<img src="${url}" alt="" draggable="false">`;
    }
    if (it.type === 'armor') {
      const c = armorCol[it.tier] || armorCol[0];
      return S(`<path d="M11 5 L16 8 L21 5 L27 9 L25 15 L22 14 L22 27 H10 L10 14 L7 15 L5 9 Z" fill="${c}"/><path d="M16 8 V27 M10 18 H22" stroke="${it.tier >= 2 ? '#e0b44a' : 'rgba(0,0,0,.25)'}" stroke-width="1.6"/>`);
    }
    // yedek SVG simgeler (3D simge çekilemezse)
    const c = armorCol[it.tier] || armorCol[0];
    const svg = {
      head: `<path d="M6 20 C6 10 26 10 26 20 L24 22 H8 Z" fill="${c}"/><path d="M6 20 H26" stroke="#e0b44a" stroke-width="2"/>`,
      shoulder: `<path d="M5 22 C5 12 13 8 18 8 C24 8 27 13 27 18 L22 16 L18 22 Z" fill="${c}"/>`,
      hands: `<path d="M10 6 H20 L22 18 L24 22 L19 27 H12 L9 20 Z" fill="${c}"/><path d="M10 12 H21" stroke="#e0b44a" stroke-width="1.6"/>`,
      legs: `<path d="M8 6 H24 L27 26 L18 24 L16 14 L14 24 L5 26 Z" fill="${c}"/>`,
      feet: `<path d="M10 4 H18 V20 L27 22 V27 H9 Z" fill="${c}"/>`,
      shield: `<circle cx="16" cy="16" r="11" fill="${c}" stroke="#e0b44a" stroke-width="1.6"/><circle cx="16" cy="16" r="3" fill="#e0b44a"/>`,
      earring: `<circle cx="16" cy="8" r="3" fill="none" stroke="#e0b44a" stroke-width="2"/><path d="M16 12 L20 20 L16 27 L12 20 Z" fill="#2ec4b0"/>`,
      necklace: `<path d="M7 6 C7 18 25 18 25 6" fill="none" stroke="#e0b44a" stroke-width="2"/><path d="M16 17 L20 22 L16 28 L12 22 Z" fill="#e39a2a"/>`,
      ring: `<circle cx="16" cy="18" r="8" fill="none" stroke="#e0b44a" stroke-width="3"/><path d="M16 4 L20 9 L16 12 L12 9 Z" fill="#d8453a"/>`
    }[it.type];
    if (svg) return S(svg);
    return I[it.icon] || I.bag;
  }
  I.item = item;
  return I;
})();
