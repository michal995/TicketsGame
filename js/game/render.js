import { ALL_TICKETS } from './constants.js';
import { animateScoreValue, applyScoreVisual, applyTimerVisual, highlightPays } from './effects.js';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value) {
  return currency.format(Math.max(0, Number(value) || 0));
}

function formatRequest(request) {
  const entries = Object.entries(request);
  if (!entries.length) {
    return '—';
  }
  return entries
    .map(([name, count]) => `${count}× ${name}`)
    .join(', ');
}

export function renderTickets(session, elements, handlers) {
  const { ticketsWrap } = elements;
  if (!ticketsWrap) {
    return;
  }

  const availableByName = new Map(session.available.map((ticket) => [ticket.name, ticket]));
  const isOptionTwoMode = typeof session.mode === 'string' && session.mode.endsWith('2');
  const fragment = document.createDocumentFragment();

  ALL_TICKETS.forEach((definition) => {
    const ticket = availableByName.get(definition.name) || definition;
    const isAvailable = availableByName.has(definition.name);

    if (isOptionTwoMode && !isAvailable) {
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn ticket-btn ticket ${ticket.className}`;
    const count = session.selectedTickets[ticket.name] || 0;
    const need = session.request[ticket.name] || 0;

    if (!isAvailable) {
      button.classList.add('is-inactive');
      button.disabled = true;
    } else if (need > 0) {
      const filled = count >= need;
      button.classList.toggle('is-filled', filled);
      button.setAttribute('aria-pressed', filled ? 'true' : 'false');
    } else {
      button.classList.remove('is-filled');
      button.removeAttribute('aria-pressed');
    }

    button.innerHTML = `
      ${count ? `<span class="bubble">×${count}</span>` : ''}
      <div class="ticket-icon" aria-hidden="true">${ticket.icon ?? ''}</div>
      <div class="sub">${ticket.name}</div>
      <div class="ticket-price">${formatMoney(ticket.price)}</div>
    `;

    if (isAvailable) {
      button.addEventListener('click', (event) => handlers.onAddTicket(ticket.name, event));
      button.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        handlers.onRemoveTicket(ticket.name, event);
      });
    }

    fragment.appendChild(button);
  });

  ticketsWrap.replaceChildren(fragment);
}

export function renderCoins(session, elements, handlers) {
  const { coinsWrap } = elements;
  if (!coinsWrap) {
    return;
  }
  const denominations =
    typeof handlers.getAvailableCoins === 'function' ? handlers.getAvailableCoins() : handlers.availableCoins;

  const fragment = document.createDocumentFragment();

  denominations.forEach((denomination) => {
    const button = document.createElement('button');
    button.type = 'button';
    const classes = ['btn', 'currency-btn', denomination.type];
    if (denomination.skin) {
      classes.push(`skin-${denomination.skin}`);
    }
    button.className = classes.join(' ');
    button.dataset.value = String(denomination.value);
    button.dataset.kind = denomination.type;
    button.innerHTML = `
      <span class="denom-icon" aria-hidden="true">${denomination.icon ?? ''}</span>
      <span class="denom-value">${formatMoney(denomination.value)}</span>
      <span class="denom-label">${denomination.label}</span>
    `;
    const locked = !session.canPay;
    button.disabled = locked;
    button.tabIndex = locked ? -1 : 0;
    button.setAttribute('aria-disabled', locked ? 'true' : 'false');
    button.classList.toggle('is-locked', locked);
    button.addEventListener('click', (event) => {
      if (button.disabled) {
        return;
      }
      handlers.onInsertCoin(denomination.value, event);
    });
    fragment.appendChild(button);
  });

  coinsWrap.classList.add('grid-coins');
  coinsWrap.dataset.locked = !session.canPay ? 'true' : 'false';
  coinsWrap.replaceChildren(fragment);
}

export function updateHud(session, elements) {
  const { scoreDisplay, needEl, paysEl, fareEl, pickedEl, remainEl, timerDisplay, changeWrap, paysCard } = elements;
  animateScoreValue(scoreDisplay, session.score);
  applyScoreVisual(scoreDisplay, session.score);
  needEl.textContent = formatRequest(session.request);
  if (session.showPays) {
    paysEl.textContent = formatMoney(session.pays);
    paysCard?.classList.remove('is-muted');
  } else {
    paysEl.textContent = '—';
    paysCard?.classList.add('is-muted');
  }
  if (paysCard) {
    paysCard.dataset.state = session.payFlashShown ? 'complete' : 'pending';
  }
  if (session.payFlashPending && paysCard) {
    highlightPays(paysCard);
    session.payFlashPending = false;
  }
  fareEl.textContent = formatMoney(session.ticketTotal);
  pickedEl.textContent = formatMoney(session.selectedTotal);
  const revealChange = session.showChange;
  if (changeWrap) {
    changeWrap.dataset.visible = revealChange ? 'true' : 'false';
    changeWrap.dataset.mode = session.changeDue === 0 ? 'exact' : 'waiting';
  }

  const labelNode = remainEl.previousElementSibling;
  if (!revealChange) {
    remainEl.textContent = '$?';
    remainEl.removeAttribute('data-state');
    if (labelNode) {
      labelNode.textContent = session.changeDue === 0 ? 'Exact fare' : 'Change';
    }
  } else {
    const remaining = Math.round((session.changeDue - session.inserted) * 100) / 100;
    let stateLabel = '';
    let state = '';
    if (Math.abs(remaining) < 0.005) {
      stateLabel = session.changeDue > 0 ? 'Change exact' : 'No change due';
      remainEl.textContent = formatMoney(0);
    } else if (remaining > 0) {
      stateLabel = 'Change due';
      remainEl.textContent = formatMoney(remaining);
      state = 'short';
    } else {
      stateLabel = 'Extra given';
      remainEl.textContent = formatMoney(Math.abs(remaining));
      state = 'over';
    }
    if (labelNode && labelNode.textContent !== stateLabel) {
      labelNode.textContent = stateLabel;
    }
    if (state) {
      remainEl.dataset.state = state;
    } else {
      remainEl.removeAttribute('data-state');
    }
  }
  applyTimerVisual(timerDisplay, session.timeLeft);
}

export function renderHistory(session, elements) {
  const { historyList } = elements;
  if (!historyList) {
    return;
  }
  if (!session.history.length) {
    historyList.innerHTML = '';
    return;
  }

  const fragment = document.createDocumentFragment();
  session.history.slice(-12).forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span>${entry.message}</span>
      <span class="history-label">${entry.value}</span>
    `;
    fragment.appendChild(item);
  });

  historyList.replaceChildren(fragment);
  historyList.scrollTop = historyList.scrollHeight;
}

export function showOverlay(overlayElements, content) {
  const { overlay, box } = overlayElements;
  box.innerHTML = '';
  let countdownValueEl = null;

  const title = document.createElement('div');
  title.className = 'title';
  title.id = 'overlayTitle';
  title.textContent = content.title;
  box.appendChild(title);

  if (content.subtitle) {
    const subtitle = document.createElement('div');
    subtitle.className = 'small';
    subtitle.textContent = content.subtitle;
    box.appendChild(subtitle);
  }

  if (typeof content.points === 'number') {
    const points = document.createElement('div');
    points.className = `points ${content.points >= 0 ? 'good' : 'bad'}`;
    const sign = content.points >= 0 ? '+' : '';
    points.textContent = `${sign}${content.points} pts`;
    box.appendChild(points);
  }

  if (content.details?.length) {
    const list = document.createElement('div');
    list.className = 'summary-list';
    content.details.forEach((detail) => {
      const row = document.createElement('div');
      row.className = 's-item';
      row.innerHTML = `
        <span>${detail.label}</span>
        <span class="history-label">${detail.value}</span>
      `;
      list.appendChild(row);
    });
    box.appendChild(list);
  }

  if (content.bonuses?.length) {
    const bonuses = document.createElement('div');
    bonuses.className = 'bonus-list';
    content.bonuses.forEach((bonus) => {
      const tag = document.createElement('span');
      tag.className = 'bonus-tag';
      tag.innerHTML = `
        <span>${bonus.label}</span>
        <span class="value">+${bonus.points} pts</span>
      `;
      bonuses.appendChild(tag);
    });
    box.appendChild(bonuses);
  }

  if (content.body instanceof Node) {
    box.appendChild(content.body);
  }

  if (typeof content.countdown === 'number') {
    const countdownRow = document.createElement('div');
    countdownRow.className = 'countdown-row';
    const label = document.createElement('span');
    label.textContent = content.countdownLabel || 'Next passenger in…';
    countdownValueEl = document.createElement('span');
    countdownValueEl.className = 'value';
    countdownValueEl.textContent = String(content.countdown);
    countdownRow.append(label, countdownValueEl);
    box.appendChild(countdownRow);
  }

  if (content.actions?.length) {
    content.actions.forEach((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-cta';
      button.textContent = action.label;
      button.addEventListener('click', action.onSelect);
      box.appendChild(button);
    });
  }

  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');

  if (typeof content.onRender === 'function') {
    content.onRender({ overlay, box, countdownEl: countdownValueEl });
  }
}

export function hideOverlay(overlay) {
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden', 'true');
}
