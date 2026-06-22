// ===========================
// js/supabase.js — Supabase Client
// ===========================
// แก้ไข SUPABASE_URL และ SUPABASE_ANON_KEY ด้วยค่าจาก Supabase Dashboard
// Settings → API → Project URL & anon public key

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJibHFycHdydnRvdGF6dG9icGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNzY5MzIsImV4cCI6MjA5NzY1MjkzMn0.qAmRDZZqOfDD8GpSBIimtjKaPbMIcU2LbA45rnUPAEs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===========================
// CATEGORIES CRUD
// ===========================
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
}

export async function saveCategory(cat) {
  if (cat.id) {
    // Update
    const { error } = await supabase
      .from('categories')
      .update({ name: cat.name, icon: cat.icon, description: cat.description })
      .eq('id', cat.id);
    if (error) throw error;
  } else {
    // Insert
    const { error } = await supabase
      .from('categories')
      .insert({ name: cat.name, icon: cat.icon, description: cat.description });
    if (error) throw error;
  }
}

export async function deleteCategory(id) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ===========================
// PRODUCTS CRUD
// ===========================
export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  // Parse images JSON string → array
  return data.map(p => ({
    ...p,
    images: Array.isArray(p.images) ? p.images : (p.images ? JSON.parse(p.images) : [])
  }));
}

export async function saveProduct(product) {
  const payload = {
    cat_id: product.catId,
    name: product.name,
    price: product.price,
    unit: product.unit,
    description: product.description,
    status: product.status,
    featured: product.featured,
    images: JSON.stringify(product.images || [])
  };

  if (product.id) {
    const { error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', product.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('products')
      .insert(payload);
    if (error) throw error;
  }
}

export async function deleteProduct(id) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ===========================
// STORAGE — อัปโหลดรูปภาพ
// ===========================
export async function uploadImage(file) {
  const ext = file.name.split('.').pop();
  const fileName = `products/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

export async function deleteImage(url) {
  // Extract path from full URL
  const path = url.split('/product-images/')[1];
  if (!path) return;
  await supabase.storage.from('product-images').remove([path]);
}

// ===========================
// SETTINGS
// ===========================
export async function getSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .single();
  if (error) return null;
  return data;
}

export async function saveSettings(settings) {
  const { data } = await supabase.from('settings').select('id').single();
  if (data) {
    const { error } = await supabase
      .from('settings')
      .update(settings)
      .eq('id', data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('settings').insert(settings);
    if (error) throw error;
  }
}
