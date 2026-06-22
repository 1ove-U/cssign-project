// ===========================
// js/app.js — Main Application Logic
// ===========================
import {
  getCategories, saveCategory as apiSaveCategory, deleteCategory as apiDeleteCategory,
  getProducts, saveProduct as apiSaveProduct, deleteProduct as apiDeleteProduct,
  uploadImage, deleteImage,
  getSettings, saveSettings as apiSaveSettings
} from './supabase.js';

// ===== STATE =====
let store = { categories: [], products: [], settings: {} };
let currentFilter = 'all';
let currentDetailProduct = null;
let pendingImageFiles = []; // File objects ยังไม่ได้ upload

// ===========================
// INIT
// ===========================
async function init() {
  showLoading(true);
  try {
    const [cats, prods, settings] = await Promise.all([
      getCategories(), getProducts(), getSettings()
    ]);
    store.categories = cats || [];
    store.products = prods || [];
    store.settings = settings || {};
    applySettings();
    renderHome();
  } catch (err) {
    showToast('❌ โหลดข้อมูลไม่สำเร็จ: ' + err.message, 'error');
  }
  showLoading(false);
}

function applySettings() {
  const s = store.settings;
  if (!s) return;
  if (s.phone) document.querySelectorAll('[data-setting="phone"]').forEach(el => el.textContent = s.phone);
  if (s.line_id) document.querySelectorAll('[data-setting="line"]').forEach(el => el.textContent = '@' + s.line_id);
  if (s.address) document.querySelectorAll('[data-setting="address"]').forEach(el => el.innerHTML = s.address.replace(/\n/g, '<br>'));
  if (s.hero_text) document.querySelectorAll('[data-setting="hero"]').forEach(el => el.textContent = s.hero_text);
}

// ===========================
// PAGE NAVIGATION
// ===========================
export function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-btn[data-page="${name}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (name === 'home') renderHome();
  if (name === 'products') renderProductsPage();
  if (name === 'admin') renderAdmin();
  window.scrollTo(0, 0);
}

export function goHome() { showPage('home'); }

// ===========================
// RENDER HOME
// ===========================
function renderHome() {
  document.getElementById('stat-products').textContent = store.products.length;
  document.getElementById('stat-cats').textContent = store.categories.length;

  const catGrid = document.getElementById('home-cat-grid');
  catGrid.innerHTML = store.categories.map(c => {
    const count = store.products.filter(p => p.cat_id === c.id).length;
    return `<div class="cat-card" onclick="app.showCategoryProducts(${c.id})">
      <div class="cat-icon">${c.icon}</div>
      <div class="cat-info">
        <div class="cat-name">${c.name}</div>
        <div class="cat-count">${count} รายการ</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">${c.description || ''}</div>
      </div>
      <div class="cat-arrow">›</div>
    </div>`;
  }).join('');

  const featured = store.products.filter(p => p.featured);
  const featGrid = document.getElementById('home-featured-grid');
  featGrid.innerHTML = featured.length === 0
    ? '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📦</div><div class="empty-title">ยังไม่มีสินค้าแนะนำ</div><div class="empty-text">ไปที่ Admin เพื่อตั้งค่าสินค้าแนะนำ</div></div>'
    : featured.map(p => productCard(p)).join('');
}

export function showCategoryProducts(catId) {
  currentFilter = catId;
  showPage('products');
}

// ===========================
// PRODUCT CARD
// ===========================
function productCard(p) {
  const cat = store.categories.find(c => c.id === p.cat_id);
  const imgs = Array.isArray(p.images) ? p.images : [];
  const statusBadge = p.status === 'preorder'
    ? '<div class="product-badge">สั่งผลิต</div>'
    : p.status === 'out' ? '<div class="product-badge" style="background:var(--muted)">สินค้าหมด</div>' : '';
  const imgContent = imgs.length > 0
    ? `<img src="${imgs[0]}" alt="${p.name}" loading="lazy">`
    : `<div class="product-img-placeholder">${cat ? cat.icon : '🏷️'}</div>`;

  return `<div class="product-card" onclick="app.showProductDetail(${p.id})">
    <div class="product-img">${imgContent}${statusBadge}</div>
    <div class="product-body">
      <div class="product-name">${p.name}</div>
      <div class="product-desc">${(p.description || '').substring(0, 70)}${(p.description || '').length > 70 ? '...' : ''}</div>
      <div class="product-footer">
        <div class="product-price">${p.price > 0 ? p.price.toLocaleString() : 'สอบถาม'}<small>${p.price > 0 ? ' บาท/' + (p.unit || 'ชิ้น') : ''}</small></div>
        <button class="inquiry-btn" onclick="event.stopPropagation();app.inquireProductId(${p.id})">สอบถาม</button>
      </div>
    </div>
  </div>`;
}

