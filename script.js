const chartContainer = document.getElementById('chart-container');
const totalInput = document.getElementById('total-input');
const toggleBtn = document.getElementById('toggle-btn');
const billsTbody = document.getElementById('bills-tbody');
const billsThead = document.getElementById('bills-thead');
const addBillForm = document.getElementById('add-bill-form');
const newBillName = document.getElementById('new-bill-name');
const newBillAmount = document.getElementById('new-bill-amount');
const collapseToggle = document.getElementById('collapse-toggle');
const collapseContent = document.getElementById('collapse-content');
const legend = document.getElementById('legend');
const existingBillsTitle = document.querySelector('.existing-bills-title');

let categories = [
  { name: 'Bills', color: '#4a90e2', percentage: 0, fixed: true },
  { name: 'Personal', color: '#f5a623', percentage: 0.3, fixed: false },
  { name: 'Debt', color: '#e94e77', percentage: 0.2, fixed: false },
  { name: 'Savings', color: '#50e3c2', percentage: 0.2, fixed: false },
];

// Load bills from localStorage or start empty
let bills = loadBills();

// Removed old paySettingsBtn because replaced by calendarBtn
const calendarBtn = document.getElementById('calendar-btn'); // new calendar button
const payModal = document.getElementById('pay-modal-overlay');
const payForm = document.getElementById('pay-form');
const paydayInput = document.getElementById('payday-input');
const frequencyInput = document.getElementById('frequency-input');

// ======= NEW: Clear stored payday and payFrequency so user must enter every login =======
localStorage.removeItem('payday');
localStorage.removeItem('payFrequency');

let payday = null;
let payFrequency = null;

// Clear inputs to force user input
paydayInput.value = '';
frequencyInput.value = 'biweekly'; // default or '' for blank

let showMoney = false;

function enforceNumeric(input) {
  input.value = input.value.replace(/[^\d]/g, '');
}

function formatDollarInput(input) {
  let value = input.value.replace(/\D/g, '').slice(0, 7);
  input.value = value ? parseInt(value, 10).toLocaleString() : '';
}

function getTotalAmount() {
  const raw = totalInput.value.replace(/[^\d]/g, '');
  let total = parseInt(raw, 10) || 0;

  // Get saved float value from localStorage or 0 if none
  let floatValue = parseInt(localStorage.getItem('floatData'), 10);
  if (isNaN(floatValue)) floatValue = 0;

  const adjustedTotal = total - floatValue;
  return adjustedTotal > 0 ? adjustedTotal : 0;  // prevent negative totals
}

// Save bills to localStorage as JSON string
function saveBills() {
  localStorage.setItem('bills', JSON.stringify(bills));
}

// Load bills from localStorage and parse JSON, or return empty array
function loadBills() {
  const saved = localStorage.getItem('bills');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }
  return [];
}

