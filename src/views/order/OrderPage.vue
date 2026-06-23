<script setup>
/**
 * OrderPage.vue — 采购订单管理
 *
 * 查询、确认、生成送货单、导出、创建订单一体化。
 */
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'

import AppSidebar from '@/components/AppSidebar.vue'
import AppFilter from '@/components/AppFilter.vue'
import Logout from '@/components/Logout.vue'
import OrderTable from './OrderTable.vue'
import CreateOrderDialog from './CreateOrderDialog.vue'

import { getStatusText, getStatusTag, generateOrderNo, generateDeliveryNo, formatNow } from '@/utils/orderUtils'

import { DEFAULT_MATERIALS, initMockOrders, deliverySeq as mockDeliverySeq } from '@/mock'

// ============ API 基础路径 ============
const API_BASE = '/api/Orders'

// ============ 数据状态 ============
const supplierList = ref([])
const materialList = ref([])

async function loadSuppliers() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/Supplier/GetAllSuppliers', {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data?.length) {
      supplierList.value = result.data
      return
    }
  } catch { /* 降级：沿用空列表 */ }
}

const query = reactive({
  orderCode: '',
  supplierID: '',
  status: '',
  pageNum: 1,
  pageSize: 10
})

const mockData = ref([])
const tableData = ref([])
const total = ref(0)

const deliverySeq = mockDeliverySeq
const useApi = ref(false)

const route = useRoute()

// 判断当前模式
function isPendingMode() {
  return route.path === '/order/pending'
}
function isPendingDeliveryMode() {
  return route.path === '/order/pending-delivery'
}

// 筛选字段配置（待确认/待生成送货单列表不显示状态筛选）
const orderStatusOptions = [
  { label: '待确认', value: '0' },
  { label: '已确认', value: '1' },
  { label: '待发货', value: '2' },
  { label: '已发货', value: '3' },
  { label: '已收货', value: '4' },
  { label: '已完成', value: '5' }
]
const orderFilterFields = computed(() => {
  const fields = [
    { key: 'orderCode', label: '订单编号', type: 'input', width: 220 },
    { key: 'supplierID', label: '供应商', type: 'select', width: 220, options: supplierList.value, labelKey: 'supplierName', valueKey: 'supplierID' }
  ]
  if (!isPendingMode() && !isPendingDeliveryMode()) {
    fields.push({ key: 'status', label: '订单状态', type: 'select', width: 180, options: orderStatusOptions })
  }
  return fields
})

// 创建订单弹窗
const createDialogVisible = ref(false)
const createForm = reactive({
  supplierID: '',
  materials: [],
  remark: ''
})

// ============ 计算属性 ============
const filteredData = computed(() => {
  let data = [...mockData.value]
  if (query.orderCode) data = data.filter(item => item.orderCode.includes(query.orderCode))
  if (query.supplierID) data = data.filter(item => item.supplierID === query.supplierID)
  if (query.status) data = data.filter(item => item.status === query.status)
  return data
})

// ============ 方法 ============
async function loadOrders() {
  // ========== 优先调后端 API ==========
  try {
    const params = new URLSearchParams()
    if (query.orderCode) params.append('orderCode', query.orderCode)
    if (query.supplierID) params.append('supplierID', query.supplierID)
    if (isPendingMode()) {
      params.append('status', '0')
    } else if (isPendingDeliveryMode()) {
      params.append('status', '1')
    } else if (query.status) {
      params.append('status', query.status)
    }
    params.append('pageIndex', String(query.pageNum))
    params.append('pageSize', String(query.pageSize))

    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/GetOrdersByList?${params}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.success && result.data) {
      const d = result.data
      total.value = d.total
      tableData.value = (d.list || []).map(o => ({
        ...o,
        status: String(o.status),
        createTime: o.createTime ? o.createTime.replace('T', ' ').slice(0, 16) : '',
        materialCount: o.orderDetails?.length || 0,
        totalAmount: (o.orderDetails || []).reduce((s, od) => s + (od.amount || 0), 0).toFixed(2),
        noteCode: o.noteCode || '',
        materials: (o.orderDetails || []).map((od, i) => ({
          index: i + 1,
          materialCode: od.materialCode,
          materialName: od.materialName,
          spec: od.spec || '',
          qty: od.qty,
          unitPrice: od.unitPrice,
          amount: od.amount
        }))
      }))
      if (isPendingMode()) {
        tableData.value = tableData.value.filter(item => item.status === '0')
      }
      useApi.value = true
      return
    }
  } catch { /* 后端不可用，降级到 mock */ }

  // ========== 降级：使用 mock 数据做客户端分页 ==========
  useApi.value = false
  mockData.value = initMockOrders(supplierList.value)
  let data = filteredData.value
  if (isPendingMode()) {
    data = data.filter(item => item.status === '0')
  } else if (isPendingDeliveryMode()) {
    data = data.filter(item => item.status === '1')
  }
  total.value = data.length
  const start = (query.pageNum - 1) * query.pageSize
  tableData.value = data.slice(start, start + query.pageSize)
}

