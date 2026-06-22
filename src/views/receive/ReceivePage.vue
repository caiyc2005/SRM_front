<script setup>
/**
 * ReceivePage.vue — 扫码收料
 *
 * 功能：扫码/手动输入送货单号加载送货信息 → 填写实收数量 → 确认收货
 *       Tab2：收料记录查询
 *       Tab3：待收料列表
 */
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFilter from '@/components/AppFilter.vue'
import AppPagination from '@/components/AppPagination.vue'
import Logout from '@/components/Logout.vue'
import { DEFAULT_SUPPLIERS, initMockOrders } from '@/mock'
import { initMockDeliveries } from '@/mock/deliveryData.js'
import { getStatusText, getStatusTag } from '@/utils/orderUtils'

// ==================== Tab 控制 ====================
const activeTab = ref('receive')

// ==================== 数据 ====================
const allDeliveries = ref([])
const receiveRecords = ref([])   // 本地收料记录
const searchNoteCode = ref('')

// ==================== Tab1：收料操作 ====================
const foundDelivery = ref(null)       // 查到的送货单
const notFound = ref(false)           // 是否查无此单
const receiveFormItems = ref([])      // 可编辑的物料行 [{...deliveryItem, receivedQty: 0}]

/** 按送货单号查找 */
function handleSearch() {
  const kw = searchNoteCode.value.trim()
  if (!kw) {
    foundDelivery.value = null
    notFound.value = false
    return
  }

  const result = allDeliveries.value.find(
    d => d.deliveryNo.toLowerCase() === kw.toLowerCase()
  )

  if (!result) {
    foundDelivery.value = null
    notFound.value = true
    receiveFormItems.value = []
    return
  }

  if (result.status === '1') {
    ElMessage.warning('该送货单已收货，不可重复收料')
    foundDelivery.value = null
    notFound.value = false
    return
  }

  notFound.value = false
  foundDelivery.value = result

  // 初始化可编辑收货数量（默认=送货数量）
  receiveFormItems.value = result.materials.map(m => ({
    ...m,
    receivedQty: m.quantity
  }))
}

/** 确认收货 */
function handleConfirmReceive() {
  if (!foundDelivery.value) return

  const delivery = foundDelivery.value
  const items = receiveFormItems.value

  // 基本校验
  for (const item of items) {
    if (item.receivedQty == null || item.receivedQty === '') {
      ElMessage.warning(`物料「${item.materialName}」的实收数量不能为空`)
      return
    }
    if (Number(item.receivedQty) < 0) {
      ElMessage.warning(`物料「${item.materialName}」的实收数量不能为负数`)
      return
    }
    if (Number(item.receivedQty) > item.quantity) {
      ElMessage.warning(`物料「${item.materialName}」的实收数量不能超过送货数量(${item.quantity})`)
      return
    }
  }

  const totalPlan = items.reduce((s, i) => s + i.quantity, 0)
  const totalReceived = items.reduce((s, i) => s + Number(i.receivedQty), 0)

  ElMessageBox.confirm(
    `确认收货？\n计划总数：${totalPlan}，实收总数：${totalReceived}` +
    (totalPlan !== totalReceived ? `\n差异：${totalPlan - totalReceived}` : ''),
    '确认收料',
    { type: 'warning', confirmButtonText: '确认收货' }
  ).then(() => {
    // 更新送货单状态
    delivery.status = '1'
    delivery.receiveTime = new Date().toLocaleString('zh-CN')
    delivery.operator = '仓管员'

    // 记录收料单
    const record = {
      recordId: 'REC' + String(receiveRecords.value.length + 1).padStart(3, '0'),
      recordCode: 'REC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' +
        String(receiveRecords.value.length + 1).padStart(3, '0'),
      noteCode: delivery.deliveryNo,
      orderNo: delivery.orderNo,
      supplierName: delivery.supplierName || '—',
      operator: '仓管员',
      receiveDate: new Date().toLocaleString('zh-CN'),
      items: items.map(i => ({
        materialCode: i.materialCode,
        materialName: i.materialName,
        spec: i.spec,
        unit: i.unit,
        planQty: i.quantity,
        receivedQty: Number(i.receivedQty),
        diffQty: i.quantity - Number(i.receivedQty)
      })),
      totalPlanQty: totalPlan,
      totalReceivedQty: totalReceived,
      totalDiffQty: totalPlan - totalReceived
    }
    receiveRecords.value.unshift(record)

    // 重置
    foundDelivery.value = null
    receiveFormItems.value = []
    searchNoteCode.value = ''

    ElMessage.success('收货确认成功！库存已自动更新。')
  }).catch(() => {})
}

