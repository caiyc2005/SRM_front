<script setup>
/**
 * OrderPage.vue — 采购订单管理
 *
 * 查询、确认、生成送货单、导出、创建订单一体化。
 */
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import ExcelJS from 'exceljs'

import AppSidebar from '@/components/AppSidebar.vue'
import AppFilter from '@/components/AppFilter.vue'
import Logout from '@/components/Logout.vue'
import OrderTable from './OrderTable.vue'
import CreateOrderDialog from './CreateOrderDialog.vue'

import { getStatusText, getStatusTag, generateOrderNo, generateDeliveryNo, formatNow } from '@/utils/orderUtils'

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
  confirmStatus: '0',
  dateRange: null,
  pageNum: 1,
  pageSize: 10
})

const tableData = ref([])
const total = ref(0)

const useApi = ref(false)

const orderTableRef = ref(null)

const route = useRoute()

// 判断当前模式
function isPendingMode() {
  return route.path === '/order/pending'
}
function isPendingDeliveryMode() {
  return route.path === '/order/pending-delivery'
}

// 当前用户角色
const userRoles = JSON.parse(localStorage.getItem('userRoles') || '[]')
const isSupplier = userRoles.some(r => r === 'supplier' || r === '供应商')

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
    { key: 'orderCode', label: '订单编号', type: 'input', width: 220 }
  ]
  // 供应商角色在生成送货单页面不显示供应商筛选
  if (!isPendingDeliveryMode() || !isSupplier) {
    fields.push({ key: 'supplierID', label: '供应商', type: 'select', width: 220, options: supplierList.value, labelKey: 'supplierName', valueKey: 'supplierID' })
  }
  if (isPendingMode()) {
    fields.push({
      key: 'confirmStatus',
      label: '确认状态',
      type: 'select',
      width: 140,
      options: [
        { label: '全部', value: '' },
        { label: '未确认', value: '0' },
        { label: '已确认', value: '1' }
      ]
    })
  }
  if (!isPendingMode() && !isPendingDeliveryMode()) {
    fields.push({ key: 'status', label: '订单状态', type: 'select', width: 180, options: orderStatusOptions })
  }
  fields.push({ key: 'dateRange', label: '创建时间', type: 'daterange', width: 300 })
  return fields
})

// 创建订单弹窗
const createDialogVisible = ref(false)
const createForm = reactive({
  supplierID: '',
  materials: [],
  remark: ''
})