// ===========================
// PRODUCTS PAGE
// ===========================
function renderProductsPage() {
  const filterBar = document.getElementById('filter-bar');
  let chips = `<span class="filter-label">หมวดหมู่:</span>
    <button class="filter-chip ${currentFilter === 'all' ? 'active' : ''}" onclick="app.filterProducts('all', this)">ทั้งหมด</button>`;
  store.categories.forEach(c => {
    chips += `<button class="filter-chip ${currentFilter === c.id ? 'active' : ''}" onclick="app.filterProducts(${c.id}, this)">${c.icon} ${c.name}</button>`;
  });
  chips += `<div class="search-box" style="margin-left:auto"><span>🔍</span><input type="text" placeholder="ค้นหาสินค้า..." id="search-input" oninput="app.searchProducts()"></div>`;
  filterBar.innerHTML = chips;
  applyFilter();
}

export function filterProducts(catId, btn) {
  currentFilter = catId;
  document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter();
}

export function searchProducts() { applyFilter(); }

function applyFilter() {
  const q = (document.getElementById('search-input') || {}).value || '';
  let filtered = store.products;
  if (currentFilter !== 'all') filtered = filtered.filter(p => p.cat_id === currentFilter);
  if (q) filtered = filtered.filter(p => p.name.includes(q) || (p.description || '').includes(q));

  const titleEl = document.getElementById('products-page-title');
  const subEl = document.getElementById('products-page-sub');
  if (currentFilter === 'all') {
    titleEl.textContent = 'สินค้าทั้งหมด';
  } else {
    const cat = store.categories.find(c => c.id === currentFilter);
    titleEl.textContent = cat ? cat.name : 'สินค้า';
  }
  subEl.textContent = `${filtered.length} รายการ`;

  const grid = document.getElementById('products-grid');
  grid.innerHTML = filtered.length === 0
    ? '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><div class="empty-title">ไม่พบสินค้า</div><div class="empty-text">ลองเปลี่ยนคำค้นหาหรือหมวดหมู่</div></div>'
    : filtered.map(p => productCard(p)).join('');
}

// ===========================
// PRODUCT DETAIL
// ===========================
export function showProductDetail(id) {
  const p = store.products.find(x => x.id === id);
  if (!p) return;
  currentDetailProduct = p;
  const cat = store.categories.find(c => c.id === p.cat_id);
  const imgs = Array.isArray(p.images) ? p.images : [];
  document.getElementById('detail-title').textContent = p.name;
  const imgHtml = imgs.length > 0
    ? `<img src="${imgs[0]}" style="width:100%;height:100%;object-fit:cover;">`
    : `<span style="font-size:64px;">${cat ? cat.icon : '🏷️'}</span>`;
  const statusText = { available: '✅ มีสินค้า', preorder: '🔄 สั่งผลิต', out: '❌ สินค้าหมด' };

  document.getElementById('detail-body').innerHTML = `
    <div class="product-detail-imgs"><div class="product-detail-main">${imgHtml}</div></div>
    <div class="detail-row"><div class="detail-key">หมวดหมู่</div><div class="detail-val"><span class="badge badge-blue">${cat ? cat.icon + ' ' + cat.name : '-'}</span></div></div>
    <div class="detail-row"><div class="detail-key">ราคา</div><div class="detail-val" style="font-size:20px;font-weight:700;color:var(--navy);">${p.price > 0 ? p.price.toLocaleString() + ' บาท/' + (p.unit || 'ชิ้น') : 'สอบถามราคา'}</div></div>
    <div class="detail-row"><div class="detail-key">สถานะ</div><div class="detail-val">${statusText[p.status] || '-'}</div></div>
    <div class="detail-row" style="align-items:flex-start"><div class="detail-key">รายละเอียด</div><div class="detail-val" style="line-height:1.7;font-weight:400;">${p.description || '-'}</div></div>
  `;
  document.getElementById('detail-modal').classList.add('open');
}

export function closeDetailModal() {
  document.getElementById('detail-modal').classList.remove('open');
}

export function inquireProduct() {
  if (currentDetailProduct) inquireProductId(currentDetailProduct.id);
}