function render() {
  // Remove all existing segments and handles except toggle button
  [...chartContainer.children].forEach(child => {
    if (child !== toggleBtn) child.remove();
  });

  let total = getTotalAmount();

  // ======= NEW: If payday or payFrequency not set, disable chart and force modal open =======
  if (!payday || !payFrequency) {
    toggleBtn.disabled = true;
    toggleBtn.style.opacity = 0.5;

    legend.style.display = 'none';
    billsThead.style.display = 'none';
    if (existingBillsTitle) existingBillsTitle.style.display = 'none';
    billsTbody.innerHTML = '';

    payModal.style.display = 'flex';

    // Clear categories percentages so chart segments don't render
    categories.forEach(cat => (cat.percentage = 0));

    return; // Exit early, no chart
  }

  if (total < 1) {
    // Clear categories percentages
    categories.forEach(cat => (cat.percentage = 0));

    // Hide bills [table] header and existing bills title
    billsThead.style.display = 'none';
    if (existingBillsTitle) existingBillsTitle.style.display = 'none';

    // Hide legend and clear it
    legend.style.display = 'none';
    legend.innerHTML = '';

    // Clear bills table body
    billsTbody.innerHTML = '';

    // Disable toggle button and fade it
    toggleBtn.disabled = true;
    toggleBtn.style.opacity = 0.5;

    // Early exit so no segments or handles get created
    return;
  }

  // Enable toggle button if total is valid
  toggleBtn.disabled = false;
  toggleBtn.style.opacity = 1;

  // Your existing logic for valid total

  const payPeriod = getPayPeriodRange(payday, payFrequency);
  console.log('Pay Period Start:', payPeriod.start.toISOString());
  console.log('Pay Period End:', payPeriod.end.toISOString());
  
 const billsTotal = bills.reduce((sum, bill) => {
  const count = getBillOccurrencesInPeriod(bill, payPeriod);
  return sum + bill.amount * count;
}, 0);

  categories[0].percentage = Math.min(billsTotal / total, 1);

  let leftover = 1 - categories[0].percentage;
  if (leftover < 0) leftover = 0;

  let variableCats = categories.filter(c => !c.fixed);
  let variableSum = variableCats.reduce((sum, c) => sum + c.percentage, 0);

  if (variableSum === 0 && variableCats.length > 0) {
    variableCats.forEach(c => (c.percentage = leftover / variableCats.length));
  } else if (variableSum > 0) {
    variableCats.forEach(c => (c.percentage = (c.percentage / variableSum) * leftover));
  }

  billsThead.style.display = bills.length > 0 ? '' : 'none';

  if (existingBillsTitle) {
    existingBillsTitle.style.display = bills.length > 0 ? 'block' : 'none';
  }

  const containerHeight = chartContainer.offsetHeight || 460;
  let currentTop = 0;
  const smallSegments = [];

  categories.forEach((cat, index) => {
    const height = Math.round(cat.percentage * containerHeight);
    
    // Add any segment under 50 px to smallSegments (including Bills)
    if (height < 50) {
      smallSegments.push(cat);
    }

    const seg = document.createElement('div');
    seg.className = 'segment';
    if (index === 0) seg.classList.add('first');
    if (index === categories.length - 1) seg.classList.add('last');

    seg.style.top = `${currentTop}px`;
    seg.style.height = `${height}px`;
    seg.style.background = cat.color;

    seg.innerHTML = '';

    // Show label only if height >= 50 for all categories including Bills
  const titleSpan = document.createElement('span');
   titleSpan.className = 'name';
   titleSpan.textContent = cat.name;

  const valueSpan = document.createElement('span');
   valueSpan.className = 'value';
    valueSpan.textContent = showMoney
  ? `$${(cat.percentage * total).toFixed(2)}`
  : `${(cat.percentage * 100).toFixed(1)}%`;

  seg.appendChild(titleSpan);
  seg.appendChild(valueSpan);


  chartContainer.appendChild(seg);
    cat._seg = seg;
    currentTop += height;
  });
  
  updateSmushedSegmentLabels(); // ✅ Now this will work reliably

  // ======= UPDATED: Only add handles if Bills don't fill the entire chart =======
  if (categories[0].percentage < 1) {
    for (let i = 1; i < categories.length - 1; i++) {
      const handle = document.createElement('div');
      handle.className = 'handle';
      handle.dataset.idx = i;
      chartContainer.appendChild(handle);

      const segA = categories[i]._seg;
      const topA = parseInt(segA.style.top, 10);
      const heightA = parseInt(segA.style.height, 10);
      handle.style.top = `${topA + heightA}px`;

      handle.addEventListener('mousedown', onDragStart);
      handle.addEventListener('touchstart', onDragStart, { passive: false });
    }
  }

  updateLegend(smallSegments, total);
  renderBillsTable();
}

