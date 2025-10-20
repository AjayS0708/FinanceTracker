/* Neo-Finance Animated Dashboard - Optimized Version */

const KEYS = { individual: 'individualTransactions', vendor: 'vendorTransactions' };
let active = localStorage.getItem('nf_active') || 'individual';
let data = { individual: [], vendor: [] };
let editingId = null;
let pieChart = null, lineChart = null, modalPie = null, modalLine = null;

// DOM cache - optimized
const DOM = {
  tabIndividual: document.getElementById('tab-individual'),
  tabVendor: document.getElementById('tab-vendor'),
  search: document.getElementById('search'),
  filter: document.getElementById('filter'),
  categoryFilter: document.getElementById('category-filter'),
  txList: document.getElementById('transaction-list'),
  balance: document.getElementById('balance'),
  income: document.getElementById('income'),
  expenses: document.getElementById('expenses'),
  txCount: document.getElementById('tx-count'),
  form: document.getElementById('tx-form'),
  desc: document.getElementById('desc'),
  amt: document.getElementById('amt'),
  cat: document.getElementById('cat'),
  date: document.getElementById('date'),
  note: document.getElementById('note'),
  exportBtn: document.getElementById('export-csv'),
  analyticsBtn: document.getElementById('btn-analytics'),
  analyticsModal: document.getElementById('analytics-modal'),
  closeAnalytics: document.getElementById('close-analytics'),
  modalPie: document.getElementById('modalPie'),
  modalLine: document.getElementById('modalLine'),
  pieCanvas: document.getElementById('pieChart'),
  lineCanvas: document.getElementById('lineChart'),
  insights: document.getElementById('insights'),
  toast: document.getElementById('toast'),
  clearAllBtn: document.getElementById('clear-all'),
  formTitle: document.getElementById('form-title'),
  yearSpan: document.getElementById('year'),
};

// Section configurations - consolidated
const SECTION_CONFIG = {
  individual: {
    label: 'Description',
    placeholder: 'e.g., Grocery, Coffee, Salary',
    title: 'Add Personal Transaction',
    categories: ['Income', 'Salary', 'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Other'],
    labels: { income: 'Income', expenses: 'Expenses', balance: 'Balance' }
  },
  vendor: {
    label: 'Vendor/Client Name',
    placeholder: 'e.g., ABC Corp, John Doe Client',
    title: 'Add Vendor Transaction',
    categories: ['Payment Received', 'Service Fee', 'Project Payment', 'Consultation', 'Product Sale', 'Refund Issued', 'Commission', 'Other'],
    labels: { income: 'Revenue', expenses: 'Expenses', balance: 'Net Profit' }
  }
};

/* ---------- Core Functions ---------- */
function loadAll() {
  data.individual = JSON.parse(localStorage.getItem(KEYS.individual) || '[]');
  data.vendor = JSON.parse(localStorage.getItem(KEYS.vendor) || '[]');
}

function save(section) {
  localStorage.setItem(KEYS[section], JSON.stringify(data[section]));
}

function setActive(section) {
  active = section;
  localStorage.setItem('nf_active', section);
  DOM.tabIndividual.classList.toggle('active', section === 'individual');
  DOM.tabVendor.classList.toggle('active', section === 'vendor');
  document.getElementById('app').setAttribute('data-section', section);
  updateFormForSection(section);
  render();
}

function updateFormForSection(section) {
  const config = SECTION_CONFIG[section];
  const descLabel = document.querySelector('label:has(#desc)');
  
  descLabel.innerHTML = `${config.label} (optional)<input id="desc" placeholder="${config.placeholder}">`;
  DOM.cat.innerHTML = config.categories.map(cat => `<option>${cat}</option>`).join('');
  
  const formPanel = document.querySelector('.form-panel h3');
  if (formPanel && !editingId) formPanel.textContent = config.title;
  
  DOM.desc = document.getElementById('desc'); // Re-cache
}

