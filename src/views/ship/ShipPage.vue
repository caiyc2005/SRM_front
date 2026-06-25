<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFilter from '@/components/AppFilter.vue'
import AppPagination from '@/components/AppPagination.vue'
import Logout from '@/components/Logout.vue'
import { getStatusText, getStatusTag } from '@/utils/orderUtils'

const API_BASE = '/api/Orders'
const useApi = ref(false)

const shipStatusOptions = [
  { label: '全部', value: '' },
  { label: '未发货', value: 'pending' },
  { label: '已发货', value: 'shipped' }
]

const filterFields = [
  { key: 'shipFilter', label: '发货状态', type: 'select', width: 140, options: shipStatusOptions },
  { key: 'keyword', label: '送货单号/订单号', type: 'input', width: 300, placeholder: '送货单号 / 订单号' }
]

// ==================== 数据 ====================
const allOrders = ref([])
const tableRef = ref(null)

const query = reactive({
  shipFilter: '',
  keyword: '',
  pageNum: 1,
  pageSize: 10
})

async function loadShipOrders() {
  // ========== 优先调后端 API ==========
  try {
    const params = new URLSearchParams()
    params.append('pageIndex', '1')
    params.append('pageSize', '999') // 一次性拉取，客户端筛选

    const token = localStorage.getItem('token')
    let userInfo = { userID: '' }
    try { userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}') } catch {}
    const res = await fetch(`/api/Delivery/GetDeliveryNote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ page: 1, pageSize: 999, userID: userInfo.userID || undefined })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.code === 200 && result.data) {
      allOrders.value = (result.data.items || []).map(item => ({
        orderID: item.orderID,
        noteID: item.noteID || '',
        orderCode: item.orderCode || item.noteCode,
        supplierID: item.supplierID || '',
        supplierName: item.supplierName || '',
        status: String(item.orderStatus ?? (item.status === 2 ? 4 : item.status === 1 ? 3 : 2)),
        materialCount: item.details?.length || 0,
        totalAmount: item.totalAmount
          ? Number(item.totalAmount).toFixed(2)
          : (item.details || []).reduce((s, dd) => s + (dd.amount || (dd.quantity || 0) * (dd.unitPrice || 0) || 0), 0).toFixed(2),
        createTime: item.createdTime ? item.createdTime.replace('T', ' ').slice(0, 16) : '',
        noteCode: item.noteCode || '',
        materials: (item.details || []).map((dd, i) => ({
          index: i + 1,
          materialCode: dd.materialCode || '',
          materialName: dd.materialName || '',
          spec: dd.spec || '',
          unit: dd.unit || '',
          qty: dd.quantity || 0,
          unitPrice: dd.unitPrice || 0,
          amount: dd.amount || 0
        }))
      }))
      useApi.value = true
      return
    }
  } catch { /* 后端不可用 */ }
}

onMounted(() => {
  loadShipOrders()
})

// 只显示待发货(2)、已发货(3)、已收货(4)、已完成(5)，按状态排序（待发货在最上面）
const shipOrders = computed(() => {
  const statusOrder = { '2': 0, '3': 1, '4': 2, '5': 3 }
  const filtered = allOrders.value.filter(o => ['2', '3', '4', '5'].includes(o.status))
  return [...filtered].sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99))
})

// 按关键字 + 发货状态筛选
const filteredOrders = computed(() => {
  let list = shipOrders.value
  const kw = query.keyword.trim()
  if (kw) {
    list = list.filter(o =>
      o.orderCode.toLowerCase().includes(kw.toLowerCase()) ||
      (o.noteCode && o.noteCode.toLowerCase().includes(kw.toLowerCase()))
    )
  }
  if (query.shipFilter === 'pending') {
    list = list.filter(o => o.status === '2')
  } else if (query.shipFilter === 'shipped') {
    list = list.filter(o => ['3', '4', '5'].includes(o.status))
  }
  return list
})

// 分页数据
const tableData = computed(() => {
  const start = (query.pageNum - 1) * query.pageSize
  return filteredOrders.value.slice(start, start + query.pageSize)
})

function handlePageChange() {
  // 分页变化时自动更新 tableData
}

function handleQuery() {
  query.pageNum = 1
}

function handleReset() {
  query.shipFilter = ''
  query.keyword = ''
  query.pageNum = 1
}

function handleRowClick(row) {
  if (tableRef.value) {
    tableRef.value.toggleRowExpansion(row)
  }
}

// ==================== 操作 ====================
const shipDialogVisible = ref(false)
const expectDate = ref('')
const currentShipRow = ref(null)

function handleShip(row) {
  // 根据当前状态给出不同提示
  if (row.status === '3') {
    ElMessage.info('该送货单已发货，无需重复操作')
    return
  }
  if (row.status === '4' || row.status === '5') {
    ElMessage.warning('该送货单已收货，无法再次发货')
    return
  }

  // 弹出对话框，选择预计送达时间
  currentShipRow.value = row
  expectDate.value = ''
  shipDialogVisible.value = true
}

async function confirmShip() {
  if (!currentShipRow.value) return
  const row = currentShipRow.value

  // 关闭弹窗
  shipDialogVisible.value = false

  // ========== 调后端 API ==========
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/Delivery/DeliveryConfirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        noteID: row.noteID,
        noteCode: row.noteCode,
        expectedDate: expectDate.value || undefined
      })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.code === 200) {
      ElMessage.success(`订单 ${row.orderCode} 已确认发货`)
      // 刷新列表
      await loadShipOrders()
      return
    }
    ElMessage.error(result.message || '发货确认失败')
  } catch {
    ElMessage.error('后端接口不可用，发货确认失败')
  }
}

/** 日期选择器：禁止选择今天之前的日期 */
function disabledDate(time) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return time.getTime() < today.getTime()
}
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>供应商发货</h3>
        <Logout />
      </div>

      <div class="content">
        <AppFilter :fields="filterFields" :model="query" @query="handleQuery" @reset="handleReset" />

        <!-- 订单列表 -->
        <el-card shadow="never">
          <div class="table-header">
            <span>发货订单列表</span>
            <span>共 {{ filteredOrders.length }} 条</span>
          </div>

          <el-table ref="tableRef" :data="tableData" stripe border style="width: 100%" @row-click="handleRowClick">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="detail-content">
                  <div class="detail-info">
                    <div><span>订单编号：</span><b>{{ row.orderCode }}</b></div>
                    <div><span>供应商名称：</span><b>{{ row.supplierName }}</b></div>
                    <div><span>订单状态：</span><b>{{ getStatusText(row.status) }}</b></div>
                    <div><span>总金额：</span><b class="red-price">¥{{ row.totalAmount }}</b></div>
                    <div><span>创建时间：</span><b>{{ row.createTime }}</b></div>
                    <div v-if="row.noteCode">
                      <span>送货单号：</span><b style="color: #1890ff">{{ row.noteCode }}</b>
                    </div>
                  </div>
                  <el-table :data="row.materials" size="small" border style="width: 100%">
                    <el-table-column prop="index" label="序号" width="60" align="center" />
                    <el-table-column prop="materialCode" label="物料编码" width="120" align="center" />
                    <el-table-column prop="materialName" label="物料名称" width="180" align="center" />
                    <el-table-column prop="spec" label="规格" width="120" align="center" />
                    <el-table-column prop="qty" label="采购数量" align="center" />
                    <el-table-column prop="unit" label="单位" width="70" align="center" />
                    <el-table-column prop="unitPrice" label="单价" align="center" />
                    <el-table-column prop="amount" label="金额" align="center" />
                  </el-table>
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="noteCode" label="送货单号" width="180" align="center">
              <template #default="{ row }">
                <span v-if="row.noteCode" style="color: #1890ff;">{{ row.noteCode }}</span>
                <span v-else style="color: #999;">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="supplierName" label="供应商名称" min-width="160" />
            
            <el-table-column label="订单状态" width="120" align="center">
              <template #default="{ row }">
                <el-tag :type="getStatusTag(row.status)" size="small">
                  {{ getStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="center">
              <template #default="{ row }">
                <el-tooltip
                  :content="
                    row.status === '3' ? '该送货单已发货，无需重复操作' :
                    ['4','5'].includes(row.status) ? '该送货单已收货，无法再次发货' : ''
                  "
                  :disabled="row.status === '2'"
                  placement="top"
                >
                  <span style="display: inline-block;">
                    <el-button
                      type="success"
                      size="small"
                      :disabled="row.status !== '2'"
                      @click="handleShip(row)"
                    >
                      确认发货
                    </el-button>
                  </span>
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>

          <AppPagination :total="filteredOrders.length" :query="query" @change="handlePageChange" />
        </el-card>
      </div>
    </div>

    <!-- 确认发货弹窗 -->
    <el-dialog
      v-model="shipDialogVisible"
      title="发货确认"
      width="800px"
      align-center
    >
      <div class="ship-dialog-body">
        <div class="ship-dialog-info">
          <div>供应商名称：<b>{{ currentShipRow?.supplierName }}</b></div>
        </div>

        <div class="section-title">物料明细</div>
        <el-table :data="currentShipRow?.materials || []" size="small" border style="width: 100%">
          <el-table-column prop="index" label="序号" width="60" align="center" />
          <el-table-column prop="materialCode" label="物料编码" width="120" align="center" />
          <el-table-column prop="materialName" label="物料名称" min-width="140" />
          <el-table-column prop="spec" label="规格" width="110" align="center" />
          <el-table-column prop="unit" label="单位" width="70" align="center" />
          <el-table-column prop="qty" label="数量" width="80" align="center" />
        </el-table>

        <div class="ship-dialog-date">
          <span>预计送达时间：</span>
          <el-date-picker
            v-model="expectDate"
            type="date"
            placeholder="请选择预计送达日期"
            value-format="YYYY-MM-DD"
            style="width: 200px"
            :disabled-date="disabledDate"
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="shipDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmShip">
          确认发货
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 60px; background: #fff; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
.content { padding: 20px; flex: 1; overflow-y: auto; background: #f0f2f5; }
.table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 14px; }
.table-header span:first-child { font-weight: bold; color: #333; }
.table-header span:last-child { color: #999; }
.detail-content { padding: 15px; background: #fafafa; }
.detail-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; font-size: 13px; }
.detail-info span { color: #666; }
.red-price { color: #f56c6c; font-weight: 500; }

.section-title {
  font-size: 14px; font-weight: 500; margin: 8px 0; color: #333;
}
.ship-dialog-body {
  display: flex; flex-direction: column; gap: 16px; padding: 10px 0;
}
.ship-dialog-info {
  display: flex; flex-direction: column; gap: 8px; font-size: 14px;
}
.ship-dialog-date {
  display: flex; align-items: center; gap: 10px; font-size: 14px;
}
</style>