function updateLegend(smallSegments, total) {
  legend.innerHTML = '';

  // Filter out categories with zero or near-zero percentage
  const visibleSegments = smallSegments.filter(cat => cat.percentage > 0.001);

  if (visibleSegments.length === 0) {
    legend.style.display = 'none';
    return;
  }

  visibleSegments.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const colorBox = document.createElement('div');
    colorBox.className = 'legend-color-box';
    colorBox.style.backgroundColor = cat.color;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'legend-text';
    nameSpan.textContent = cat.name;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'legend-value';
    if (showMoney) {
     valueSpan.textContent = `$${(cat.percentage * total).toFixed(2)}`;
    } else {
      valueSpan.textContent = `${(cat.percentage * 100).toFixed(1)}%`;
    }


    item.appendChild(colorBox);
    item.appendChild(nameSpan);
    item.appendChild(valueSpan);
    legend.appendChild(item);
  });

  legend.style.display = 'block';
}

function renderBillsTable() {
  billsTbody.innerHTML = '';

  bills.forEach((bill, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.id = bill.id;
    tr.addEventListener('dragstart', handleDragStart);
    tr.addEventListener('dragover', handleDragOver);
    tr.addEventListener('drop', handleDrop);
    tr.addEventListener('dragenter', handleDragEnter);
    tr.addEventListener('dragleave', handleDragLeave);
    tr.addEventListener('dragend', handleDragEnd);
    
    let dragSrcIndex = null;

function handleDragStart(e) {
  dragSrcIndex = +this.dataset.idx;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcIndex); // required for Firefox
  this.classList.add('dragging');
}

function handleDragOver(e) {
  e.preventDefault(); // allow drop
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter(e) {
  this.classList.add('over');
}

function handleDragLeave(e) {
  this.classList.remove('over');
}

function handleDrop(e) {
  e.stopPropagation();

  const dragTargetIndex = +this.dataset.idx;
  if (dragSrcIndex === null || dragSrcIndex === dragTargetIndex) return;

  // Swap the bills in the array
  const draggedBill = bills[dragSrcIndex];
  bills.splice(dragSrcIndex, 1); // remove dragged bill
  bills.splice(dragTargetIndex, 0, draggedBill); // insert dragged bill at new position

  saveBills();
  render(); // re-render the whole UI including bills table
}

function handleDragEnd(e) {
  dragSrcIndex = null;
  document.querySelectorAll('#bills-tbody tr').forEach(tr => {
    tr.classList.remove('over', 'dragging');
  });
}


    // ... your existing code for creating cells ...

    // Create editable cell with natural input sizing and validation
function createEditableCell(prop, formatFn, options) {
  const td = document.createElement('td');
  td.textContent = formatFn ? formatFn(bill[prop]) : bill[prop];

  td.style.position = 'relative'; // for input positioning

  td.addEventListener('click', () => {
    // Avoid creating multiple inputs
    if (td.querySelector('input') || td.querySelector('select')) return;

    let input;

    if (options && options.length > 0) {
      // Create select dropdown for frequency
      input = document.createElement('select');
      options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
        if (bill[prop] === opt) option.selected = true;
        input.appendChild(option);
      });
    } else {
      input = document.createElement('input');
      if (prop === 'amount') {
        input.type = 'text'; // for formatting as you type
        input.value = bill[prop].toFixed(2);
      } else if (prop === 'startDate') {
        input.type = 'date';
        input.value = bill[prop];
      } else {
        input.type = 'text';
        input.value = bill[prop];
      }
    }

    // Style input to fit inside cell naturally
    input.style.width = 'auto';
    input.style.minWidth = '100%'; // prevent too small
    input.style.fontSize = 'inherit';
    input.style.fontFamily = 'inherit';
    input.style.border = 'none';
    input.style.margin = '0';
    input.style.padding = '0 2px';
    input.style.borderRadius = '0';
    input.style.height = '20px';

    // Replace cell text with input/select
    td.textContent = '';
    td.appendChild(input);
    input.focus();

    // If this is a text input (not select and not date), enable dynamic resizing
    if (input.tagName === 'INPUT' && input.type === 'text' && prop !== 'startDate') {
      // Create hidden span for measuring
      const measureSpan = document.createElement('span');
      measureSpan.style.position = 'absolute';
      measureSpan.style.visibility = 'hidden';
      measureSpan.style.whiteSpace = 'pre';
      measureSpan.style.fontSize = getComputedStyle(input).fontSize;
      measureSpan.style.fontFamily = getComputedStyle(input).fontFamily;
      measureSpan.style.fontWeight = getComputedStyle(input).fontWeight;
      measureSpan.style.letterSpacing = getComputedStyle(input).letterSpacing;
      td.appendChild(measureSpan);

      // Initialize width
      measureSpan.textContent = input.value || 'W';
      input.style.width = `${measureSpan.offsetWidth + 10}px`;

      input.addEventListener('input', () => {
        // Format for amount prop specifically
        if (prop === 'amount') {
          // Remove all except digits and dot
          let val = input.value.replace(/[^0-9.]/g, '');
          // Only allow one dot
          const parts = val.split('.');
          if (parts.length > 2) {
            val = parts[0] + '.' + parts.slice(1).join('');
          }
          // Limit to two decimal places
          if (parts[1]) {
            parts[1] = parts[1].slice(0, 2);
            val = parts[0] + '.' + parts[1];
          }
          input.value = val;
        }

        // Prevent input collapsing to zero width
        measureSpan.textContent = input.value || 'W';
        input.style.width = `${measureSpan.offsetWidth + 10}px`;
      });
    }

    function finishEdit(save) {
      if (!save) {
        render();
        return;
      }

      let newVal = input.value.trim();

      if (prop === 'name') {
        if (newVal === '') {
          alert('Name cannot be empty.');
          input.focus();
          return;
        }
      }

      if (prop === 'amount') {
        newVal = parseFloat(newVal);
        if (isNaN(newVal) || newVal < 0) {
          alert('Please enter a valid positive amount.');
          input.focus();
          return;
        }
      }

      if (prop === 'startDate') {
        // Basic check for date format YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(newVal)) {
          alert('Please enter a valid date.');
          input.focus();
          return;
        }
      }

      if (prop === 'frequency') {
        if (!options.includes(newVal)) {
          alert('Please select a valid frequency.');
          input.focus();
          return;
        }
      }

      bill[prop] = newVal;
      saveBills();
      render();
    }

    input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    finishEdit(true);
  } else if (e.key === 'Escape') {
    finishEdit(false);
  }
});