function updateSummary(txs) {
  const balance = txs.reduce((s,t)=> s + Number(t.amount), 0);
  const income = txs.filter(t=> Number(t.amount) > 0).reduce((s,t)=> s + Number(t.amount), 0);
  const expenses = txs.filter(t=> Number(t.amount) < 0).reduce((s,t)=> s + Number(t.amount), 0);
  
  const config = SECTION_CONFIG[active];
  document.querySelector('#card-income small').textContent = config.labels.income;
  document.querySelector('#card-expenses small').textContent = config.labels.expenses;
  document.querySelector('#card-balance small').textContent = config.labels.balance;
  
  animateNumber(DOM.balance, balance);
  animateNumber(DOM.income, income);
  animateNumber(DOM.expenses, expenses);
  DOM.txCount.textContent = txs.length;
}

function render() {
  const txs = data[active].slice();
  updateSummary(txs);
  renderList(txs);
  renderCharts(txs);
  populateCategoryFilter();
  resetForm();
  animateEntrance();
}

function resetForm() {
  DOM.form.reset();
  editingId = null;
  DOM.formTitle.textContent = 'Add Transaction';
  document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.amt-btn[data-type="income"]')?.classList.add('active');
}

function renderList(all) {
  const q = (DOM.search.value || '').toLowerCase().trim();
  const f = DOM.filter.value;
  const cf = DOM.categoryFilter.value;
  let filtered = all.slice().sort((a,b)=> b.id - a.id);

  if (f === 'income') filtered = filtered.filter(t => Number(t.amount) > 0);
  if (f === 'expense') filtered = filtered.filter(t => Number(t.amount) < 0);
  if (cf && cf !== 'all') filtered = filtered.filter(t => t.category === cf);
  if (q) filtered = filtered.filter(t => (t.description||'').toLowerCase().includes(q) || (t.note||'').toLowerCase().includes(q));

  DOM.txList.innerHTML = filtered.length ? 
    filtered.map(createTransactionElement).join('') :
    `<li class="tx-item"><div class="tx-left"><div class="tx-desc">No transactions</div><div class="tx-meta">Add one using the form</div></div></li>`;
}

function createTransactionElement(t) {
  const isVendor = active === 'vendor';
  return `
    <li class="tx-item" style="transform: translateY(18px); opacity: 0;">
      <div class="tx-left">
        <div class="tx-desc" ${isVendor ? 'style="font-weight: 500;"' : ''}>${t.description}</div>
        <div class="tx-meta">${t.category} • ${formatDate(t.date)}${t.note ? ' • '+t.note : ''}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amt ${Number(t.amount)>0 ? 'income' : 'expense'}">${formatCurrency(t.amount)}</div>
        <button class="icon-btn" title="Edit" onclick="startEdit(${t.id})">✎</button>
        <button class="icon-btn" title="Delete" onclick="removeTransaction(${t.id})">🗑</button>
      </div>
    </li>
  `;
}

function removeTransaction(id) {
  if(!confirm('Delete this transaction?')) return;
  data[active] = data[active].filter(t => t.id !== id);
  save(active);
  render();
  toast('Transaction deleted', 'info');
}

function renderCharts(txs) {
  const totals = {};
  txs.forEach(t => {
    const cat = t.category || 'Other';
    totals[cat] = (totals[cat] || 0) + Math.abs(Number(t.amount));
  });

  const labels = Object.keys(totals);
  const catData = labels.map(l => totals[l]);
  const months = lastNMonths(6);
  const monthlyData = months.map(m => {
    return txs.reduce((sum, t) => {
      const d = t.date ? new Date(t.date) : new Date(Number(t.id));
      return (d.getMonth() === m.month && d.getFullYear() === m.year) ? sum + Number(t.amount) : sum;
    }, 0);
  });

  // Destroy previous charts
  [pieChart, lineChart].forEach(chart => chart?.destroy());

  // Create new charts
  pieChart = new Chart(DOM.pieCanvas.getContext('2d'), {
    type:'doughnut',
    data: { labels, datasets: [{ data: catData, backgroundColor: palette(labels.length) }] },
    options: { responsive:true, plugins:{legend:{position:'bottom'}}, cutout:'60%' }
  });

  lineChart = new Chart(DOM.lineCanvas.getContext('2d'), {
    type:'line',
    data: { labels: months.map(m => m.label), datasets: [{ label:'Net', data: monthlyData, borderColor: 'rgba(59,130,246,0.95)', backgroundColor: 'rgba(59,130,246,0.12)', fill:true, tension:0.35, pointRadius: 4 }] },
    options: { responsive:true, plugins:{legend:{display:false}}, scales:{ y: { beginAtZero:true } } }
  });
}