function loadTable() {
  loadOrders()
}

function handleQuery() {
  query.pageNum = 1
  loadOrders()
}

function handleReset() {
  query.orderCode = ''
  query.supplierID = ''
  query.status = ''
  query.pageNum = 1
  loadOrders()
}

function handleExport() {
  const data = filteredData.value
  if (data.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  const exportList = data.map(item => ({
    '订单编号': item.orderCode,
    '供应商名称': item.supplierName,
    '订单状态': getStatusText(item.status),
    '物料种类': item.materialCount,
    '订单总金额(元)': item.totalAmount,
    '创建时间': item.createTime
  }))

  const worksheet = XLSX.utils.json_to_sheet(exportList)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '采购订单')
  XLSX.writeFile(
    workbook,
    `采购订单列表_${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}.xlsx`
  )
  ElMessage.success('导出成功')
}

// ============ 获取物料列表 ============
async function loadMaterials() {
  try {
    const res = await fetch('/api/Materials/GetAll', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data?.length) {
      materialList.value = result.data
      return
    }
  } catch {
    // 静默失败，降级到模拟数据
  }
  materialList.value = [...DEFAULT_MATERIALS]
}

// ============ 创建订单 ============
function openCreateDialog() {
  createForm.supplierID = ''
  createForm.materials = [{ materialID: '', qty: 1, unitPrice: 0 }]
  createForm.remark = ''
  createDialogVisible.value = true
}

function addMaterial() {
  createForm.materials.push({ materialID: '', qty: 1, unitPrice: 0 })
}

function removeMaterial(index) {
  if (createForm.materials.length <= 1) {
    ElMessage.warning('至少保留一行物料信息')
    return
  }
  createForm.materials.splice(index, 1)
}

async function submitCreateOrder() {
  if (!createForm.supplierID) {
    ElMessage.warning('请选择供应商')
    return
  }

  const validMaterials = createForm.materials.filter(
    item => item.materialID && item.qty > 0 && item.unitPrice > 0
  )
  if (validMaterials.length === 0) {
    ElMessage.warning('请完善至少一行有效物料信息')
    return
  }

  const supplier = supplierList.value.find(s => s.supplierID === createForm.supplierID)

  const orderData = {
    SupplierID: String(createForm.supplierID),
    SupplierName: supplier ? supplier.supplierName : '',
    Materials: validMaterials.map(item => ({
      MaterialID: item.materialID,
      Qty: item.qty,
      UnitPrice: Number(item.unitPrice.toFixed(2))
    })),
    Memo: createForm.remark || ''
  }

  console.log('发送到后端的订单数据:', JSON.stringify(orderData, null, 2))

  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/CreateOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(orderData)
    })
    const text = await res.text()
    let result
    try { result = text ? JSON.parse(text) : {} } catch { result = {} }

    if (result.success) {
      ElMessage.success('采购订单创建成功（后端）')
    } else {
      ElMessage.warning(result.message || '后端创建失败，已保存到本地')
    }
  } catch {
    ElMessage.success('采购订单创建成功（本地）')
  }

  // 后端创建成功后，同步添加到本地 mock 列表以便显示
  let totalAmount = 0
  const materials = validMaterials.map((item, index) => {
    const amount = (item.qty * item.unitPrice).toFixed(2)
    totalAmount += Number(amount)
    const mat = materialList.value.find(m => (m.materialID || m.materialCode) === item.materialID)
    return {
      index: index + 1,
      materialID: item.materialID,
      materialCode: mat?.materialCode || item.materialID,
      materialName: mat?.materialName || item.materialID,
      spec: '标准规格',
      qty: item.qty,
      unitPrice: item.unitPrice.toFixed(2),
      amount
    }
  })

  const newOrder = {
    orderID: String(mockData.value.length + 1),
    orderCode: generateOrderNo(),
    supplierID: createForm.supplierID,
    supplierName: supplier ? supplier.supplierName : '',
    status: '0',
    materialCount: materials.length,
    totalAmount: totalAmount.toFixed(2),
    createTime: formatNow(),
    materials,
    memo: createForm.remark || '',
    noteCode: ''
  }

  mockData.value.unshift(newOrder)
  loadTable()
  createDialogVisible.value = false
}