// ✅ Remove blur save to avoid trapping the user
input.addEventListener('blur', () => {
  // finishEdit(false); // optional: cancel edit on blur
});

// ✅ Remove red border once user fixes it
input.addEventListener('input', () => {
  input.classList.remove('input-error');
});
  });

  return td;
}

    const freqOptions = ['once', 'weekly', 'biweekly', 'monthly', 'yearly'];

    const tdName = createEditableCell('name');
    const tdAmount = createEditableCell('amount', val => `$${val.toFixed(2)}`);
    const tdFrequency = createEditableCell('frequency', null, freqOptions);
    const tdStartDate = createEditableCell('startDate', val =>
      parseLocalDate(val).toLocaleDateString('en-US')
    );

    const tdRemove = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'delete-btn';
    btn.textContent = 'X';
    btn.title = `Remove ${bill.name}`;
    btn.addEventListener('click', () => {
      bills.splice(idx, 1);
      saveBills();
      render();
    });

    tdRemove.appendChild(btn);

    tr.appendChild(tdName);
    tr.appendChild(tdAmount);
    tr.appendChild(tdFrequency);
    tr.appendChild(tdStartDate);
    tr.appendChild(tdRemove);

    billsTbody.appendChild(tr);
  });
}

// Helper function:
function parseLocalDate(dateString) {
  if (!dateString) return new Date(NaN);
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function onDragStart(e) {
  e.preventDefault();
  e.stopPropagation();

  isDragging = true;
  dragIndex = parseInt(e.target.dataset.idx, 10);

  startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
  startPercentA = categories[dragIndex].percentage;
  startPercentB = categories[dragIndex + 1].percentage;

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('touchend', onDragEnd, { passive: false });
}

function onDragMove(e) {
  if (!isDragging) return;

  e.preventDefault();
  e.stopPropagation();

  const currentY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
  const deltaY = currentY - startY;

  const containerHeight = chartContainer.offsetHeight || 460;
  const deltaPercent = deltaY / containerHeight;

  let newPercentA = startPercentA + deltaPercent;
  let newPercentB = startPercentB - deltaPercent;

  newPercentA = Math.max(newPercentA, 0);
  newPercentB = Math.max(newPercentB, 0);

  const leftover = 1 - categories[0].percentage;
  let sumOthers = 0;
  for (let i = 1; i < categories.length; i++) {
    if (i !== dragIndex && i !== dragIndex + 1) {
      sumOthers += categories[i].percentage;
    }
  }

  if (newPercentA + newPercentB + sumOthers > leftover) {
    const overflow = newPercentA + newPercentB + sumOthers - leftover;
    if (newPercentA > newPercentB) {
      newPercentA -= overflow;
    } else {
      newPercentB -= overflow;
    }
  }

  categories[dragIndex].percentage = newPercentA;
  categories[dragIndex + 1].percentage = newPercentB;

  // Live update segments
  const segA = categories[dragIndex]._seg;
  const segB = categories[dragIndex + 1]._seg;
  if (segA && segB) {
    const topA = parseInt(segA.style.top, 10);
    const heightA = Math.round(newPercentA * containerHeight);
    const heightB = Math.round(newPercentB * containerHeight);

    segA.style.height = `${heightA}px`;
    segB.style.top = `${topA + heightA}px`;
    segB.style.height = `${heightB}px`;

    // Move the handle to the new border position
    const handle = chartContainer.querySelector(`.handle[data-idx="${dragIndex}"]`);
    if (handle) {
      handle.style.top = `${topA + heightA}px`;
    }
    updateSmushedSegmentLabels();
  }

  // Live update label values (percent/money) in the segments
  const total = getTotalAmount();
  [dragIndex, dragIndex + 1].forEach(i => {
    const seg = categories[i]._seg;
    if (seg) {
      const valueSpan = seg.querySelector('.value');
      if (valueSpan) {
        valueSpan.textContent = showMoney
          ? `$${(categories[i].percentage * total).toFixed(2)}`
          : `${(categories[i].percentage * 100).toFixed(1)}%`;
      }
    }
  });

  // Live update legend if needed
  updateLegend(
    categories.filter(cat => {
      const seg = cat._seg;
      if (!seg) return false;
      const height = parseInt(seg.style.height, 10);
      return height < 60;
    }),
    getTotalAmount()
  );
}

function onDragEnd(e) {
  isDragging = false;
  dragIndex = null;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend', onDragEnd);
}

function updateSmushedSegmentLabels() {
  const chartContainer = document.getElementById('chart-container');
  const containerHeight = chartContainer ? chartContainer.offsetHeight : 400;

  // Match this with actual visual cutoff of your labels (adjust if needed)
  const threshold = 60; // previously was 24 or containerHeight * 0.12

  const hiddenSegments = [];

  categories.forEach(cat => {
    const seg = cat._seg;
    if (!seg) return;

    const height = parseInt(seg.style.height, 10);
    const nameSpan = seg.querySelector('.name');
    const valueSpan = seg.querySelector('.value');

    const shouldHide = height < threshold;

    if (nameSpan) {
      nameSpan.style.display = shouldHide ? 'none' : 'block';
    }
    if (valueSpan) {
      valueSpan.style.display = shouldHide ? 'none' : 'block';
    }

    if (shouldHide) {
      hiddenSegments.push(cat);
    }
  });

  // 💡 This ensures the legend always shows exactly what is hidden
  updateLegend(hiddenSegments, getTotalAmount());
}

totalInput.addEventListener('input', () => {
  enforceNumeric(totalInput);
  formatDollarInput(totalInput);
  render();
});

toggleBtn.addEventListener('click', () => {
  showMoney = !showMoney;
  toggleBtn.textContent = showMoney ? '$' : '%';
  render();
});

addBillForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = newBillName.value.trim();
  const amount = parseFloat(newBillAmount.value);
  const frequency = document.getElementById('new-bill-frequency').value;
  const startDate = document.getElementById('new-bill-start-date').value;

  if (name && !isNaN(amount) && amount >= 0 && frequency && startDate) {
    bills.push({ name, amount, frequency, startDate });
    saveBills();
    newBillName.value = '';
    newBillAmount.value = '';
    document.getElementById('new-bill-frequency').value = 'once';
    document.getElementById('new-bill-start-date').value = '';

    render();
  }
});