export function inquireProductId(id) {
  const p = store.products.find(x => x.id === id);
  const phone = store.settings?.phone || '081-234-5678';
  const line = store.settings?.line_id ? '@' + store.settings.line_id : '@paisign';
  showToast(`📞 กรุณาโทร ${phone} หรือ Line: ${line} เพื่อสอบถาม "${p ? p.name : 'สินค้า'}"`, 'success');
  document.getElementById('detail-modal').classList.remove('open');
}

// ===========================
// ADMIN
// ===========================
function renderAdmin() {
  updateDashboard();
  renderCategoryList();
  renderProductAdminList();
}

export function showAdminPanel(panel, btn) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
  document.getElementById('admin-' + panel).classList.add('active');
  if (btn) btn.classList.add('active');
  if (panel === 'dashboard') updateDashboard();
  if (panel === 'categories') renderCategoryList();
  if (panel === 'products-admin') renderProductAdminList();
  if (panel === 'settings') loadSettingsForm();
}

function updateDashboard() {
  document.getElementById('dash-products').textContent = store.products.length;
  document.getElementById('dash-cats').textContent = store.categories.length;
  document.getElementById('dash-featured').textContent = store.products.filter(p => p.featured).length;
  document.getElementById('dash-instock').textContent = store.products.filter(p => p.status === 'available').length;

  const recent = [...store.products].reverse().slice(0, 5);
  document.getElementById('dash-product-list').innerHTML = recent.map(p => {
    const cat = store.categories.find(c => c.id === p.cat_id);
    const imgs = Array.isArray(p.images) ? p.images : [];
    const imgEl = imgs.length > 0
      ? `<img src="${imgs[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`
      : `<span style="font-size:22px;">${cat ? cat.icon : '🏷️'}</span>`;
    const statusBadge = p.status === 'available' ? '<span class="badge badge-green">มีสินค้า</span>' :
      p.status === 'preorder' ? '<span class="badge badge-yellow">สั่งผลิต</span>' :
      '<span class="badge" style="background:#F1F5F9;color:var(--muted)">หมด</span>';
    return `<tr>
      <td><div class="td-img">${imgEl}</div></td>
      <td><strong>${p.name}</strong></td>
      <td>${cat ? cat.icon + ' ' + cat.name : '-'}</td>
      <td>${p.price > 0 ? p.price.toLocaleString() + ' ฿' : 'สอบถาม'}</td>
      <td>${statusBadge}</td>
    </tr>`;
  }).join('');
}

