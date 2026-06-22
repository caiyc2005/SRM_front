import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/views/Login.vue'
import OrderPage from '@/views/order/OrderPage.vue'
import DeliveryPage from '@/views/delivery/DeliveryPage.vue'
import UserPage from '@/views/user/UserPage.vue'
import ShipPage from '@/views/ship/ShipPage.vue'
import SupplierPage from '@/views/supplier/SupplierPage.vue'
import ReceivePage from '@/views/receive/ReceivePage.vue'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/order',
    redirect: '/order/pending'
  },
  {
    path: '/order/pending',
    name: 'OrderPending',
    component: OrderPage
  },
  {
    path: '/order/query',
    name: 'OrderQuery',
    component: OrderPage
  },
  {
    path: '/delivery',
    name: 'Delivery',
    component: DeliveryPage
  },
  {
    path: '/user',
    name: 'User',
    component: UserPage
  },
  {
    path: '/ship',
    name: 'Ship',
    component: ShipPage
  },
  {
    path: '/supplier',
    name: 'Supplier',
    component: SupplierPage
  },
  {
    path: '/receive',
    name: 'Receive',
    component: ReceivePage
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