collapseToggle.addEventListener('click', () => {
  collapseContent.classList.toggle('open');
  collapseToggle.textContent = collapseContent.classList.contains('open') ? 'Hide Bills ▲' : 'Show Bills ▼';
});

// Set initial total if empty
if (!totalInput.value) totalInput.value = '1000';

render();

// NEW: open pay modal when clicking calendar button
calendarBtn.addEventListener('click', () => {
  payModal.style.display = 'flex'; // 'flex' to center content by CSS flexbox
  paydayInput.focus();
});

// NEW: close modal when clicking the close button
const closeModalBtn = document.querySelector('.close-modal');
if (closeModalBtn) {
  closeModalBtn.addEventListener('click', () => {
    payModal.style.display = 'none';
  });
}

// NEW: close modal when clicking outside modal content
payModal.addEventListener('click', (e) => {
  if (e.target === payModal) {
    payModal.style.display = 'none';
  }
});

payForm.addEventListener('submit', e => {
  e.preventDefault();
  payday = paydayInput.value;
  payFrequency = frequencyInput.value;

  localStorage.setItem('payday', payday);
  localStorage.setItem('payFrequency', payFrequency);

  payModal.style.display = 'none';

  render(); // re-render chart with new pay period
});

function getPayPeriodRange(payday, frequency) {
  if (!payday || !frequency) return null;
  const start = new Date(payday);
  const end = new Date(start);

  switch (frequency) {
    case 'weekly':
      end.setDate(start.getDate() + 6);
      break;
    case 'biweekly':
      end.setDate(start.getDate() + 13);
      break;
    case 'monthly':
      end.setMonth(start.getMonth() + 1);
      end.setDate(end.getDate() - 1);
      break;
    default:
      end.setDate(start.getDate() + 6);
  }
  return { start, end };
}

