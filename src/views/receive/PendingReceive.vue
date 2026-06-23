<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFilter from '@/components/AppFilter.vue'
import AppPagination from '@/components/AppPagination.vue'
import Logout from '@/components/Logout.vue'
import { getStatusText, getStatusTag } from '@/utils/orderUtils'
import { initMockOrders } from '@/mock'

// ==================== 筛选配置 ====================
const filterFields = [
  { key: 'keyword', label: '关键字', type: 'input', width: 300, placeholder: '订单号 / 送货单号' }
]

// ==================== 数据 ====================
const supplierList = ref([])
const allOrders = ref([])

const query = reactive({
  keyword: '',
  pageNum: 1,
  pageSize: 10
})

const tableRef = ref(null)

onMounted(() => {
  allOrders.value = initMockOrders(supplierList.value)
})

// 只显示已发货(status=3)的订单
const pendingReceiveOrders = computed(() => {
  return allOrders.value.filter(o => o.status === '3')
})

// 关键字筛选
const filteredOrders = computed(() => {
  let list = pendingReceiveOrders.value
  const kw = query.keyword.trim()
  if (kw) {
    list = list.filter(o =>
      o.orderCode.toLowerCase().includes(kw.toLowerCase()) ||
      (o.noteCode && o.noteCode.toLowerCase().includes(kw.toLowerCase()))
    )
  }
  return list
})

// 分页
const tableData = computed(() => {
  const start = (query.pageNum - 1) * query.pageSize
  return filteredOrders.value.slice(start, start + query.pageSize)
})

const total = computed(() => filteredOrders.value.length)

function handleQuery() { query.pageNum = 1 }
function handleReset() { query.keyword = ''; query.pageNum = 1 }
function handlePageChange() {}

function handleRowClick(row) {
  if (tableRef.value) {
    tableRef.value.toggleRowExpansion(row)
  }
}

// ==================== 确认收货 ====================
function handleReceive(row) {
  ElMessageBox.confirm(
    `确认订单「${row.orderCode}」的物料已全部收料入库吗？`,
    '收料确认',
    { type: 'warning', confirmButtonText: '确认收料' }
  ).then(() => {
    const target = allOrders.value.find(o => o.orderID === row.orderID)
    if (target) {
      target.status = '4'
      ElMessage.success(`订单 ${row.orderCode} 已更新为「已收货」`)
    }
  }).catch(() => {})
}
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>待收料</h3>
        <Logout />
      </div>

      <div class="content">
        <AppFilter :fields="filterFields" :model="query" @query="handleQuery" @reset="handleReset" />

        <el-card shadow="never">
          <div class="table-header">
            <span>待收料列表</span>
            <span>共 {{ total }} 条</span>
          </div>

          <el-table
            ref="tableRef"
            :data="tableData"
            row-key="orderID"
            stripe
            border
            style="width: 100%"
            @row-click="handleRowClick"
          >
            <!-- 展开详情 -->
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="detail-content">
                  <div class="detail-info">
                    <div><span>订单编号：</span><b>{{ row.orderCode }}</b></div>
                    <div><span>供应商：</span><b>{{ row.supplierName }}</b></div>
                    <div><span>订单状态：</span><b>{{ getStatusText(row.status) }}</b></div>
                    <div><span>总金额：</span><b class="red-price">¥{{ row.totalAmount }}</b></div>
                    <div><span>送货单号：</span><b style="color: #1890ff">{{ row.noteCode || '—' }}</b></div>
                    <div><span>创建时间：</span><b>{{ row.createTime }}</b></div>
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

            <el-table-column prop="orderCode" label="订单编号" width="160" align="center" />
            <el-table-column prop="supplierName" label="供应商" min-width="160" />
            <el-table-column prop="noteCode" label="送货单号" width="180" align="center">
              <template #default="{ row }">
                <span v-if="row.noteCode" style="color: #1890ff;">{{ row.noteCode }}</span>
                <span v-else style="color: #999;">—</span>
              </template>
            </el-table-column>
            <el-table-column label="订单状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="getStatusTag(row.status)" size="small">{{ getStatusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="center">
              <template #default="{ row }">
                <el-button type="success" size="small" @click.stop="handleReceive(row)">确认收料</el-button>
              </template>
            </el-table-column>
          </el-table>

          <AppPagination :total="total" :query="query" @change="handlePageChange" />
        </el-card>
      </div>
    </div>
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
</style>