function startEdit(id) {
  const tx = data[active].find(t => t.id === id);
  if (!tx) return;
  
  editingId = id;
  DOM.desc.value = tx.description;
  DOM.amt.value = tx.amount;
  DOM.cat.value = tx.category;
  DOM.date.value = tx.date ? new Date(tx.date).toISOString().slice(0,10) : '';
  DOM.note.value = tx.note || '';
  DOM.formTitle.textContent = 'Edit Transaction';
  
  // Update amount buttons
  const isIncome = Number(tx.amount) >= 0;
  document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.amt-btn[data-type="${isIncome ? 'income' : 'expense'}"]`)?.classList.add('active');
  
  window.scrollTo({ top:0, behavior:'smooth' });
}

function openAnalytics() {
  DOM.analyticsModal.classList.remove('hidden');
  [modalPie, modalLine].forEach(chart => chart?.destroy());
  
  if (pieChart) modalPie = new Chart(DOM.modalPie.getContext('2d'), { type:'pie', data: structuredClone(pieChart.data), options:{plugins:{legend:{position:'bottom'}}} });
  if (lineChart) modalLine = new Chart(DOM.modalLine.getContext('2d'), { type:'line', data: structuredClone(lineChart.data), options:{plugins:{legend:{display:false}}} });
  
  const insights = generateInsights(data[active]);
  DOM.insights.innerHTML = insights.map(i => `<div class="insight"><strong>${i.title}</strong><p>${i.text}</p></div>`).join('');
}

function closeAnalytics() {
  DOM.analyticsModal.classList.add('hidden');
  [modalPie, modalLine].forEach(chart => { chart?.destroy(); });
  modalPie = modalLine = null;
}

/* ---------- Utilities ---------- */
function animateNumber(el, toValue) {
  const from = parseFloat(el.dataset.value || 0);
  const to = Number(toValue) || 0;
  el.dataset.value = to;
  anime({
    targets: { v: from }, v: to, round: 2, easing: 'easeOutCubic', duration: 900,
    update: anim => el.textContent = formatCurrency(anim.animations[0].currentValue)
  });
}

function animateEntrance() {
  anime.timeline({ easing:'easeOutCubic' })
    .add({ targets: '.stat', translateY: [20,0], opacity: [0,1], delay: anime.stagger(80), duration: 600 })
    .add({ targets: '.panel.card', translateY: [20,0], opacity: [0,1], delay: anime.stagger(60), duration: 700 }, '-=300')
    .add({ targets: '.tx-item', translateY: [18,0], opacity: [0,1], delay: anime.stagger(40), duration: 420 }, '-=500');
}

function populateCategoryFilter() {
  const used = new Set(['All']);
  data.individual.concat(data.vendor).forEach(t => used.add(t.category || 'Other'));
  DOM.categoryFilter.innerHTML = `<option value="all">All categories</option>` + 
    Array.from(used).filter(c => c && c.toLowerCase() !== 'all')
      .map(c => `<option value="${c}">${c}</option>`).join('');
}

const formatCurrency = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(n||0));
const formatDate = d => new Date(d || Date.now()).toLocaleDateString();
const toast = (msg, type='info') => {
  DOM.toast.classList.remove('hidden');
  DOM.toast.textContent = msg;
  DOM.toast.style.background = type==='warn' ? 'linear-gradient(90deg,#f97316,#ffb86b)' : 
    (type==='info' ? 'linear-gradient(90deg,#7c3aed,#06b6d4)' : 'linear-gradient(90deg,#06b6d4,#3b82f6)');
  setTimeout(() => DOM.toast.classList.add('hidden'), 1500);
};
const palette = n => ['#3b82f6','#06b6d4','#7c3aed','#f97316','#ef4444','#f59e0b','#8b5cf6'].slice(0,n);
const lastNMonths = n => {
  const res = [], now = new Date();
  for(let i=n-1; i>=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    res.push({month:d.getMonth(), year:d.getFullYear(), label:d.toLocaleString(undefined,{month:'short',year:'numeric'})});
  }
  return res;
};
const generateInsights = txs => {
  if(!txs.length) return [{title:'No data', text:'Add transactions to see insights.'}];
  const totalExp = txs.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(Number(t.amount)),0);
  const totalInc = txs.filter(t=>t.amount>0).reduce((s,t)=>s+Number(t.amount),0);
  const avgExpense = (totalExp/Math.max(1,txs.filter(t=>t.amount<0).length)).toFixed(2);
  const cat = {};
  txs.forEach(t=>cat[t.category]=(cat[t.category]||0)+Math.abs(Number(t.amount)));
  const topCat = Object.entries(cat).sort((a,b)=>b[1]-a[1])[0];
  const insights = [
    {title:'Net', text:`Income ${formatCurrency(totalInc)} • Expenses ${formatCurrency(-totalExp)}`},
    {title:'Avg expense', text:`Average expense ${formatCurrency(avgExpense)}`}
  ];
  if(topCat) insights.push({title:`Top: ${topCat[0]}`, text:`${formatCurrency(topCat[1])} spent`});
  return insights;
};

/* ---------- Event Listeners ---------- */
DOM.form.addEventListener('submit', e => {
  e.preventDefault();
  
  if (!DOM.amt.value || !DOM.cat.value) {
    toast('Please fill all required fields', 'error');
    return;
  }
  
  const description = DOM.desc.value.trim();
  const amount = Number(DOM.amt.value);
  const category = DOM.cat.value;
  const dateVal = DOM.date.value || new Date().toISOString();
  const note = DOM.note.value.trim();

  if (!amount) return toast('Enter a valid amount', 'warn');

  if (editingId) {
    const idx = data[active].findIndex(t => t.id === editingId);
    if (idx > -1) {
      data[active][idx] = { ...data[active][idx], description, amount, category, date: dateVal, note };
      toast('Updated', 'success');
    }
  } else {
    data[active].push({ id: Date.now(), description, amount, category, date: dateVal, note });
    toast('Saved', 'success');
    anime({ targets: '.btn.primary', scale: [1, 0.98, 1], duration: 450, easing: 'easeInOutQuad' });
  }
  save(active);
  render();
});

// Amount type buttons
document.querySelectorAll('.amt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const currentValue = Math.abs(parseFloat(DOM.amt.value) || 0);
    if (currentValue > 0) {
      DOM.amt.value = btn.dataset.type === 'expense' ? -currentValue : currentValue;
    }
  });
});

DOM.amt.addEventListener('input', () => {
  const value = parseFloat(DOM.amt.value);
  document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('active'));
  const activeType = value >= 0 ? 'income' : 'expense';
  document.querySelector(`.amt-btn[data-type="${activeType}"]`)?.classList.add('active');
});

// Other event listeners
DOM.search.addEventListener('input', render);
DOM.filter.addEventListener('change', render);
DOM.categoryFilter.addEventListener('change', render);
DOM.tabIndividual.addEventListener('click', () => setActive('individual'));
DOM.tabVendor.addEventListener('click', () => setActive('vendor'));
document.getElementById('btn-reset').addEventListener('click', resetForm);

DOM.exportBtn.addEventListener('click', () => {
  const rows = [['Description','Amount','Category','Date','Note']];
  data[active].forEach(t => rows.push([t.description, t.amount, t.category, t.date, t.note||'']));
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${active}_transactions_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('CSV exported', 'success');
});

DOM.clearAllBtn.addEventListener('click', () => {
  if (!data[active].length) return toast('No data to clear', 'warn');
  if (confirm(`Clear all ${active} transactions?`)) {
    data[active] = [];
    save(active);
    render();
    toast('Cleared', 'info');
  }
});

DOM.analyticsBtn.addEventListener('click', openAnalytics);
DOM.closeAnalytics?.addEventListener('click', closeAnalytics);
DOM.analyticsModal.addEventListener('click', e => e.target === DOM.analyticsModal && closeAnalytics());
document.addEventListener('keydown', e => e.key === 'Escape' && !DOM.analyticsModal.classList.contains('hidden') && closeAnalytics());

// Initialize
(() => {
  DOM.yearSpan && (DOM.yearSpan.textContent = new Date().getFullYear());
  loadAll();
  setActive(active || 'individual');
})();
