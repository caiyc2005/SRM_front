import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/views/Login.vue'
import Welcome from '@/views/Welcome.vue'
import OrderPage from '@/views/order/OrderPage.vue'
import DeliveryPage from '@/views/delivery/DeliveryPage.vue'
import ShipPage from '@/views/ship/ShipPage.vue'
import SupplierPage from '@/views/supplier/SupplierPage.vue'
import ReceivePage from '@/views/receive/ReceivePage.vue'
import UserManagement from '@/views/basic/UserManagement.vue'
import RoleManagement from '@/views/basic/RoleManagement.vue'
import MaterialManagement from '@/views/basic/MaterialManagement.vue'
import InventoryPage from '@/views/basic/InventoryPage.vue'
import WarehousePage from '@/views/basic/WarehousePage.vue'
import CreateOrderPage from '@/views/order/CreateOrderPage.vue'
import DeliveryPrintListPage from '@/views/delivery/DeliveryPrintListPage.vue'
import DeliveryDetailPage from '@/views/delivery/DeliveryDetailPage.vue'
import PDAReceivePage from '@/views/receive/PDAReceivePage.vue'
import SupplierUserPage from '@/views/supplier/SupplierUserPage.vue'
import ProfilePage from '@/views/ProfilePage.vue'
import DashboardMain from '@/views/Dashboard.vue'
import DigitalTwin from '@/views/DigitalTwin.vue'

/**
 * 角色-页面访问配置
 *
 * 每个路由的 meta.roles 列出允许访问的角色名称。
 * 不设置 meta.roles 或设为空数组 = 所有角色可访问（如登录页）。
 * 角色名称以你的后端返回为准，修改下面的数组即可调整。
 */
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
    path: '/welcome',
    name: 'Welcome',
    component: Welcome,
    meta: { title: '首页' }
  },
  {
    path: '/dashboard',
    redirect: '/dashboard/main'
  },
  {
    path: '/dashboard/main',
    name: 'DashboardMain',
    component: DashboardMain,
    meta: { roles: ['管理员', 'admin'], title: '主数据看板' }
  },
  {
    path: '/dashboard/twin',
    name: 'DigitalTwin',
    component: DigitalTwin,
    meta: { roles: ['管理员', 'admin'], title: '数字孪生' }
  },
  {
    path: '/order',
    redirect: '/order/pending'
  },
  {
    path: '/order/pending',
    name: 'OrderPending',
    component: OrderPage,
    meta: { roles: ['采购员', '管理员', 'admin','purchase', 'supplier'], title: '确认采购单' }
  },
  {
    path: '/order/pending-delivery',
    name: 'OrderPendingDelivery',
    component: OrderPage,
    meta: { roles: ['采购员', '管理员', 'admin','supplier', 'supplier'], title: '生成送货单' }
  },
  {
    path: '/order/query',
    name: 'OrderQuery',
    component: OrderPage,
    meta: { roles: ['采购员', '仓管员', '管理员', 'admin','purchase'], title: '订单一览表' }
  },
  {
    path: '/order/create',
    name: 'CreateOrder',
    component: CreateOrderPage,
    meta: { roles: ['采购员', '管理员', 'admin','purchase'], title: '创建采购单' }
  },
  {
    path: '/delivery',
    name: 'Delivery',
    component: DeliveryPage,
    meta: { roles: ['仓管员', '供应商', '管理员', 'admin','purchase'], title: '送货单查询' }
  },
  {
    path: '/delivery/details',
    name: 'DeliveryDetails',
    component: DeliveryDetailPage,
    meta: { roles: ['采购员', '仓管员', '管理员', 'admin', 'supplier','purchase'], title: '送货明细查询' }
  },
  {
    path: '/delivery/printlist',
    name: 'DeliveryPrintList',
    component: DeliveryPrintListPage,
    meta: { roles: ['仓管员', '供应商', '管理员', 'admin','supplier','purchase'], title: '打印送货单' }
  },
  {
    path: '/ship',
    name: 'Ship',
    component: ShipPage,
    meta: { roles: ['供应商', '管理员', 'admin','supplier'], title: '供应商发货' }
  },
  {
    path: '/supplier',
    name: 'Supplier',
    component: SupplierPage,
    meta: { roles: ['采购员', '管理员', 'admin'], title: '供应商管理' }
  },
  {
    path: '/supplier/users',
    name: 'SupplierUsers',
    component: SupplierUserPage,
    meta: { roles: ['供应商', 'supplier', '采购员', '管理员', 'admin'], title: '供应商子账号管理' }
  },
  {
    //web收料
    path: '/receive',
    name: 'Receive',
    component: ReceivePage,
    meta: { roles: ['仓管员', '管理员', 'admin'], title: '收料入库' }
  },
  {
    path: '/receive/pda',
    name: 'PDAReceive',
    component: PDAReceivePage,
    meta: { roles: ['whclerk', '仓管员', '管理员', 'admin'], title: 'PDA收料' }
  },
  // ========== 基础信息 ==========
  {
    path: '/profile',
    name: 'Profile',
    component: ProfilePage,
    meta: { title: '个人信息' }
  },
  {
    path: '/basic/user',
    name: 'UserManagement',
    component: UserManagement,
    meta: { roles: ['管理员', 'admin'], title: '用户管理' }
  },
  {
    path: '/basic/role',
    name: 'RoleManagement',
    component: RoleManagement,
    meta: { roles: ['管理员', 'admin'], title: '角色管理' }
  },
  {
    path: '/basic/material',
    name: 'MaterialManagement',
    component: MaterialManagement,
    meta: { roles: ['采购员', '仓管员', '管理员', 'admin'], title: '物料管理' }
  },
  {
    path: '/basic/inventory',
    name: 'Inventory',
    component: InventoryPage,
    meta: { roles: ['仓管员', '管理员', 'admin'], title: '库存查询' }
  },
  {
    path: '/basic/warehouse',
    name: 'Warehouse',
    component: WarehousePage,
    meta: { roles: ['仓管员', '管理员', 'admin'], title: '仓库管理' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

/** 检查当前用户是否有权访问指定路由 */
function hasRouteAccess(route) {
  // 没有 meta.roles 的路由 = 公开（如登录页、redirect 路由）
  if (!route.meta?.roles || route.meta.roles.length === 0) return true
  const userRoles = JSON.parse(localStorage.getItem('userRoles') || '[]')
  return route.meta.roles.some(role => userRoles.includes(role))
}

/** 找到当前用户有权访问的第一个页面路径（避免守卫死循环） */
function findFirstAccessibleRoute() {
  const userRoles = JSON.parse(localStorage.getItem('userRoles') || '[]')
  if (userRoles.length === 0) return null
  const allRoutes = router.getRoutes()
  const accessible = allRoutes.find(r =>
    r.path !== '/' &&
    r.path !== '/login' &&
    r.path !== '/dashboard' &&
    r.meta?.roles?.length &&
    r.meta.roles.some(role => userRoles.includes(role))
  )
  return accessible?.path || null
}

// 导航守卫：未登录 → 登录页；无权限 → 跳转到有权访问的页面
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')

  // 未登录 → 强制到登录页
  if (!token && to.name !== 'Login') {
    return next('/login')
  }

  // 已登录但目标路由无权限 → 静默跳转到有权访问的页面
  if (token && !hasRouteAccess(to)) {
    const fallback = findFirstAccessibleRoute()
    return next(fallback ? { path: fallback, replace: true } : '/login')
  }

  next()
})

export default router