// ============ 方法 ============
async function loadOrders() {
  // ========== 优先调后端 API ==========
  try {
    const token = localStorage.getItem('token')
    const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {}

    // ===== 待确认模式：调用明细级别接口 =====
    if (isPendingMode()) {
      const params = {}
      if (query.orderCode) params.orderCode = query.orderCode
      if (query.supplierID) params.supplierID = query.supplierID
      if (query.dateRange) {
        params.startTime = query.dateRange[0]
        params.endTime = query.dateRange[1]
      }
      params.pageIndex = query.pageNum
      params.pageSize = query.pageSize

      const res = await fetch(`${API_BASE}/GetOrdersDetailsByList`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(params)
      })
      const text = await res.text()
      const result = text ? JSON.parse(text) : {}

      if (result.success && result.data) {
        const d = result.data
        let list = (d.list || []).map(od => ({
          orderID: od.orderID,
          orderCode: od.orderCode,
          supplierName: od.supplierName,
          createTime: od.orderCreateTime ? od.orderCreateTime.replace('T', ' ').slice(0, 16) : '',
          orderDetailID: od.orderDetailID || od.detailID || od.id || '',
          detailStatus: String(od.isConfirm ?? 0),
          materialCode: od.materialCode || od.materialID || '',
          materialName: od.materialName,
          spec: od.spec || '',
          qty: od.qty,
          unit: od.unit || '',
          unitPrice: od.unitPrice,
          amount: od.amount
        }))
        // 确认状态前端过滤
        if (query.confirmStatus === '1') {
          list = list.filter(item => item.detailStatus === '1')
        } else if (query.confirmStatus === '0') {
          list = list.filter(item => item.detailStatus === '0')
        }
        // 客户端二次校验：日期区间筛选
        if (query.dateRange) {
          const [start, end] = query.dateRange
          list = list.filter(item => {
            const d = (item.createTime || '').slice(0, 10)
            return d >= start && d <= end
          })
        }
        tableData.value = list
        total.value = list.length
        useApi.value = true
      }
      return
    }

    // ===== 待生成送货单模式：调用已确认订单接口 =====
    if (isPendingDeliveryMode()) {
      const params = {}
      if (query.orderCode) params.orderCode = query.orderCode
      if (query.supplierID) params.supplierID = query.supplierID
      if (query.dateRange) {
        params.startTime = query.dateRange[0]
        params.endTime = query.dateRange[1]
      }
      params.pageIndex = query.pageNum
      params.pageSize = query.pageSize

      const res = await fetch(`${API_BASE}/GetConfirmedOrders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(params)
      })
      const text = await res.text()
      const result = text ? JSON.parse(text) : {}

      if (result.success && result.data) {
        const d = result.data
        let list = (d.list || []).map(od => ({
          orderID: od.orderID,
          orderCode: od.orderCode,
          supplierName: od.supplierName,
          createTime: od.orderCreateTime ? od.orderCreateTime.replace('T', ' ').slice(0, 16) : '',
          orderDetailID: od.orderDetailID || od.detailID || od.id || '',
          detailStatus: String(od.isConfirm ?? 0),
          materialCode: od.materialCode || od.materialID || '',
          materialName: od.materialName,
          spec: od.spec || '',
          qty: od.qty,
          deliveredQty: od.deliveredQty || 0,
          availableQty: od.availableQty ?? od.qty,
          unit: od.unit || '',
          unitPrice: od.unitPrice,
          amount: od.amount
        }))
        // 客户端二次校验：日期区间筛选
        if (query.dateRange) {
          const [start, end] = query.dateRange
          list = list.filter(item => {
            const d = (item.createTime || '').slice(0, 10)
            return d >= start && d <= end
          })
        }
        tableData.value = list
        total.value = d.total
        useApi.value = true
      }
      return
    }

    // ===== 订单查询模式：调用订单级别接口 =====
    const params = new URLSearchParams()
    if (query.orderCode) params.append('orderCode', query.orderCode)
    if (query.supplierID) params.append('supplierID', query.supplierID)
    if (query.dateRange) {
      params.append('startDate', query.dateRange[0])
      params.append('endDate', query.dateRange[1])
    }
    if (query.status) {
      params.append('status', query.status)
    }
    params.append('pageIndex', String(query.pageNum))
    params.append('pageSize', String(query.pageSize))

    const res = await fetch(`${API_BASE}/GetOrdersByList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(Object.fromEntries(params))
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.success && result.data) {
      const d = result.data
      let list = (d.list || []).map(o => ({
        ...o,
        status: String(o.status),
        createTime: o.createTime ? o.createTime.replace('T', ' ').slice(0, 16) : '',
        deliveryDate: o.deliveryDate ? o.deliveryDate.replace('T', ' ').slice(0, 16) : '',
        materialCount: o.orderDetails?.length || 0,
        totalAmount: (o.orderDetails || []).reduce((s, od) => s + (od.amount || 0), 0).toFixed(2),
        noteCode: o.noteCode || '',
        materials: (o.orderDetails || []).map((od, i) => ({
          index: i + 1,
          materialCode: od.materialCode || od.materialID || '',
          materialName: od.materialName,
          spec: od.spec || '',
          unit: od.unit || '',
          qty: od.qty,
          unitPrice: od.unitPrice,
          amount: od.amount,
          isConfirm: od.isConfirm
        }))
      }))
      // 客户端二次校验：日期区间筛选
      if (query.dateRange) {
        const [start, end] = query.dateRange
        list = list.filter(item => {
          const d = (item.createTime || '').slice(0, 10)
          return d >= start && d <= end
        })
      }
      tableData.value = list
      total.value = d.total
      useApi.value = true
      return
    }
  } catch { /* 后端不可用 */ }
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
  query.confirmStatus = '0'
  query.dateRange = null
  query.pageNum = 1
  loadOrders()
}

/** 列宽自适应：根据表头和内容计算最大宽度 */
function calcColWidths(headers, rows) {
  return headers.map((h, i) => {
    let maxLen = h.length * 2
    for (const row of rows) {
      const val = String(row[i] ?? '')
      const len = [...val].reduce((s, c) => s + (c.charCodeAt(0) > 127 ? 2 : 1), 0)
      if (len > maxLen) maxLen = len
    }
    return { width: Math.min(maxLen + 4, 60) }
  })
}

