<script setup>
/**
 * ReceivePage.vue — 扫码收料
 *
 * 功能：扫码/手动输入送货单号加载送货信息 → 填写实收数量 → 确认收货
 *       Tab2：收料记录查询
 * 数据源：initMockDeliveries（送货单）、本地收料记录
 */
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import AppPagination from '@/components/AppPagination.vue'
import Logout from '@/components/Logout.vue'
import { DEFAULT_SUPPLIERS } from '@/mock'
import { initMockDeliveries } from '@/mock/deliveryData.js'

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

// ==================== 生命周期 ====================
onMounted(() => {
  // 初始化送货单数据，并补充供应商信息
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
})
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>扫码收料</h3>
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
                  扫描送货单条形码，或手动输入送货单号（如 S20240601001）进行查询
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

              <!-- 初始状态提示 -->
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

/* 收料记录 */
.table-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px; font-size: 14px;
}
.table-header span:first-child { font-weight: bold; color: #333; }
.table-header span:last-child { color: #999; }

.detail-content {
  padding: 15px; background: #fafafa;
}
.detail-title {
  font-size: 14px; font-weight: 500; margin-bottom: 10px; color: #333;
}
</style>
