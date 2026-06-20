<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import AppPagination from '@/components/AppPagination.vue'
import Logout from '@/components/Logout.vue'
import { getStatusText, getStatusTag } from '@/utils/orderUtils'
import { DEFAULT_SUPPLIERS, initMockOrders } from '@/mock'

// ==================== 数据 ====================
const supplierList = ref([...DEFAULT_SUPPLIERS])
const allOrders = ref([])
const searchNo = ref('')

const query = reactive({
  pageNum: 1,
  pageSize: 10
})

onMounted(() => {
  allOrders.value = initMockOrders(supplierList.value)
})

// 只显示待发货(2)、已发货(3)、已收货(4)、已完成(5)，按状态排序（待发货在最上面）
const shipOrders = computed(() => {
  const statusOrder = { '2': 0, '3': 1, '4': 2, '5': 3 }
  const filtered = allOrders.value.filter(o => ['2', '3', '4', '5'].includes(o.status))
  return [...filtered].sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99))
})

// 按送货单号/订单号筛选
const filteredOrders = computed(() => {
  let list = shipOrders.value
  const kw = searchNo.value.trim()
  if (kw) {
    list = list.filter(o =>
      o.orderNo.toLowerCase().includes(kw.toLowerCase()) ||
      (o.deliveryNo && o.deliveryNo.toLowerCase().includes(kw.toLowerCase()))
    )
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

// 搜索或清空时重置到第一页
function handleSearch() {
  query.pageNum = 1
}

// ==================== 操作 ====================
function handleShip(row) {
  ElMessageBox.confirm(
    `确认订单「${row.orderNo}」已发货吗？`,
    '发货确认',
    { type: 'warning', confirmButtonText: '确认发货' }
  ).then(() => {
    const target = allOrders.value.find(o => o.id === row.id)
    if (target) {
      target.status = '3'
      allOrders.value = allOrders.value.slice() // 触发视图更新
      ElMessage.success(`订单 ${row.orderNo} 已更新为「已发货」`)
    }
  }).catch(() => {})
}
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>发货管理</h3>
        <Logout />
      </div>

      <div class="content">
        <!-- 扫描/查询输入 -->
        <el-card shadow="never" class="search-card">
          <div class="search-row">
            <el-input
              v-model="searchNo"
              placeholder="扫描或输入送货单号 / 订单号"
              clearable
              size="large"
              @input="handleSearch"
              @keyup.enter="handleSearch"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
              <template #append>
                <el-button @click="handleSearch">查询</el-button>
              </template>
            </el-input>
          </div>
        </el-card>

        <!-- 订单列表 -->
        <el-card shadow="never">
          <div class="table-header">
            <span>发货订单列表</span>
            <span>共 {{ filteredOrders.length }} 条</span>
          </div>

          <el-table :data="tableData" stripe border style="width: 100%">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="detail-content">
                  <div class="detail-info">
                    <div><span>订单编号：</span><b>{{ row.orderNo }}</b></div>
                    <div><span>供应商：</span><b>{{ row.supplierName }}</b></div>
                    <div><span>订单状态：</span><b>{{ getStatusText(row.status) }}</b></div>
                    <div><span>总金额：</span><b class="red-price">¥{{ row.totalAmount }}</b></div>
                    <div><span>交货日期：</span><b>{{ row.deliveryDate }}</b></div>
                    <div><span>创建时间：</span><b>{{ row.createTime }}</b></div>
                    <div v-if="row.deliveryNo">
                      <span>送货单号：</span><b style="color: #1890ff">{{ row.deliveryNo }}</b>
                    </div>
                  </div>
                  <el-table :data="row.materials" size="small" border style="width: 100%">
                    <el-table-column prop="index" label="序号" width="60" align="center" />
                    <el-table-column prop="materialCode" label="物料编码" width="120" align="center" />
                    <el-table-column prop="materialName" label="物料名称" width="180" align="center" />
                    <el-table-column prop="spec" label="规格" width="120" align="center" />
                    <el-table-column prop="quantity" label="采购数量" align="center" />
                    <el-table-column prop="price" label="单价" align="center" />
                    <el-table-column prop="amount" label="金额" align="center" />
                  </el-table>
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="orderNo" label="订单编号" width="160" align="center" />
            <el-table-column prop="supplierName" label="供应商" min-width="160" />
            <el-table-column prop="deliveryNo" label="送货单号" width="180" align="center">
              <template #default="{ row }">
                <span v-if="row.deliveryNo" style="color: #1890ff;">{{ row.deliveryNo }}</span>
                <span v-else style="color: #999;">—</span>
              </template>
            </el-table-column>
            <el-table-column label="订单状态" width="120" align="center">
              <template #default="{ row }">
                <el-tag :type="getStatusTag(row.status)" size="small">
                  {{ getStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="center">
              <template #default="{ row }">
                <el-button
                  type="success"
                  size="small"
                  :disabled="row.status !== '2'"
                  @click="handleShip(row)"
                >
                  确认发货
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <AppPagination :total="filteredOrders.length" :query="query" @change="handlePageChange" />
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

.search-card {
  margin-bottom: 16px;
}
.search-row {
  display: flex;
  gap: 12px;
}
.search-row .el-input {
  flex: 1;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 14px;
}
.table-header span:first-child {
  font-weight: bold;
  color: #333;
}
.table-header span:last-child {
  color: #999;
}

.detail-content {
  padding: 15px;
  background: #fafafa;
}
.detail-info {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 15px;
  font-size: 13px;
}
.detail-info span {
  color: #666;
}
.red-price {
  color: #f56c6c;
  font-weight: 500;
}
</style>