async function handleExport() {
  const data = tableData.value
  if (data.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  const headers = ['订单编号', '供应商名称', '订单状态', '物料种类', '订单总金额(元)', '创建时间']

  const rows = data.map(item => [
    item.orderCode,
    item.supplierName,
    getStatusText(item.status),
    item.materialCount,
    item.totalAmount,
    item.createTime
  ])

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SRM系统'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('采购订单')

  // 先设列宽（必须在写入数据前）
  sheet.columns = calcColWidths(headers, rows)

  // 写入表头
  const headerRow = sheet.addRow(headers)
  headerRow.font = { name: '微软雅黑', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF409EFF' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.border = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' }
  }
  headerRow.height = 28

  // 写入数据行
  rows.forEach((row, idx) => {
    const dataRow = sheet.addRow(row)
    dataRow.font = { name: '微软雅黑', size: 10.5 }
    dataRow.alignment = { vertical: 'middle', horizontal: 'center' }
    dataRow.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    }
    dataRow.height = 24
    // 偶数行浅色背景
    if (idx % 2 === 1) {
      dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } }
    }
  })

  // 导出
  let userName = ''
  try { userName = JSON.parse(localStorage.getItem('userInfo') || '{}').userName || '' } catch {}
  const dateStr = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`
  const fileName = `采购订单列表_${userName}_${dateStr}.xlsx`
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
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
    // 静默失败
  }
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

  // ========== 物料去重 + 价格一致性校验 ==========
  const materialMap = new Map()
  const priceConflicts = []

  for (const item of validMaterials) {
    const key = item.materialID
    if (materialMap.has(key)) {
      const existing = materialMap.get(key)
      if (Number(existing.unitPrice) !== Number(item.unitPrice)) {
        // 价格不一致 → 记录冲突
        const mat = materialList.value.find(m => (m.materialID || m.materialCode) === key)
        const name = mat?.materialName || key
        let conflict = priceConflicts.find(c => c.materialID === key)
        if (!conflict) {
          conflict = { materialID: key, materialName: name, prices: [Number(existing.unitPrice)] }
          priceConflicts.push(conflict)
        }
        if (!conflict.prices.includes(Number(item.unitPrice))) {
          conflict.prices.push(Number(item.unitPrice))
        }
      } else {
        // 价格一致 → 合并数量
        existing.qty += item.qty
      }
    } else {
      materialMap.set(key, { ...item })
    }
  }

  if (priceConflicts.length > 0) {
    let msg = '以下物料存在重复添加且单价不一致，请重新录入：<br><br>'
    for (const c of priceConflicts) {
      msg += `【${c.materialName}】单价：${c.prices.join('、')}<br>`
    }
    await ElMessageBox.alert(msg, '物料单价冲突', {
      dangerouslyUseHTMLString: true,
      type: 'warning',
      confirmButtonText: '知道了'
    })
    return
  }

  // 使用合并后的物料列表
  const merged = Array.from(materialMap.values())

  const orderData = {
    SupplierID: String(createForm.supplierID),
    SupplierName: supplier ? supplier.supplierName : '',
    Materials: merged.map(item => ({
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
      ElMessage.success('采购订单创建成功')
      loadTable()
      createDialogVisible.value = false
      return
    }
    ElMessage.warning(result.message || '创建失败')
  } catch {
    ElMessage.error('创建失败，后端不可用')
  }
}

// ============ 订单操作 ============
async function handleConfirm(row) {
  try {
    await ElMessageBox.confirm(
      `确认要将订单 ${row.orderCode} 【整个订单】标记为「已确认」状态吗？确认后将不可撤回。`,
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
  } catch { /* 降级 */ }
}

async function handleConfirmDetail(row) {
  try {
    await ElMessageBox.confirm(
      `确认要确认物料「${row.materialName}」（订单 ${row.orderCode}）吗？确认后将不可撤回。`,
      '物料确认操作',
      { type: 'warning' }
    )
  } catch { return }

  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/ConfirmOrderDetail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ orderDetailIDs: [row.orderDetailID] })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.success) {
      ElMessage.success('物料确认成功')
      await loadOrders()
      return
    }
    ElMessage.error(result.message || '确认失败')
  } catch {
    ElMessage.error('确认失败，后端不可用')
  }
}

/** 批量确认采购明细 */
async function handleBatchConfirm(rows) {
  if (!rows || rows.length === 0) return

  try {
    await ElMessageBox.confirm(
      `确认要批量确认 ${rows.length} 条采购明细吗？确认后将不可撤回。`,
      '批量确认操作',
      { type: 'warning', confirmButtonText: '确认批量确认' }
    )
  } catch { return }

  const token = localStorage.getItem('token')
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {}

  try {
    const res = await fetch(`${API_BASE}/ConfirmOrderDetail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ orderDetailIDs: rows.map(r => r.orderDetailID) })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.success || result.code === 200) {
      ElMessage.success(`确认成功，共 ${rows.length} 条`)
    } else {
      ElMessage.warning(result.message || `确认完成，部分明细确认失败`)
    }
  } catch {
    ElMessage.error('确认失败，后端不可用')
  }
  if (orderTableRef.value) orderTableRef.value.clearSelection()
  await loadOrders()
}

