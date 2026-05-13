import { createRouter, createWebHistory } from 'vue-router'
import LoginView   from '../views/LoginView.vue'
import AdminView   from '../views/AdminView.vue'
import UsuarioView from '../views/UsuarioView.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/', redirect: '/login' },
    {
      path: '/admin',
      component: AdminView,
      meta: { requiresAuth: true, tipo: 'admin' },
    },
    {
      path: '/admin/solicitud/:id',
      component: () => import('../views/AdminSolicitudView.vue'),
      meta: { requiresAuth: true, tipo: 'admin' },
    },
    {
      path: '/usuario',
      component: UsuarioView,
      meta: { requiresAuth: true, tipo: 'usuario' },
    },
    {
      path: '/simulador',
      component: () => import('../views/SimuladorView.vue'),
      meta: { requiresAuth: true, tipo: 'usuario' },
    },
    {
      path: '/solicitud',
      component: () => import('../views/SolicitudView.vue'),
      meta: { requiresAuth: true, tipo: 'usuario' },
    },
    {
      path: '/documentos',
      component: () => import('../views/DocumentosView.vue'),
      meta: { requiresAuth: true, tipo: 'usuario' },
    },
  ],
})

router.beforeEach((to) => {
  if (!to.meta.requiresAuth) return true
  const auth    = useAuthStore()
  const usuario = auth.usuario
  if (!usuario) return '/login'
  if (to.meta.tipo && to.meta.tipo !== usuario.tipo) return '/login'
  return true
})

export default router