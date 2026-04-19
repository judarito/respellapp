import { createRouter, createWebHistory } from 'vue-router'
import AdminPage from '../pages/AdminPage.vue'
import CourseDetailPage from '../pages/CourseDetailPage.vue'
import CoursesPage from '../pages/CoursesPage.vue'
import LandingPage from '../pages/LandingPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import { useAuth } from '../composables/useAuth'

const { loadSession, authUser } = useAuth()

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: LandingPage,
    },
    {
      path: '/cursos',
      name: 'courses',
      component: CoursesPage,
    },
    {
      path: '/cursos/:slug',
      name: 'course-detail',
      component: CourseDetailPage,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      beforeEnter: async () => {
        await loadSession()

        if (authUser.value) {
          return { name: 'admin' }
        }

        return true
      },
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminPage,
      beforeEnter: async () => {
        await loadSession()

        if (!authUser.value) {
          return { name: 'login' }
        }

        return true
      },
    },
  ],
  scrollBehavior(to) {
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }

    return { top: 0 }
  },
})

export default router
