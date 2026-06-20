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

import { DEFAULT_SUPPLIERS, initMockOrders, deliverySeq as mockDeliverySeq } from '@/mock'

// ============ 数据状态 ============
const supplierList = ref([...DEFAULT_SUPPLIERS])

const query = reactive({
  orderNo: '',
  supplierId: '',
  status: '',
  pageNum: 1,
  pageSize: 10
})

const mockData = ref([])
const tableData = ref([])
const total = ref(0)

const deliverySeq = mockDeliverySeq

const route = useRoute()

// 判断当前模式：pending（待确认）或 query（查询）
function isPendingMode() {
  return route.path === '/order/pending'
}

// 筛选字段配置（待确认列表不显示状态筛选）
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
    { key: 'orderNo', label: '订单编号', type: 'input', width: 220 },
    { key: 'supplierId', label: '供应商', type: 'select', width: 220, options: supplierList.value, labelKey: 'name', valueKey: 'id' }
  ]
  if (!isPendingMode()) {
    fields.push({ key: 'status', label: '订单状态', type: 'select', width: 180, options: orderStatusOptions })
  }
  return fields
})

// 创建订单弹窗
const createDialogVisible = ref(false)
const createForm = reactive({
  supplierId: '',
  materials: [],
  deliveryDate: '',
  remark: ''
})

// ============ 计算属性 ============
const filteredData = computed(() => {
  let data = [...mockData.value]
  if (query.orderNo) data = data.filter(item => item.orderNo.includes(query.orderNo))
  if (query.supplierId) data = data.filter(item => item.supplierId === query.supplierId)
  if (query.status) data = data.filter(item => item.status === query.status)
  return data
})

// ============ 方法 ============
function loadTable() {
  let data = filteredData.value
  // 待确认列表只显示状态为「待确认」的订单
  if (isPendingMode()) {
    data = data.filter(item => item.status === '0')
  }
  total.value = data.length
  const start = (query.pageNum - 1) * query.pageSize
  tableData.value = data.slice(start, start + query.pageSize)
}

function handleQuery() {
  query.pageNum = 1
  loadTable()
}

function handleReset() {
  query.orderNo = ''
  query.supplierId = ''
  query.status = ''
  query.pageNum = 1
  loadTable()
}

function handleExport() {
  const data = filteredData.value
  if (data.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  const exportList = data.map(item => ({
    '订单编号': item.orderNo,
    '供应商名称': item.supplierName,
    '订单状态': getStatusText(item.status),
    '物料种类': item.materialCount,
    '订单总金额(元)': item.totalAmount,
    '预计交货日期': item.deliveryDate,
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

// ============ 创建订单 ============
function openCreateDialog() {
  createForm.supplierId = ''
  createForm.materials = [{ materialCode: '', materialName: '', quantity: 1, price: 0 }]
  createForm.deliveryDate = ''
  createForm.remark = ''
  createDialogVisible.value = true
}

function addMaterial() {
  createForm.materials.push({ materialCode: '', materialName: '', quantity: 1, price: 0 })
}

function removeMaterial(index) {
  if (createForm.materials.length <= 1) {
    ElMessage.warning('至少保留一行物料信息')
    return
  }
  createForm.materials.splice(index, 1)
}

function submitCreateOrder() {
  if (!createForm.supplierId) {
    ElMessage.warning('请选择供应商')
    return
  }

  const validMaterials = createForm.materials.filter(
    item => item.materialCode.trim() && item.materialName.trim() && item.quantity > 0 && item.price > 0
  )
  if (validMaterials.length === 0) {
    ElMessage.warning('请完善至少一行有效物料信息')
    return
  }

  let totalAmount = 0
  const materials = validMaterials.map((item, index) => {
    const amount = (item.quantity * item.price).toFixed(2)
    totalAmount += Number(amount)
    return {
      index: index + 1,
      materialCode: item.materialCode.trim(),
      materialName: item.materialName.trim(),
      spec: '标准规格',
      quantity: item.quantity,
      price: item.price.toFixed(2),
      amount
    }
  })

  const newId = mockData.value.length + 1
  const supplier = supplierList.value.find(s => s.id === createForm.supplierId)

  const newOrder = {
    id: newId,
    orderNo: generateOrderNo(),
    supplierId: createForm.supplierId,
    supplierName: supplier ? supplier.name : '',
    status: '0',
    materialCount: materials.length,
    totalAmount: totalAmount.toFixed(2),
    deliveryDate: createForm.deliveryDate || '2024-07-30',
    createTime: formatNow(),
    materials,
    remark: createForm.remark || '',
    deliveryNo: ''
  }

  mockData.value.unshift(newOrder)
  loadTable()
  createDialogVisible.value = false
  ElMessage.success('采购订单创建成功，状态为「待确认」')
}

// ============ 订单操作 ============
function handleConfirm(row) {
  ElMessageBox.confirm(
    `确认要将订单 ${row.orderNo} 标记为「已确认」状态吗？确认后将不可撤回。`,
    '订单确认操作',
    { type: 'warning' }
  ).then(() => {
    const targetOrder = mockData.value.find(item => item.id === row.id)
    if (targetOrder) targetOrder.status = '1'
    ElMessage.success('订单确认成功，状态已更新为「已确认」')
    loadTable()
  }).catch(() => {})
}

function handleGenerateDelivery(row) {
  ElMessageBox.confirm(
    `确认要为订单 ${row.orderNo} 生成送货单吗？生成后订单状态将更新为「待发货」。`,
    '生成送货单',
    { type: 'warning', confirmButtonText: '确认生成' }
  ).then(() => {
    const targetOrder = mockData.value.find(item => item.id === row.id)
    if (targetOrder) {
      const newDeliveryNo = generateDeliveryNo(deliverySeq.value)
      deliverySeq.value++
      targetOrder.status = '2'
      targetOrder.deliveryNo = newDeliveryNo
      ElMessage.success(`送货单生成成功，单号：${newDeliveryNo}`)
      loadTable()
    }
  }).catch(() => {})
}

// ============ 生命周期 ============
onMounted(() => {
  mockData.value = initMockOrders(supplierList.value)
  loadTable()
})

watch(
  () => [query.pageNum, query.pageSize],
  () => loadTable()
)

// 切换菜单时重新加载
watch(() => route.path, () => {
  query.pageNum = 1
  loadTable()
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
          :hide-confirm="!isPendingMode()"
          @confirm="handleConfirm"
          @generate-delivery="handleGenerateDelivery"
        />
      </div>
    </div>

    <CreateOrderDialog
      :visible="createDialogVisible"
      :supplier-list="supplierList"
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