async function handleBatchDelivery(rows) {
  if (!rows || rows.length === 0) return

  // 过滤掉已生成送货单的明细（isConfirm === 2）
  const validRows = rows.filter(r => r.detailStatus !== '2')
  const skippedCount = rows.length - validRows.length
  if (skippedCount > 0) {
    ElMessage.warning(`${skippedCount} 条明细已生成送货单，已排除`)
  }
  if (validRows.length === 0) {
    ElMessage.warning('选中的明细都已生成送货单，无需重复操作')
    if (orderTableRef.value) orderTableRef.value.clearSelection()
    return
  }

  // 打开送货数量输入弹窗
  openDeliveryQtyDialog(validRows)
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
    ElMessageBox.alert(result.message || '生成送货单失败', '操作失败', {
      type: 'error',
      confirmButtonText: '知道了'
    })
  } catch { /* 降级 */ }
}

// ============ 送货数量弹窗 ============
const deliveryQtyVisible = ref(false)
const deliveryQtyItems = ref([])
const expectedDate = ref('')

function disabledDate(time) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return time.getTime() < today.getTime()
}

function openDeliveryQtyDialog(rows) {
  deliveryQtyItems.value = rows.map(r => ({
    ...r,
    deliveryQty: r.availableQty // 默认等于可发货最大数量
  }))
  expectedDate.value = ''
  deliveryQtyVisible.value = true
}

async function confirmDeliveryWithQty() {
  const items = deliveryQtyItems.value

  // 校验每条明细的送货数量是否超出可发数量
  const overItems = items.filter(r => r.deliveryQty > r.availableQty)
  if (overItems.length > 0) {
    ElMessage.warning(`物料「${overItems[0].materialName}」的送货数量（${overItems[0].deliveryQty}）超出可发数量（${overItems[0].availableQty}），请调整`)
    return
  }

  const validItems = items.filter(r => r.deliveryQty > 0)
  if (validItems.length === 0) {
    ElMessage.warning('请填写至少一条明细的送货数量')
    return
  }

  try {
    let userInfo = { userID: '', userName: '' }
    try { userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}') } catch {}
    const token = localStorage.getItem('token')

    const res = await fetch('/api/Delivery/CreateDeliveryNote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        expectedDate: expectedDate.value || undefined,
        items: validItems.map(r => ({
          orderDetailID: r.orderDetailID,
          orderCode: r.orderCode,
          deliveryQty: r.deliveryQty
        })),
        createByID: userInfo.userID || '',
        createByName: userInfo.userName || ''
      })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.code === 200 || result.success) {
      deliveryQtyVisible.value = false
      ElMessage.success(`送货单生成成功，共 ${validItems.length} 条明细`)
      if (orderTableRef.value) orderTableRef.value.clearSelection()
      await loadOrders()
      return
    }

    // API 返回错误时弹窗提示
    let errMsg = result.message || '生成送货单失败'
    validItems.forEach(item => {
      errMsg = errMsg.replace(item.orderDetailID, item.orderCode)
    })
    ElMessageBox.alert(errMsg, '操作失败', {
      type: 'error',
      confirmButtonText: '知道了'
    })
  } catch {
    ElMessage.error('生成送货单失败，后端不可用')
  }
}