// ============ 订单操作 ============
async function handleConfirm(row) {
  try {
    await ElMessageBox.confirm(
      `确认要将订单 ${row.orderCode} 标记为「已确认」状态吗？确认后将不可撤回。`,
      '订单确认操作',
      { type: 'warning' }
    )
  } catch { return }

  // ========== 优先调后端 API ==========
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/ConfirmOrder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      // body: JSON.stringify({ id: row.orderID }) //与后端需要的字段不匹配
      body: JSON.stringify({ orderID: row.orderID })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.success) {
      ElMessage.success('订单确认成功')
      await loadOrders()
      return
    }
    ElMessage.error(result.message || '确认失败')
  } catch { /* 降级到本地 */ }

  // ========== 降级：本地模拟 ==========
  const targetOrder = mockData.value.find(item => item.orderID === row.orderID)
  if (targetOrder) targetOrder.status = '1'
  ElMessage.success('订单确认成功（本地）')
  loadTable()
}

async function handleGenerateDelivery(row) {
  try {
    await ElMessageBox.confirm(
      `确认要为订单 ${row.orderCode} 生成送货单吗？生成后订单状态将更新为「待发货」。`,
      '生成送货单',
      { type: 'warning', confirmButtonText: '确认生成' }
    )
  } catch { return }

  // ========== 优先调后端 API ==========
  try {
    let userInfo = { userID: '', userName: '' }
    try { userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}') } catch {}
    const token = localStorage.getItem('token')

    const res = await fetch('/api/Delivery/CreateDeliveryNote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        orderID: row.orderID,
        createByID: userInfo.userID || '',
        createByName: userInfo.userName || ''
      })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.code === 200) {
      ElMessage.success(`送货单生成成功，单号：${result.data?.noteCode || ''}`)
      await loadOrders()
      return
    }
    ElMessage.error(result.message || '生成送货单失败')
  } catch { /* 降级到本地 */ }

  // ========== 降级：本地模拟 ==========
  const targetOrder = mockData.value.find(item => item.orderID === row.orderID)
  if (targetOrder) {
    const newDeliveryNo = generateDeliveryNo(deliverySeq.value)
    deliverySeq.value++
    targetOrder.status = '2'
    targetOrder.noteCode = newDeliveryNo
    ElMessage.success(`送货单生成成功，单号：${newDeliveryNo}（本地）`)
    loadTable()
  }
}

// ============ 生命周期 ============
onMounted(() => {
  loadSuppliers()
  loadOrders()
  loadMaterials()
})

watch(
  () => [query.pageNum, query.pageSize],
  () => loadOrders()
)

// 切换菜单时重新加载
watch(() => route.path, () => {
  query.pageNum = 1
  loadOrders()
})
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>采购订单管理</h3>
        <Logout />
      </div>

      <div class="content">
        <AppFilter :fields="orderFilterFields" :model="query" @query="handleQuery" @reset="handleReset">
          <template #buttons>
            <el-button type="success" @click="handleExport">
              <el-icon><Download /></el-icon> 导出Excel
            </el-button>
            <el-button type="primary" @click="openCreateDialog">创建采购订单</el-button>
          </template>
        </AppFilter>

        <OrderTable
          :table-data="tableData"
          :total="total"
          :query="query"
          action-type="all"
          :hide-confirm="!isPendingMode() && !isPendingDeliveryMode()"
          :hide-status="isPendingMode() || isPendingDeliveryMode()"
          @confirm="handleConfirm"
          @generate-delivery="handleGenerateDelivery"
        />
      </div>
    </div>

    <CreateOrderDialog
      :visible="createDialogVisible"
      :supplier-list="supplierList"
      :material-list="materialList"
      :form-data="createForm"
      @update:visible="createDialogVisible = $event"
      @add-material="addMaterial"
      @remove-material="removeMaterial"
      @submit="submitCreateOrder"
    />
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 60px; background: #fff; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
.content { padding: 20px; flex: 1; overflow-y: auto; }
</style>
