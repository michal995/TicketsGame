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
  const fragment = document.createDocumentFragment();

  session.available.forEach((ticket) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn ticket-btn ticket ${ticket.className}`;
    const count = session.selectedTickets[ticket.name] || 0;
    const need = session.request[ticket.name] || 0;
    if (need > 0 && count >= need) {
      button.disabled = true;
    }

    button.innerHTML = `
      ${count ? `<span class="bubble">×${count}</span>` : ''}
      <div class="ticket-icon" aria-hidden="true">${ticket.icon ?? ''}</div>
      <div class="sub">${ticket.name}</div>
      <div class="ticket-price">${formatMoney(ticket.price)}</div>
    `;

    button.addEventListener('click', () => handlers.onAddTicket(ticket.name));
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      handlers.onRemoveTicket(ticket.name);
    });

    fragment.appendChild(button);
  });

  ticketsWrap.replaceChildren(fragment);
}

export function renderCoins(session, elements, handlers) {
  const { coinsWrap } = elements;
  const denominations =
    typeof handlers.getAvailableCoins === 'function' ? handlers.getAvailableCoins() : handlers.availableCoins;

  const billsRow = document.createElement('div');
  billsRow.className = 'coins-row bills';
  const coinsRow = document.createElement('div');
  coinsRow.className = 'coins-row coins';

  denominations.forEach((denomination) => {
    const button = document.createElement('button');
    button.type = 'button';
    const classes = ['btn', 'currency-btn', denomination.type];
    if (denomination.skin) {
      classes.push(`skin-${denomination.skin}`);
    }
    button.className = classes.join(' ');
    button.dataset.value = String(denomination.value);
    button.innerHTML = `
      <span class="denom-icon" aria-hidden="true">${denomination.icon ?? ''}</span>
      <span class="denom-value">${formatMoney(denomination.value)}</span>
      <span class="denom-label">${denomination.label}</span>
    `;
    button.addEventListener('click', () => handlers.onInsertCoin(denomination.value));
    if (denomination.type === 'bill') {
      billsRow.appendChild(button);
    } else {
      coinsRow.appendChild(button);
    }
  });

  const fragment = document.createDocumentFragment();
  fragment.append(billsRow, coinsRow);

  coinsWrap.classList.add('grid-coins');
  coinsWrap.replaceChildren(fragment);
}

export function updateHud(session, elements) {
  const { scoreDisplay, needEl, paysEl, fareEl, pickedEl, remainEl, timerDisplay, changeWrap, paysCard } = elements;
  scoreDisplay.textContent = Math.max(0, Math.round(session.score));
  needEl.textContent = formatRequest(session.request);
  if (session.showPays) {
    paysEl.textContent = formatMoney(session.pays);
    paysCard?.classList.remove('is-muted');
  } else {
    paysEl.textContent = '—';
    paysCard?.classList.add('is-muted');
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
  timerDisplay.textContent = `${Math.max(0, Math.ceil(session.timeLeft))} s`;
}

export function renderHistory(session, elements) {
  const { historyList } = elements;
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
}

export function hideOverlay(overlay) {
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden', 'true');
}