function billFallsInPeriod(bill, period) {
  if (!period) return true; // show all if no period set

  const billStart = new Date(bill.startDate);
  if (bill.frequency === 'once') {
    return billStart >= period.start && billStart <= period.end;
  }

  let date = new Date(billStart);

  while (date <= period.end) {
    if (date >= period.start && date <= period.end) return true;

    switch (bill.frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      default:
        return false;
    }
  }

  return false;
}

// WELCOME POPUP LOGIC - GLOBAL SCOPE

const welcomePopup = document.getElementById('welcome-popup');
const closeWelcomeBtn = document.getElementById('close-welcome-btn');

function checkFirstVisit() {
  const visited = localStorage.getItem('hasVisited');
  if (!visited) {
    welcomePopup.classList.add('show');
  }
}

closeWelcomeBtn.addEventListener('click', () => {
  welcomePopup.classList.remove('show');
  localStorage.setItem('hasVisited', 'true');
});

// Run on page load
checkFirstVisit();

const helpButton = document.getElementById('help-button');

helpButton.addEventListener('click', () => {
  welcomePopup.classList.add('show');
});

// Get elements
const floatBtn = document.getElementById('float-button');
const floatModal = document.getElementById('float-modal-overlay');
const closeFloatModalBtn = document.getElementById('close-float-modal');

