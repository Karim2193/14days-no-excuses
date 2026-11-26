// Coach : message du jour, constats, bilan de discipline, excuses et conversation.
import { dateKey, esc } from '../util.js';
import { analyze, disciplineReport, localReply, aiReply } from '../coach.js';
import { icon, toast } from '../ui.js';
import * as store from '../store.js';
import { actions as sportActions } from './sport.js';

export const state = { chatOpen: false, busy: false };

const QUICK = ['Bilan de ma journée', 'Quoi manger ce soir ?', 'Je suis fatigué', 'Mon poids stagne', 'Dois-je modifier ma séance ?', 'J\'ai envie d\'abandonner'];

export function render(ctx) {
  const s = store.get();
  if (ctx?.chat) state.chatOpen = true;
  const a = analyze(s);
  const chat = s.chat || [];
  const ai = !!s.settings.apiKey;
  return `<header class="topbar"><div class="title">Coach</div><span class="pill ${ai ? 'green' : ''}">${ai ? 'IA activée' : 'Mode local'}</span></header>
  <section class="card coach-card tone-${a.main.tone}"><div class="coach-head"><div class="avatar">C</div><div><b>Message du jour</b><small>${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small></div></div>
    <p class="coach-msg big">${esc(a.main.text)}</p></section>
  ${a.insights.length ? `<section class="card"><h3>Ce que je vois</h3><ul class="insights">${a.insights.map((x) => `<li class="tone-${x.tone}">${esc(x.text)}</li>`).join('')}</ul></section>` : ''}
  <section class="card"><div class="card-h"><h3>Bilan de discipline</h3></div><pre class="report">${esc(disciplineReport(s))}</pre>
    <button class="btn ghost block" data-act="excuse">J'ai une excuse aujourd'hui</button></section>
  <section class="card chat ${state.chatOpen ? 'open' : ''}" id="chat">
    <div class="card-h"><h3>Parler à mon coach</h3>${chat.length ? '<button class="link" data-act="chat-clear">Effacer</button>' : ''}</div>
    <div class="msgs" id="msgs">${chat.length ? chat.map((m) => `<div class="msg ${m.role}">${esc(m.text).replace(/\n/g, '<br>')}</div>`).join('') : '<div class="msg coach">Pose ta question. Je connais tes chiffres, alors pas de baratin.</div>'}${state.busy ? '<div class="msg coach typing">…</div>' : ''}</div>
    <div class="hscroll quick">${QUICK.map((q) => `<button class="chipbtn" data-act="chat-quick" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <form class="chat-form" data-submit="chat-send"><input name="q" placeholder="Écris au coach…" autocomplete="off" enterkeyhint="send"><button class="btn primary" aria-label="Envoyer">➤</button></form>
    ${ai ? '' : '<p class="fine">Mode local : réponses générées par des règles à partir de tes données, sans internet ni abonnement. Une IA est activable en option dans Réglages (clé API personnelle, facturée à l\'usage par le fournisseur).</p>'}
  </section>`;
}

export function after(root) {
  const m = root.querySelector('#msgs'); if (m) m.scrollTop = m.scrollHeight;
  if (state.chatOpen) { root.querySelector('#chat')?.scrollIntoView({ block: 'start' }); state.chatOpen = false; }
}

async function send(text) {
  text = String(text || '').trim(); if (!text) return;
  store.update((s) => { s.chat.push({ role: 'user', text, t: Date.now() }); });
  const s = store.get();
  let reply;
  if (s.settings.apiKey) {
    state.busy = true; store.update(() => {});
    try { reply = await aiReply(s, s.chat); } catch (e) { reply = localReply(s, text) + '\n\n(IA indisponible, réponse locale.)'; }
    state.busy = false;
  } else reply = localReply(s, text);
  store.update((st) => { st.chat.push({ role: 'coach', text: reply, t: Date.now() }); if (st.chat.length > 200) st.chat = st.chat.slice(-200); });
  state.chatOpen = true;
}

export const actions = {
  excuse: sportActions.excuse,
  'chat-quick'(el) { send(el.dataset.q); return false; },
  'chat-send'(form) { const q = form.q.value; form.q.value = ''; send(q); },
  'chat-clear'() { store.update((s) => { s.chat = []; }); },
};
