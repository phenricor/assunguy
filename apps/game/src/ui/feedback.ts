// Feedback from the map's controls: the player writes up to 1000 characters and the message goes out through
// their own email app (a mailto link), with the game's version and the colony's date at the end. If the email
// app does not open (some browsers and embedded pages block it), the message can be copied instead.
import { locale, T } from '../i18n';
import * as store from '../store';
import { APP_VERSION } from '../version';
import { closePopup, esc, hint, K, popup } from './kit';

const MAX = 1000, TO = 'paullocorr@gmail.com';
let draft = '';

const yearOf = (t: number) => Math.max(1, Math.floor((t - 12) / 4) + 1);
function message(text: string): string {
  const year = store.hasGame() ? yearOf(store.session().s.market.t) : 0;
  return `${text.trim()}\n\n${T('ui.feedback.context', { version: APP_VERSION, lang: locale(), year })}`;
}

export function openFeedback(): void {
  const p = popup(esc(T('ui.feedback.title')), esc(T('ui.feedback.intro')),
    `<textarea id="fbTxt" class="fb-txt" rows="7" placeholder="${esc(T('ui.feedback.placeholder'))}" aria-label="${esc(T('ui.feedback.title'))}">${esc(draft)}</textarea>`
    + `<p id="fbOver" class="nota ruim" role="status" hidden></p>`
    + K.actions([{ id: 'fbNo', text: T('ui.cancel') }, { id: 'fbSend', kind: 'pri', text: T('ui.feedback.send'), disabled: !draft.trim() || draft.length > MAX }]));
  const box = p.querySelector('#fbTxt') as HTMLTextAreaElement, over = p.querySelector('#fbOver') as HTMLElement, send = p.querySelector('#fbSend') as HTMLButtonElement;
  // the count only shows once the message is too long
  const check = () => {
    draft = box.value;
    const n = box.value.length, tooLong = n > MAX;
    over.hidden = !tooLong;
    if (tooLong) over.textContent = T('ui.feedback.over', { max: MAX, n });
    send.disabled = tooLong || !box.value.trim();
  };
  box.oninput = check;
  check();
  box.focus();
  (p.querySelector('#fbNo') as HTMLElement).onclick = closePopup;
  send.onclick = () => {
    if (send.disabled) return;
    const body = message(box.value), subject = T('ui.feedback.subject', { version: APP_VERSION });
    const a = document.createElement('a');
    a.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    a.target = '_blank'; a.rel = 'noopener';
    a.click();
    draft = '';
    sent(body);
  };
}

/** After sending: the email app should be open; the message stays at hand to copy if it is not. */
function sent(body: string): void {
  const p = popup(esc(T('ui.feedback.readyTitle')), esc(T('ui.feedback.ready', { to: TO })),
    `<textarea id="fbCopia" class="fb-txt" rows="5" readonly>${esc(body)}</textarea>`
    + K.actions([{ id: 'fbCopy', text: T('ui.feedback.copy') }, { id: 'fbOk', kind: 'pri', text: T('ui.close') }]));
  const box = p.querySelector('#fbCopia') as HTMLTextAreaElement;
  (p.querySelector('#fbOk') as HTMLElement).onclick = closePopup;
  (p.querySelector('#fbCopy') as HTMLElement).onclick = async () => {
    try { await navigator.clipboard.writeText(body); hint(T('ui.feedback.copied'), 2400); }
    catch { box.focus(); box.select(); hint(T('ui.feedback.copyByHand'), 3000); }
  };
}