// Open modal when float button clicked
floatBtn.addEventListener('click', () => {
  floatModal.style.display = 'flex'; // make modal visible, flex centers it per your CSS
});

// Close modal when close button clicked
closeFloatModalBtn.addEventListener('click', () => {
  floatModal.style.display = 'none';
});

// Also close modal if user clicks outside modal content
floatModal.addEventListener('click', (e) => {
  if (e.target === floatModal) {
    floatModal.style.display = 'none';
  }
  
});

const floatForm = document.getElementById('float-form');
const floatInput = document.getElementById('float-input');

// Load saved value from localStorage
const savedFloat = localStorage.getItem('floatAmount');
if (savedFloat !== null) {
  floatInput.value = savedFloat;
}

// Save new value on input
floatInput.addEventListener('input', () => {
  localStorage.setItem('floatAmount', floatInput.value);
});

floatForm.addEventListener('submit', e => {
  e.preventDefault();

  const data = floatInput.value.trim();

  if (data === '') {
    alert('Please enter some data before saving.');
    return;
  }

  if (name && !isNaN(amount) && amount >= 0 && frequency && startDate) {
  bills.push({ id: Date.now().toString(), name, amount, frequency, startDate });
  saveBills();

  }

  // Save data to localStorage or a variable
  localStorage.setItem('floatData', data);

  // Optionally update UI or state here

  // Close modal
  floatModal.style.display = 'none';

  // Optional: show a confirmation or refresh UI
  console.log('Float modal data saved:', data);
});

function proofBillsInPayPeriod() {
  const paydayString = localStorage.getItem('payday');
  const frequency = localStorage.getItem('payFrequency');
  const bills = JSON.parse(localStorage.getItem('bills')) || [];

  if (!paydayString || !frequency) {
    console.warn('Missing payday or frequency in localStorage.');
    return;
  }

  const today = new Date();
  const payday = new Date(paydayString);
  let periodStart = new Date(payday);

  // Find current pay period based on today
  while (periodStart <= today) {
    periodStart = addFrequency(periodStart, frequency);
  }
  const periodEnd = new Date(periodStart);
  periodStart = subtractFrequency(periodStart, frequency);

  function addFrequency(date, frequency) {
  const d = new Date(date);

  if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (frequency === 'biweekly') {
    d.setDate(d.getDate() + 14);
  } else if (frequency === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  } else if (frequency === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
  }

  return d;
}

  function subtractFrequency(date, frequency) {
  const d = new Date(date);

  if (frequency === 'weekly') {
    d.setDate(d.getDate() - 7);
  } else if (frequency === 'biweekly') {
    d.setDate(d.getDate() - 14);
  } else if (frequency === 'monthly') {
    d.setMonth(d.getMonth() - 1);
  } else if (frequency === 'yearly') {
    d.setFullYear(d.getFullYear() - 1);
  }

  return d;
}

  function getBillOccurrences(billStart, frequency, start, end) {
    const occurrences = [];
    let nextDate = new Date(billStart);

    while (nextDate <= end) {
      if (nextDate >= start && nextDate <= end) {
        occurrences.push(new Date(nextDate));
      }
      nextDate = addFrequency(nextDate, frequency);
    }

    return occurrences;
  }

  console.log("=== Current Pay Period ===");
  console.log("Start:", periodStart.toDateString());
  console.log("End:", periodEnd.toDateString());
  console.log("=== Bills and Inclusion Status ===");

  bills.forEach(bill => {
    const billStart = new Date(bill.startDate);
    const occurrences = getBillOccurrences(billStart, bill.frequency, periodStart, periodEnd);
    const included = occurrences.length > 0;

    console.log(`${bill.name} ($${parseFloat(bill.amount).toFixed(2)}), Frequency: ${bill.frequency}, Start Date: ${bill.startDate}`);
    console.log(`→ Included? ${included}`);
    console.log(`→ # of Charges: ${occurrences.length}`);
    if (occurrences.length) {
      console.log(`→ Charge Dates: ${occurrences.map(d => d.toDateString()).join(', ')}`);
    }
    console.log('---');
  });
}