// ============ 生命周期 ============
onMounted(() => {
  if (!isSupplier) loadSuppliers()
  loadOrders()
  if (!isSupplier) loadMaterials()
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
        <h3>{{ isPendingMode() ? '确认采购明细' : isPendingDeliveryMode() ? '生成送货单' : '采购订单管理' }}</h3>
        <Logout />
      </div>

      <div class="content">
        <AppFilter :fields="orderFilterFields" :model="query" @query="handleQuery" @reset="handleReset">
          <template #buttons>
            <el-button type="success" @click="handleExport">
              <el-icon><Download /></el-icon> 导出Excel
            </el-button>
            <el-button v-if="!isPendingMode() && !isPendingDeliveryMode()" type="primary" @click="openCreateDialog">创建采购订单</el-button>
          </template>
        </AppFilter>

        <OrderTable
          ref="orderTableRef"
          :table-data="tableData"
          :total="total"
          :query="query"
          action-type="all"
          :hide-status="isPendingMode() || isPendingDeliveryMode()"
          :detail-mode="isPendingMode() || isPendingDeliveryMode()"
          :detail-action="isPendingDeliveryMode() ? 'delivery' : 'confirm'"
          @confirm="handleConfirm"
          @confirm-detail="handleConfirmDetail"
          @generate-delivery="handleGenerateDelivery"
          @batch-delivery="handleBatchDelivery"
          @batch-confirm="handleBatchConfirm"
        />
      </div>
    </div>

    <CreateOrderDialog v-if="!isPendingMode() && !isPendingDeliveryMode()"
      :visible="createDialogVisible"
      :supplier-list="supplierList"
      :material-list="materialList"
      :form-data="createForm"
      @update:visible="createDialogVisible = $event"
      @add-material="addMaterial"
      @remove-material="removeMaterial"
      @submit="submitCreateOrder"
    />

    <!-- 送货数量输入弹窗 -->
    <el-dialog v-model="deliveryQtyVisible" title="生成送货单并发货" width="800px" align-center>
      <div style="margin-bottom: 12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <span style="font-size: 13px; color: #666;">
          送货数量默认等于可发货最大数量，可修改为更小值支持分批送货。
        </span>
        <span style="margin-left:auto; display:flex; align-items:center; gap:6px; font-size:13px; color:#555;">
          <b>预计送达时间：</b>
          <el-date-picker
            v-model="expectedDate"
            type="date"
            placeholder="请选择"
            value-format="YYYY-MM-DD"
            style="width:160px"
            :disabled-date="disabledDate"
          />
        </span>
      </div>
      <el-table :data="deliveryQtyItems" border size="small" style="width: 100%">
        <el-table-column prop="orderCode" label="订单编号" align="center" />
        <el-table-column prop="materialCode" label="物料编码" align="center" />
        <el-table-column prop="materialName" label="物料名称" align="center" />
        <el-table-column prop="spec" label="规格" align="center" />
        <el-table-column prop="unit" label="单位" align="center" />
        <el-table-column label="数量" align="center">
          <template #default="{ row }">
            <span>{{ row.deliveredQty }}/{{ row.qty }}</span>
          </template>
        </el-table-column>
        <el-table-column label="可发数量" align="center">
          <template #default="{ row }">
            <span style="color: #1890ff;">{{ row.availableQty }}</span>
          </template>
        </el-table-column>
        <el-table-column label="送货数量" width="140" align="center" class-name="delivery-qty-col">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="deliveryQtyItems[$index].deliveryQty"
              :min="0"
              size="small"
              style="width: 120px"
              @change="() => {
                const max = row.availableQty
                if (deliveryQtyItems[$index].deliveryQty > max) {
                  ElMessageBox.confirm(`送货数量不能超过可发数量 ${max}，已自动重置`, '超出可发数量', {
                    confirmButtonText: '知道了', type: 'warning', showCancelButton: false
                  })
                  deliveryQtyItems[$index].deliveryQty = max
                }
              }"
            />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="deliveryQtyVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmDeliveryWithQty">确认生成送货单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 60px; background: #fff; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
.content { padding: 20px; flex: 1; overflow-y: auto; }
</style>
<style>
.delivery-qty-col .el-input-number .el-input__inner {
  font-weight: 700 !important;
  font-size: 16px !important;
  color: #e60000 !important;
}
</style>
