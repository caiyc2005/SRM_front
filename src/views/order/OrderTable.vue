<script setup>
import { ref } from 'vue'
import { getStatusText, getStatusTag } from '@/utils/orderUtils'
import AppPagination from '@/components/AppPagination.vue'

defineProps({
  tableData: { type: Array, required: true },
  total: { type: Number, required: true },
  query: { type: Object, required: true },
  actionType: { type: String, default: 'all' },
  hideConfirm: { type: Boolean, default: false },
  hideStatus: { type: Boolean, default: false }
})

const emit = defineEmits(['pageChange', 'confirm', 'generateDelivery'])

const tableRef = ref(null)

function handleRowClick(row) {
  if (tableRef.value) {
    tableRef.value.toggleRowExpansion(row)
  }
}
</script>

<template>
  <div class="card">
    <div class="table-header">
      <span>订单列表</span>
      <span>共 {{ total }} 条记录</span>
    </div>

    <el-table
      ref="tableRef"
      :data="tableData"
      row-key="orderID"
      border
      style="width: 100%"
      @row-click="handleRowClick"
    >
      <!-- 展开订单详情（保留箭头） -->
      <el-table-column type="expand">
        <template #default="props">
          <div class="detail-content">
            <div class="detail-info">
              <div><span>订单编号：</span><b>{{ props.row.orderCode }}</b></div>
              <div><span>供应商：</span><b>{{ props.row.supplierName }}</b></div>
              <div v-if="!hideStatus"><span>订单状态：</span><b>{{ getStatusText(props.row.status) }}</b></div>
              <div><span>总金额：</span><b class="red-price">¥{{ props.row.totalAmount }}</b></div>
              <div><span>创建时间：</span><b>{{ props.row.createTime }}</b></div>
              <div v-if="props.row.noteCode">
                <span>送货单号：</span><b style="color: #1890ff">{{ props.row.noteCode }}</b>
              </div>
            </div>
            <!-- 物料明细 -->
            <el-table :data="props.row.materials" size="small" border style="width: 100%">
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

      <el-table-column prop="orderCode" label="订单编号" width="160" align="center" resizable="false" />
      <el-table-column prop="supplierName" label="供应商名称" min-width="180" align="center" resizable="false" />

      <el-table-column prop="materialCount" label="物料种类" width="90" align="center" resizable="false" />
      <el-table-column prop="totalAmount" label="总金额(元)" width="130" align="center" class-name="red-price" resizable="false" />
      <el-table-column prop="createTime" label="创建时间" width="160" align="center" resizable="false" />
      <!-- 订单状态 -->
      <el-table-column v-if="!hideStatus" label="订单状态" width="100" align="center" resizable="false">
        <template #default="scope">
          <el-tag :type="getStatusTag(scope.row.status)" size="small">
            {{ getStatusText(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>

      <!-- 操作列 -->
      <el-table-column v-if="actionType !== 'none'" label="操作" width="140" align="center" resizable="false">
        <template #default="scope">
          <template v-if="scope.row.status === '0'">
            <!-- 状态为0：表示未确认的订单 -->
            <el-button v-if="!hideConfirm" type="primary" link size="small"
              @click.stop="emit('confirm', scope.row)">
              确认订单
            </el-button>
          </template>
          <el-button v-else-if="scope.row.status === '1'" type="success" link size="small"
            @click.stop="emit('generateDelivery', scope.row)">
            生成送货单
          </el-button>
          <el-tag v-else type="warning" size="small" class="no-action">已生成送货单</el-tag>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <AppPagination :total="total" :query="query" @change="emit('pageChange')" />
  </div>
</template>

<style scoped>
.card {
  background: #fff;
  border-radius: 4px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
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
.no-action {
  cursor: not-allowed;
}
</style>