/** 清空搜索 */
function handleClearSearch() {
  searchNoteCode.value = ''
  foundDelivery.value = null
  notFound.value = false
  receiveFormItems.value = []
}

// ==================== Tab2：收料记录 ====================
const historyQuery = reactive({
  pageNum: 1,
  pageSize: 10
})

const historyTableData = computed(() => {
  const start = (historyQuery.pageNum - 1) * historyQuery.pageSize
  return receiveRecords.value.slice(start, start + historyQuery.pageSize)
})

function handleHistoryPageChange() {
  // AppPagination 自动更新
}

// ==================== Tab3：待收料 ====================
const supplierList = ref([...DEFAULT_SUPPLIERS])
const allOrders = ref([])
const tableRef = ref(null)

const pendingQuery = reactive({
  keyword: '',
  pageNum: 1,
  pageSize: 10
})

const pendingFilterFields = [
  { key: 'keyword', label: '关键字', type: 'input', width: 300, placeholder: '订单号 / 送货单号' }
]

// 只显示已发货(status=3)的订单
const pendingReceiveOrders = computed(() => {
  return allOrders.value.filter(o => o.status === '3')
})

const filteredOrders = computed(() => {
  let list = pendingReceiveOrders.value
  const kw = pendingQuery.keyword.trim()
  if (kw) {
    list = list.filter(o =>
      o.orderCode.toLowerCase().includes(kw.toLowerCase()) ||
      (o.deliveryNo && o.deliveryNo.toLowerCase().includes(kw.toLowerCase()))
    )
  }
  return list
})

const pendingTableData = computed(() => {
  const start = (pendingQuery.pageNum - 1) * pendingQuery.pageSize
  return filteredOrders.value.slice(start, start + pendingQuery.pageSize)
})

const pendingTotal = computed(() => filteredOrders.value.length)

function handlePendingQuery() { pendingQuery.pageNum = 1 }
function handlePendingReset() { pendingQuery.keyword = ''; pendingQuery.pageNum = 1 }
function handlePendingPageChange() {}

function handleRowClick(row) {
  if (tableRef.value) {
    tableRef.value.toggleRowExpansion(row)
  }
}

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