proofBillsInPayPeriod();

// Alias getPayPeriodRange as getCurrentPayPeriod globally
window.getCurrentPayPeriod = getPayPeriodRange;

// Make getBillOccurrencesInPeriod global explicitly
function getBillOccurrencesInPeriod(bill, period) {
  const start = new Date(bill.startDate);
  const freq = bill.frequency;

  if (freq === 'once') {
    // Single occurrence check
    return (start >= period.start && start <= period.end) ? 1 : 0;
  }

  let occurrences = 0;
  let date = new Date(start);

  while (date <= period.end) {
    if (date >= period.start && date <= period.end) {
      occurrences++;
    }
    switch (freq) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        // If frequency unknown, treat as zero occurrences
        return 0;
    }
  }

  return occurrences;
}

// THIS IS A DEBUG CODE TO TEST IF NUMBERS ARE WORKING WITH THE BILLS AND PAY PERIOD OVERLAP

function debugBillBreakdown() {
  if (typeof getCurrentPayPeriod !== 'function' || typeof getBillOccurrencesInPeriod !== 'function') {
    console.error("Make sure getCurrentPayPeriod and getBillOccurrencesInPeriod are globally defined.");
    return;
  }

  const bills = JSON.parse(localStorage.getItem('bills')) || [];
  const payday = new Date(localStorage.getItem('payday'));
  const frequency = localStorage.getItem('payFrequency') || 'biweekly';
  const payPeriod = getCurrentPayPeriod(payday, frequency);

  console.log(`\n📆 PAY PERIOD: ${payPeriod.start.toISOString().slice(0,10)} → ${payPeriod.end.toISOString().slice(0,10)}`);
  console.log("------------------------------------------------------");

  let grandTotal = 0;

  bills.forEach(bill => {
    const occurrences = getBillOccurrencesInPeriod(bill, payPeriod);
    const total = occurrences * bill.amount;
    grandTotal += total;

    const billStart = new Date(bill.startDate);
    const chargeDates = [];

    if (occurrences > 0) {
      let date = new Date(billStart);
      let count = 0;

      while (count < occurrences) {
        if (date >= payPeriod.start && date <= payPeriod.end) {
          chargeDates.push(date.toISOString().slice(0, 10));
          count++;
        }

        switch (bill.frequency) {
          case 'weekly':
            date.setUTCDate(date.getUTCDate() + 7);
            break;
          case 'biweekly':
            date.setUTCDate(date.getUTCDate() + 14);
            break;
          case 'monthly':
            date.setUTCMonth(date.getUTCMonth() + 1);
            break;
          case 'yearly': {
            const originalDay = date.getUTCDate();
            date.setUTCFullYear(date.getUTCFullYear() + 1);
            if (date.getUTCDate() !== originalDay) {
              date.setUTCDate(0); // Roll back to last day of previous month
            }
            break;
          }
          case 'once':
            count++; // Only once
            break;
          default:
            console.warn(`Unknown frequency for bill "${bill.name}": ${bill.frequency}`);
            count++;
            break;
        }
      }
    }

    console.log(`🧾 ${bill.name}: ${occurrences} × $${bill.amount.toFixed(2)} = $${total.toFixed(2)}`);
    if (chargeDates.length > 0) {
      console.log(`→ Charge Dates (UTC): ${chargeDates.join(', ')}`);
    }
  });

  console.log("------------------------------------------------------");
  console.log(`💰 GRAND TOTAL: $${grandTotal.toFixed(2)}\n`);
}