// ===========================
// CATEGORY ADMIN
// ===========================
function renderCategoryList() {
  const tbody = document.getElementById('category-list');
  if (store.categories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📁</div><div class="empty-title">ยังไม่มีหมวดหมู่</div></div></td></tr>';
    return;
  }
  tbody.innerHTML = store.categories.map(c => {
    const count = store.products.filter(p => p.cat_id === c.id).length;
    return `<tr>
      <td><div style="font-size:28px;text-align:center;">${c.icon}</div></td>
      <td><strong>${c.name}</strong></td>
      <td style="color:var(--muted);font-size:13px;">${c.description || '-'}</td>
      <td><span class="badge badge-blue">${count} รายการ</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-edit" onclick="app.openCategoryModal(${c.id})">✏️ แก้ไข</button>
          <button class="btn-danger" onclick="app.deleteCategoryConfirm(${c.id})">🗑 ลบ</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

export function openCategoryModal(id) {
  const modal = document.getElementById('category-modal');
  document.getElementById('edit-cat-id').value = id || '';
  if (id) {
    const c = store.categories.find(x => x.id === id);
    document.getElementById('cat-modal-title').textContent = 'แก้ไขหมวดหมู่';
    document.getElementById('cat-name').value = c.name;
    document.getElementById('cat-icon').value = c.icon;
    document.getElementById('cat-desc').value = c.description || '';
  } else {
    document.getElementById('cat-modal-title').textContent = 'เพิ่มหมวดหมู่ใหม่';
    document.getElementById('cat-name').value = '';
    document.getElementById('cat-icon').value = '🏷️';
    document.getElementById('cat-desc').value = '';
  }
  modal.classList.add('open');
}

export function closeCategoryModal() {
  document.getElementById('category-modal').classList.remove('open');
}

export async function saveCategory() {
  const name = document.getElementById('cat-name').value.trim();
  if (!name) { showToast('กรุณาระบุชื่อหมวดหมู่', 'error'); return; }
  const id = document.getElementById('edit-cat-id').value;
  const cat = {
    id: id ? parseInt(id) : null,
    name,
    icon: document.getElementById('cat-icon').value || '🏷️',
    description: document.getElementById('cat-desc').value.trim()
  };
  showLoading(true);
  try {
    await apiSaveCategory(cat);
    store.categories = await getCategories();
    showToast(id ? '✅ อัปเดตหมวดหมู่แล้ว' : '✅ เพิ่มหมวดหมู่แล้ว', 'success');
    closeCategoryModal();
    renderCategoryList();
    updateDashboard();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
  showLoading(false);
}

export async function deleteCategoryConfirm(id) {
  const count = store.products.filter(p => p.cat_id === id).length;
  if (count > 0) { showToast('ไม่สามารถลบได้ มีสินค้า ' + count + ' รายการในหมวดนี้', 'error'); return; }
  if (!confirm('ลบหมวดหมู่นี้?')) return;
  showLoading(true);
  try {
    await apiDeleteCategory(id);
    store.categories = await getCategories();
    showToast('ลบหมวดหมู่แล้ว');
    renderCategoryList();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
  showLoading(false);
}

// ===========================
// PRODUCT ADMIN
// ===========================
function renderProductAdminList() {
  const tbody = document.getElementById('product-admin-list');
  if (store.products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🏷️</div><div class="empty-title">ยังไม่มีสินค้า</div></div></td></tr>';
    return;
  }
  tbody.innerHTML = store.products.map(p => {
    const cat = store.categories.find(c => c.id === p.cat_id);
    const imgs = Array.isArray(p.images) ? p.images : [];
    const imgEl = imgs.length > 0
      ? `<img src="${imgs[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`
      : `<span style="font-size:22px;">${cat ? cat.icon : '🏷️'}</span>`;
    const statusBadge = p.status === 'available' ? '<span class="badge badge-green">มีสินค้า</span>' :
      p.status === 'preorder' ? '<span class="badge badge-yellow">สั่งผลิต</span>' :
      '<span class="badge" style="background:#F1F5F9;color:var(--muted)">หมด</span>';
    return `<tr>
      <td><div class="td-img">${imgEl}</div></td>
      <td><strong>${p.name}</strong></td>
      <td style="font-size:13px;">${cat ? cat.icon + ' ' + cat.name : '-'}</td>
      <td>${p.price > 0 ? p.price.toLocaleString() + ' ฿' : 'สอบถาม'}</td>
      <td>${statusBadge}</td>
      <td style="text-align:center;">${p.featured ? '⭐' : '—'}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit" onclick="app.openProductModal(${p.id})">✏️ แก้ไข</button>
          <button class="btn-danger" onclick="app.deleteProductConfirm(${p.id})">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

export function openProductModal(id) {
  pendingImageFiles = [];
  document.getElementById('image-preview').innerHTML = '';
  const modal = document.getElementById('product-modal');
  const catSel = document.getElementById('product-cat');
  catSel.innerHTML = store.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  document.getElementById('edit-product-id').value = id || '';

  if (id) {
    const p = store.products.find(x => x.id === id);
    document.getElementById('product-modal-title').textContent = 'แก้ไขสินค้า';
    document.getElementById('product-name').value = p.name;
    document.getElementById('product-cat').value = p.cat_id;
    document.getElementById('product-price').value = p.price;
    document.getElementById('product-unit').value = p.unit || '';
    document.getElementById('product-desc').value = p.description || '';
    document.getElementById('product-status').value = p.status;
    document.getElementById('product-featured').checked = p.featured;
    const imgs = Array.isArray(p.images) ? p.images : [];
    if (imgs.length > 0) {
      const previewEl = document.getElementById('image-preview');
      imgs.forEach((src, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'preview-wrap';
        wrap.dataset.url = src;
        wrap.innerHTML = `<img src="${src}" class="preview-img"><button class="preview-remove" onclick="app.removeExistingImg(${id}, ${i}, this.parentElement)">✕</button>`;
        previewEl.appendChild(wrap);
      });
    }
  } else {
    document.getElementById('product-modal-title').textContent = 'เพิ่มสินค้าใหม่';
    document.getElementById('product-name').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-unit').value = 'ชิ้น';
    document.getElementById('product-desc').value = '';
    document.getElementById('product-status').value = 'available';
    document.getElementById('product-featured').checked = false;
  }
  modal.classList.add('open');
}

export function closeProductModal() {
  document.getElementById('product-modal').classList.remove('open');
  pendingImageFiles = [];
}

export function previewImages(event) {
  const files = Array.from(event.target.files);
  const previewEl = document.getElementById('image-preview');
  files.forEach(file => {
    pendingImageFiles.push(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const wrap = document.createElement('div');
      wrap.className = 'preview-wrap pending';
      const idx = pendingImageFiles.length - 1;
      wrap.innerHTML = `<img src="${e.target.result}" class="preview-img"><button class="preview-remove" onclick="app.removePendingImg(${idx}, this.parentElement)">✕</button>`;
      previewEl.appendChild(wrap);
    };
    reader.readAsDataURL(file);
  });
}

export function removePendingImg(idx, el) {
  pendingImageFiles[idx] = null;
  el.remove();
}

export function removeExistingImg(productId, imgIdx, el) {
  const p = store.products.find(x => x.id === productId);
  if (p && Array.isArray(p.images)) p.images.splice(imgIdx, 1);
  el.remove();
}

export async function saveProduct() {
  const name = document.getElementById('product-name').value.trim();
  if (!name) { showToast('กรุณาระบุชื่อสินค้า', 'error'); return; }
  const catId = parseInt(document.getElementById('product-cat').value);
  if (!catId) { showToast('กรุณาเลือกหมวดหมู่', 'error'); return; }

  showLoading(true);
  try {
    // Upload new images
    const newUrls = [];
    for (const file of pendingImageFiles.filter(Boolean)) {
      const url = await uploadImage(file);
      newUrls.push(url);
    }

    const id = document.getElementById('edit-product-id').value;
    let existingImages = [];
    if (id) {
      const p = store.products.find(x => x.id === parseInt(id));
      existingImages = Array.isArray(p?.images) ? p.images : [];
    }

    const product = {
      id: id ? parseInt(id) : null,
      cat_id: catId,
      catId: catId,
      name,
      price: parseFloat(document.getElementById('product-price').value) || 0,
      unit: document.getElementById('product-unit').value || 'ชิ้น',
      description: document.getElementById('product-desc').value.trim(),
      status: document.getElementById('product-status').value,
      featured: document.getElementById('product-featured').checked,
      images: [...existingImages, ...newUrls]
    };

    await apiSaveProduct(product);
    store.products = await getProducts();
    showToast(id ? '✅ อัปเดตสินค้าแล้ว' : '✅ เพิ่มสินค้าแล้ว', 'success');
    closeProductModal();
    renderProductAdminList();
    updateDashboard();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
  showLoading(false);
}

export async function deleteProductConfirm(id) {
  if (!confirm('ลบสินค้านี้?')) return;
  showLoading(true);
  try {
    await apiDeleteProduct(id);
    store.products = await getProducts();
    showToast('ลบสินค้าแล้ว');
    renderProductAdminList();
    updateDashboard();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
  showLoading(false);
}

// ===========================
// SETTINGS
// ===========================
function loadSettingsForm() {
  const s = store.settings || {};
  document.getElementById('setting-name').value = s.shop_name || 'ป้ายพาณิชย์';
  document.getElementById('setting-phone').value = s.phone || '081-234-5678';
  document.getElementById('setting-line').value = s.line_id || 'paisign';
  document.getElementById('setting-address').value = s.address || '';
  document.getElementById('setting-hero').value = s.hero_text || '';
}

export async function saveSettingsForm() {
  const settings = {
    shop_name: document.getElementById('setting-name').value.trim(),
    phone: document.getElementById('setting-phone').value.trim(),
    line_id: document.getElementById('setting-line').value.trim(),
    address: document.getElementById('setting-address').value.trim(),
    hero_text: document.getElementById('setting-hero').value.trim()
  };
  showLoading(true);
  try {
    await apiSaveSettings(settings);
    store.settings = settings;
    applySettings();
    showToast('✅ บันทึกการตั้งค่าแล้ว', 'success');
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
  showLoading(false);
}

// ===========================
// TOAST & LOADING
// ===========================
export function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type || '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

function showLoading(show) {
  document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

// ===========================
// EXPORT TO GLOBAL (for inline onclick)
// ===========================
window.app = {
  showPage, goHome, showCategoryProducts,
  filterProducts, searchProducts,
  showProductDetail, closeDetailModal, inquireProduct, inquireProductId,
  showAdminPanel,
  openCategoryModal, closeCategoryModal, saveCategory, deleteCategoryConfirm,
  openProductModal, closeProductModal, previewImages, removePendingImg, removeExistingImg, saveProduct, deleteProductConfirm,
  saveSettingsForm
};

// Start
init();