// ==================== 生命周期 ====================
onMounted(() => {
  // 初始化送货单数据
  const deliveries = initMockDeliveries()
  allDeliveries.value = deliveries.map((d, i) => {
    const si = i % DEFAULT_SUPPLIERS.length
    const supplier = DEFAULT_SUPPLIERS[si]
    return {
      ...d,
      supplierName: supplier?.supplierName || d.supplierName || '—',
      supplierCode: supplier?.supplierCode || d.supplierCode || '—'
    }
  })
  // 初始化订单数据（用于待收料）
  allOrders.value = initMockOrders(supplierList.value)
})
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>收料入库</h3>
        <Logout />
      </div>

      <div class="content">
        <el-card shadow="never">
          <el-tabs v-model="activeTab">
            <!-- ==================== Tab1：收料操作 ==================== -->
            <el-tab-pane label="收料操作" name="receive">
              <!-- 搜索栏 -->
              <div class="search-card">
                <div class="search-row">
                  <el-input
                    v-model="searchNoteCode"
                    placeholder="扫描二维码或手动输入送货单号"
                    clearable
                    size="large"
                    @clear="handleClearSearch"
                    @keyup.enter="handleSearch"
                  >
                    <template #prefix>
                      <el-icon><Search /></el-icon>
                    </template>
                    <template #append>
                      <el-button type="primary" @click="handleSearch">
                        <el-icon><Search /></el-icon>
                        查询
                      </el-button>
                    </template>
                  </el-input>
                </div>
                <div class="search-hint">
                  <el-icon><InfoFilled /></el-icon>
                  扫描送货单条形码，或手动输入送货单号进行查询
                </div>
              </div>

              <!-- 未找到 -->
              <el-empty v-if="notFound" description="未找到该送货单，请检查单号是否正确" />

              <!-- 送货单详情 + 收料表单 -->
              <div v-if="foundDelivery" class="receive-detail">
                <el-descriptions :column="3" border size="small" title="送货单信息">
                  <el-descriptions-item label="送货单号">
                    <b style="color: #1890ff">{{ foundDelivery.deliveryNo }}</b>
                  </el-descriptions-item>
                  <el-descriptions-item label="对应订单号">
                    {{ foundDelivery.orderNo }}
                  </el-descriptions-item>
                  <el-descriptions-item label="供应商">
                    {{ foundDelivery.supplierName }}
                  </el-descriptions-item>
                  <el-descriptions-item label="供应商编码">
                    {{ foundDelivery.supplierCode }}
                  </el-descriptions-item>
                  <el-descriptions-item label="预计送达">
                    {{ foundDelivery.expectDate }}
                  </el-descriptions-item>
                  <el-descriptions-item label="创建时间">
                    {{ foundDelivery.createTime }}
                  </el-descriptions-item>
                </el-descriptions>

                <div class="section-title">物料明细 — 请核对实物并填写实际收货数量</div>

                <el-table :data="receiveFormItems" stripe border style="width: 100%">
                  <el-table-column type="index" label="序号" width="60" align="center" />
                  <el-table-column prop="materialCode" label="物料编码" width="130" align="center" />
                  <el-table-column prop="materialName" label="物料名称" min-width="140" />
                  <el-table-column prop="spec" label="规格" width="110" align="center" />
                  <el-table-column prop="unit" label="单位" width="70" align="center" />
                  <el-table-column label="送货数量" width="110" align="center">
                    <template #default="{ row }">
                      <b>{{ row.quantity }}</b>
                    </template>
                  </el-table-column>
                  <el-table-column label="实收数量" width="160" align="center">
                    <template #default="{ row, $index }">
                      <el-input-number
                        v-model="receiveFormItems[$index].receivedQty"
                        :min="0"
                        :max="row.quantity"
                        size="small"
                        style="width: 130px"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column label="差异" width="80" align="center">
                    <template #default="{ row }">
                      <el-tag
                        :type="row.quantity - row.receivedQty === 0 ? 'success' : 'warning'"
                        size="small"
                      >
                        {{ row.quantity - row.receivedQty }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="remark" label="备注" min-width="100" />
                </el-table>

                <div class="confirm-bar">
                  <span class="confirm-summary">
                    计划总数：<b>{{ receiveFormItems.reduce((s, i) => s + i.quantity, 0) }}</b>
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    实收总数：<b style="color: #1890ff">{{
                      receiveFormItems.reduce((s, i) => s + Number(i.receivedQty || 0), 0)
                    }}</b>
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    差异：<b :style="{ color: receiveFormItems.reduce((s, i) => s + i.quantity, 0) -
                      receiveFormItems.reduce((s, i) => s + Number(i.receivedQty || 0), 0) === 0
                      ? '#67c23a' : '#e6a23c' }">{{
                      receiveFormItems.reduce((s, i) => s + i.quantity, 0) -
                      receiveFormItems.reduce((s, i) => s + Number(i.receivedQty || 0), 0)
                    }}</b>
                  </span>
                  <el-button type="primary" size="large" @click="handleConfirmReceive">
                    <el-icon><Check /></el-icon>
                    确认收货
                  </el-button>
                </div>
              </div>

              <el-empty
                v-if="!foundDelivery && !notFound"
                description="请扫描送货单条形码或输入送货单号查询"
              />
            </el-tab-pane>

            <!-- ==================== Tab2：收料记录 ==================== -->
            <el-tab-pane label="收料记录" name="history">
              <div class="table-header">
                <span>收料记录列表</span>
                <span>共 {{ receiveRecords.length }} 条</span>
              </div>

              <el-empty
                v-if="receiveRecords.length === 0"
                description="暂无收料记录"
              />

              <template v-else>
                <el-table :data="historyTableData" stripe border style="width: 100%">
                  <el-table-column type="expand">
                    <template #default="{ row }">
                      <div class="detail-content">
                        <div class="detail-title">收料明细</div>
                        <el-table :data="row.items" size="small" border style="width: 100%">
                          <el-table-column type="index" label="序号" width="60" align="center" />
                          <el-table-column prop="materialCode" label="物料编码" width="120" align="center" />
                          <el-table-column prop="materialName" label="物料名称" min-width="140" />
                          <el-table-column prop="spec" label="规格" width="110" align="center" />
                          <el-table-column prop="unit" label="单位" width="70" align="center" />
                          <el-table-column prop="planQty" label="计划数量" width="100" align="center" />
                          <el-table-column prop="receivedQty" label="实收数量" width="100" align="center" />
                          <el-table-column label="差异" width="80" align="center">
                            <template #default="{ row: r }">
                              <el-tag
                                :type="r.diffQty === 0 ? 'success' : 'warning'"
                                size="small"
                              >
                                {{ r.diffQty }}
                              </el-tag>
                            </template>
                          </el-table-column>
                        </el-table>
                      </div>
                    </template>
                  </el-table-column>

                  <el-table-column prop="recordCode" label="收料单号" width="180" align="center" />
                  <el-table-column prop="noteCode" label="送货单号" width="180" align="center" />
                  <el-table-column prop="orderNo" label="对应订单号" width="160" align="center" />
                  <el-table-column prop="supplierName" label="供应商" min-width="160" />
                  <el-table-column prop="totalPlanQty" label="计划总数" width="100" align="center" />
                  <el-table-column prop="totalReceivedQty" label="实收总数" width="100" align="center" />
                  <el-table-column label="差异" width="80" align="center">
                    <template #default="{ row }">
                      <el-tag
                        :type="row.totalDiffQty === 0 ? 'success' : 'warning'"
                        size="small"
                      >
                        {{ row.totalDiffQty }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="operator" label="操作员" width="100" align="center" />
                  <el-table-column prop="receiveDate" label="收料时间" width="170" align="center" />
                </el-table>

                <AppPagination
                  :total="receiveRecords.length"
                  :query="historyQuery"
                  @change="handleHistoryPageChange"
                />
              </template>
            </el-tab-pane>

            <!-- ==================== Tab3：待收料 ==================== -->
            <el-tab-pane label="待收料" name="pending">
              <AppFilter :fields="pendingFilterFields" :model="pendingQuery" @query="handlePendingQuery" @reset="handlePendingReset" />

              <div class="table-header">
                <span>待收料列表</span>
                <span>共 {{ pendingTotal }} 条</span>
              </div>

              <el-table
                ref="tableRef"
                :data="pendingTableData"
                row-key="orderID"
                stripe
                border
                style="width: 100%"
                @row-click="handleRowClick"
              >
                <el-table-column type="expand">
                  <template #default="{ row }">
                    <div class="detail-content">
                      <div class="detail-info">
                        <div><span>订单编号：</span><b>{{ row.orderCode }}</b></div>
                        <div><span>供应商：</span><b>{{ row.supplierName }}</b></div>
                        <div><span>订单状态：</span><b>{{ getStatusText(row.status) }}</b></div>
                        <div><span>总金额：</span><b class="red-price">¥{{ row.totalAmount }}</b></div>
                        <div><span>送货单号：</span><b style="color: #1890ff">{{ row.deliveryNo || '—' }}</b></div>
                        <div><span>交货日期：</span><b>{{ row.deliveryDate }}</b></div>
                        <div><span>创建时间：</span><b>{{ row.createTime }}</b></div>
                      </div>
                      <el-table :data="row.materials" size="small" border style="width: 100%">
                        <el-table-column prop="index" label="序号" width="60" align="center" />
                        <el-table-column prop="materialCode" label="物料编码" width="120" align="center" />
                        <el-table-column prop="materialName" label="物料名称" width="180" align="center" />
                        <el-table-column prop="spec" label="规格" width="120" align="center" />
                        <el-table-column prop="qty" label="采购数量" align="center" />
                        <el-table-column prop="unitPrice" label="单价" align="center" />
                        <el-table-column prop="amount" label="金额" align="center" />
                      </el-table>
                    </div>
                  </template>
                </el-table-column>

                <el-table-column prop="orderCode" label="订单编号" width="160" align="center" />
                <el-table-column prop="supplierName" label="供应商" min-width="160" />
                <el-table-column prop="deliveryNo" label="送货单号" width="180" align="center">
                  <template #default="{ row }">
                    <span v-if="row.deliveryNo" style="color: #1890ff;">{{ row.deliveryNo }}</span>
                    <span v-else style="color: #999;">—</span>
                  </template>
                </el-table-column>
                <el-table-column label="订单状态" width="100" align="center">
                  <template #default="{ row }">
                    <el-tag :type="getStatusTag(row.status)" size="small">{{ getStatusText(row.status) }}</el-tag>
                  </template>
                </el-table-column>
                <!-- <el-table-column label="操作" width="120" align="center">
                  <template #default="{ row }">
                    <el-button type="success" size="small" @click.stop="handleReceive(row)">确认收料</el-button>
                  </template>
                </el-table-column> -->
              </el-table>

              <AppPagination :total="pendingTotal" :query="pendingQuery" @change="handlePendingPageChange" />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header {
  height: 60px; background: #fff; padding: 0 20px;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid #eee;
}
.content {
  padding: 20px; flex: 1; overflow-y: auto; background: #f0f2f5;
}

/* 搜索区域 */
.search-card {
  margin-bottom: 20px;
}
.search-row {
  display: flex; gap: 12px;
}
.search-row .el-input { flex: 1; }
.search-hint {
  margin-top: 10px; font-size: 13px; color: #909399;
  display: flex; align-items: center; gap: 6px;
}

/* 送货单详情 */
.receive-detail {
  margin-top: 16px;
}
.section-title {
  font-size: 15px; font-weight: 600; color: #333;
  margin: 20px 0 12px 0;
  padding-left: 8px; border-left: 3px solid #1890ff;
}

/* 确认栏 */
.confirm-bar {
  margin-top: 20px;
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px;
  background: #f6f8fa; border-radius: 6px;
}
.confirm-summary {
  font-size: 15px;
}
.confirm-summary b {
  font-size: 16px;
}

/* 表格通用 */
.table-header {
  display: flex; justify-content: space-between; align-items: center;
  margin: 16px 0; font-size: 14px;
}
.table-header span:first-child { font-weight: bold; color: #333; }
.table-header span:last-child { color: #999; }

.detail-content {
  padding: 15px; background: #fafafa;
}
.detail-title {
  font-size: 14px; font-weight: 500; margin-bottom: 10px; color: #333;
}
.detail-info {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 15px;
  font-size: 13px;
}
.detail-info span { color: #666; }
.red-price { color: #f56c6c; font-weight: 500; }
</style>
