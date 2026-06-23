<script setup>
defineProps({
  tableData: { type: Array, required: true },
  total: { type: Number, required: true },
  query: { type: Object, required: true }
})

import { ref } from 'vue'
import AppPagination from '@/components/AppPagination.vue'
import BarcodeDisplay from '@/components/BarcodeDisplay.vue'

const emit = defineEmits(['pageChange', 'print', 'delete'])

function getStatusText(status) {
  return status === '1' ? '已收货' : '未收货'
}

/** 下载条形码为 PNG 图片 */
function downloadBarcode(deliveryNo) {
  const canvas = document.querySelector(`#barcode-canvas-${deliveryNo}`)
  if (!canvas) return
  const link = document.createElement('a')
  link.download = `条形码_${deliveryNo}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
</script>

<template>
  <div class="card">
    <div class="table-header">
      <span>送货单列表</span>
      <span>共 {{ total }} 条记录</span>
    </div>

    <el-table :data="tableData" row-key="id" border style="width: 100%">
      <!-- 展开详情 -->
      <el-table-column type="expand">
        <template #default="props">
          <div class="detail-content">
            <div class="detail-title">送货单基础信息</div>
            <div class="detail-info">
              <div><span>送货单号：</span><b>{{ props.row.deliveryNo }}</b></div>
              <div><span>对应订单号：</span><b>{{ props.row.orderNo }}</b></div>
              <div><span>供应商：</span><b>{{ props.row.supplierName }}</b></div>
              <div><span>收货状态：</span><b>{{ getStatusText(props.row.status) }}</b></div>
              <div><span>创建时间：</span><b>{{ props.row.createTime }}</b></div>
              <div><span>预计送达：</span><b>{{ props.row.expectDate }}</b></div>
              <div><span>收货时间：</span><b>{{ props.row.receiveTime || '-' }}</b></div>
              <div><span>操作员：</span><b>{{ props.row.operator || '-' }}</b></div>
            </div>

            <div class="detail-title">物料明细</div>
            <el-table :data="props.row.materials" size="small" border style="width: 100%">
              <el-table-column prop="index" label="序号" width="60" align="center" />
              <el-table-column prop="materialCode" label="物料编码" width="120" align="center" />
              <el-table-column prop="materialName" label="物料名称" width="180" align="center" />
              <el-table-column prop="spec" label="规格型号" width="120" align="center" />
              <el-table-column prop="unit" label="单位" width="70" align="center" />
              <el-table-column prop="quantity" label="送货数量" width="100" align="center" />
              <el-table-column prop="remark" label="备注" min-width="120" align="center" />
            </el-table>

            <!-- <div class="detail-title" style="margin-top: 15px;">送货单条码</div>
            <div class="barcode-row">
              <div class="barcode-img">
                <BarcodeDisplay :value="props.row.deliveryNo" :canvas-id="`barcode-canvas-${props.row.deliveryNo}`"
                  :width="200" :height="60" />
              </div>
              <div class="barcode-actions">
                <el-button type="primary" size="small" @click="downloadBarcode(props.row.deliveryNo)">
                  <el-icon>
                    <Download />
                  </el-icon>
                  下载条码
                </el-button>
                <span class="barcode-hint">扫码收料时扫描此条码</span>
              </div>
            </div> -->
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="deliveryNo" label="送货单号" width="180" align="center" resizable="false" />
      <el-table-column prop="orderNo" label="对应订单号" width="180" align="center" resizable="false" />
      <el-table-column prop="supplierName" label="供应商名称" min-width="200" align="center" resizable="false" />
      <el-table-column label="收货状态" width="100" align="center" resizable="false">
        <template #default="scope">
          <el-tag :type="scope.row.status === '0' ? 'warning' : 'success'" size="small">
            {{ getStatusText(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="materialCount" label="物料种类" width="90" align="center" resizable="false" />
      <el-table-column prop="expectDate" label="预计送达" width="120" align="center" resizable="false" />
      <el-table-column prop="createTime" label="创建时间" width="160" align="center" resizable="false" />

      <!-- 操作列 -->
      <el-table-column label="操作" width="180" align="center" resizable="false">
        <template #default="scope">
          <el-button type="primary" link size="small" @click="emit('print', scope.row)">
            打印
          </el-button>
          <el-button type="danger" link size="small" :disabled="scope.row.status === '1'"
            @click="emit('delete', scope.row)">
            删除
          </el-button>
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

.detail-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 10px;
  color: #333;
}

.barcode-row {
  display: flex;
  align-items: center;
  gap: 20px;
}

.barcode-img {
  padding: 8px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.barcode-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.barcode-hint {
  font-size: 12px;
  color: #909399;
}
</style>
