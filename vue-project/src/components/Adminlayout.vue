<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route  = useRoute()
const auth   = useAuthStore()

const menuAbierto = ref(false)

const navItems = [
  { label: 'Solicitudes',     path: '/admin'             },
  { label: 'Gestión pagarés', disabled: true },
  { label: 'Cierre mensual', disabled: true  },
  { label: 'Reportes',  disabled: true},
]

function navegar(path) {
  if (!path) return
  router.push(path)
  menuAbierto.value = false
}

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell">

    <!-- HEADER -->
    <header class="app-header">
      <button class="hamburger" @click="menuAbierto = !menuAbierto" :class="{ open: menuAbierto }" aria-label="Abrir menú">
        <span></span><span></span><span></span>
      </button>

      <span class="brand">Oficina Virtual FSCU — Panel administración</span>

      <div class="header-right">
        <div class="user-info">
          <span class="name">{{ auth.nombre }}</span>
          <span class="divider-dot">—</span>
          <span class="role">Funcionario</span>
        </div>
        <button class="logout-btn" @click="logout" title="Cerrar sesión">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Salir
        </button>
      </div>
    </header>

    <div class="layout">

      <div v-if="menuAbierto" class="sidebar-overlay" @click="menuAbierto = false"></div>

      <!-- SIDEBAR -->
      <nav class="sidebar" :class="{ 'sidebar--open': menuAbierto }">
        <a
          v-for="item in navItems"
          :key="item.path"
          :class="{ active: route.path === item.path }"
          @click="navegar(item.path)"
        >
          {{ item.label }}
        </a>
      </nav>

      <!-- CONTENIDO -->
      <slot />

    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
}

/* ── HEADER ──────────────────────────────────── */
.app-header {
  height: var(--header-h) !important;
  background: var(--surface) !important;
  border-bottom: 1px solid var(--border) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 0 24px !important;
  position: sticky !important;
  top: 0 !important;
  z-index: 20 !important;
  line-height: normal !important;
  max-height: none !important;
  gap: 12px;
}

.brand {
  font-weight: 600;
  font-size: 14px;
  letter-spacing: -0.3px;
  color: var(--text-primary);
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.user-info {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.user-info .name  { color: var(--text-primary); font-weight: 500; }
.user-info .role  { color: var(--text-muted); font-size: 12px; }
.divider-dot      { color: var(--border); }

/* ── LOGOUT BTN ──────────────────────────────── */
.logout-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 7px;
  font-family: 'DM Sans', sans-serif;
  font-size: 12.5px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.logout-btn:hover {
  background: var(--bg);
  color: var(--accent-red);
  border-color: #f5c6c6;
}

/* ── HAMBURGER ───────────────────────────────── */
.hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  flex-shrink: 0;
  border-radius: 6px;
  transition: background 0.15s;
}
.hamburger:hover { background: var(--bg); }
.hamburger span {
  display: block;
  width: 20px;
  height: 2px;
  background: var(--text-primary);
  border-radius: 2px;
  transition: all 0.25s ease;
  transform-origin: center;
}
.hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
.hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

/* ── LAYOUT ──────────────────────────────────── */
.layout {
  display: flex;
  flex: 1;
  width: 100%;
  position: relative;
}

/* ── SIDEBAR ─────────────────────────────────── */
.sidebar {
  width: var(--sidebar-width) !important;
  min-width: var(--sidebar-width) !important;
  background: var(--surface) !important;
  border-right: 1px solid var(--border) !important;
  padding: 28px 0 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 2px !important;
  min-height: calc(100vh - var(--header-h)) !important;
  margin: 0 !important;
}

.sidebar a {
  display: block !important;
  padding: 9px 24px !important;
  text-decoration: none !important;
  color: var(--text-secondary) !important;
  font-size: 13.5px !important;
  font-weight: 400 !important;
  border-left: 2.5px solid transparent !important;
  border-right: none !important;
  border-top: none !important;
  border-bottom: none !important;
  transition: all 0.15s ease !important;
  cursor: pointer !important;
}
.sidebar a:hover  { color: var(--text-primary) !important; background: var(--bg) !important; }
.sidebar a.active {
  color: var(--text-primary) !important;
  font-weight: 500 !important;
  border-left-color: var(--text-primary) !important;
  background: var(--bg) !important;
}

/* ── OVERLAY ─────────────────────────────────── */
.sidebar-overlay { display: none; }

/* ── MÓVIL ───────────────────────────────────── */
@media (max-width: 600px) {
  .hamburger { display: flex; }
  .user-info .role { display: none; }
  .divider-dot     { display: none; }

  .sidebar {
    position: fixed !important;
    top: var(--header-h) !important;
    left: 0 !important;
    height: calc(100vh - var(--header-h)) !important;
    min-height: unset !important;
    z-index: 15 !important;
    transform: translateX(-100%) !important;
    transition: transform 0.25s ease !important;
    box-shadow: none !important;
  }
  .sidebar--open {
    transform: translateX(0) !important;
    box-shadow: 4px 0 20px rgba(0,0,0,0.12) !important;
  }
  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    top: var(--header-h);
    background: rgba(0,0,0,0.25);
    z-index: 14;
    backdrop-filter: blur(1px);
  }
}
</style>