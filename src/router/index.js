import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/views/Login.vue'
import OrderPage from '@/views/order/OrderPage.vue'
import DeliveryPage from '@/views/delivery/DeliveryPage.vue'
import ShipPage from '@/views/ship/ShipPage.vue'
import SupplierPage from '@/views/supplier/SupplierPage.vue'
import ReceivePage from '@/views/receive/ReceivePage.vue'
import UserManagement from '@/views/basic/UserManagement.vue'
import RoleManagement from '@/views/basic/RoleManagement.vue'

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
    path: '/order/pending-delivery',
    name: 'OrderPendingDelivery',
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
  },
  // ========== 基础信息 ==========
  {
    path: '/basic/user',
    name: 'UserManagement',
    component: UserManagement
  },
  {
    path: '/basic/role',
    name: 'RoleManagement',
    component: RoleManagement
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
