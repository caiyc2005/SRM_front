<script setup>
defineProps({
  tableData: { type: Array, required: true },
  total: { type: Number, required: true },
  query: { type: Object, required: true }
})

import { ref } from 'vue'
import AppPagination from '@/components/AppPagination.vue'
import BarcodeDisplay from '@/components/BarcodeDisplay.vue'
import QrCodeDisplay from '@/components/QrCodeDisplay.vue'

const emit = defineEmits(['pageChange', 'print', 'delete'])

function getStatusText(status) {
  return status === '1' ? '已收货' : '未收货'
}

/** 下载条形码为 PNG 图片 */
function downloadBarcode(noteCode) {
  const canvas = document.querySelector(`#barcode-canvas-${noteCode}`)
  if (!canvas) return
  const link = document.createElement('a')
  link.download = `条形码_${noteCode}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

// ============ 条形码（默认） / 二维码（可切换） ============
// const barcodeDialogVisible = ref(false)
// const currentBarcodeRow = ref(null)

// function showBarcodeDialog(row) {
//   currentBarcodeRow.value = row
//   barcodeDialogVisible.value = true
// }

// /** 下载条形码为 PNG 图片 */
// function downloadBarcodeFromTable(noteCode) {
//   const canvas = document.querySelector(`#table-barcode-${noteCode}`)
//   if (!canvas) return
//   const link = document.createElement('a')
//   link.download = `条形码_${noteCode}.png`
//   link.href = canvas.toDataURL('image/png')
//   link.click()
// }

// ============ 二维码（备用，取消注释下方代码以切换） ============
const qrDialogVisible = ref(false)
const currentQrRow = ref(null)
const qrDisplayRef = ref(null)

function showQrDialog(row) {
  currentQrRow.value = row
  qrDialogVisible.value = true
}

/** 下载二维码为 PNG 图片 */
function downloadQrCode() {
  if (!qrDisplayRef.value) return
  const dataUrl = qrDisplayRef.value.getDataURL()
  if (!dataUrl) return
  const link = document.createElement('a')
  link.download = `二维码_${currentQrRow.value?.noteCode || 'qr'}.png`
  link.href = dataUrl
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
              <div><span>送货单号：</span><b>{{ props.row.noteCode }}</b></div>
              <div><span>对应订单号：</span><b>{{ props.row.orderCode }}</b></div>
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

          </div>
        </template>
      </el-table-column>

      <el-table-column prop="noteCode" label="送货单号" width="180" align="center" resizable="false" />
      
      
      
      <!-- 默认显示条形码；如需切换为二维码，取消下方 QR 块的注释并注释掉上一行的 barcode 块 -->
      <!-- <el-table-column label="条形码" width="120" align="center" resizable="false">
        <template #default="scope">
          <BarcodeDisplay
            :value="scope.row.noteCode"
            :canvas-id="`table-barcode-${scope.row.noteCode}`"
            :width="100"
            :height="26"
            style="cursor: pointer; display: inline-block;"
            @click.stop="showBarcodeDialog(scope.row)"
          />
        </template>
      </el-table-column> -->


      <!-- QR 二维码（备用）-->
      <el-table-column label="二维码" width="80" align="center" resizable="false">
        <template #default="scope">
          <QrCodeDisplay
            :value="scope.row.noteCode"
            :size="44"
            :canvas-id="`qr-${scope.row.noteCode}`"
            style="cursor: pointer; display: inline-block;"
            @click.stop="showQrDialog(scope.row)"
          />
        </template>
      </el-table-column>
      


      <el-table-column prop="orderCode" label="对应订单号" width="180" align="center" resizable="false" />
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

    <!-- 条形码放大弹窗（默认）；如需切换为二维码，取消下方 QR dialog 注释并注释掉本块 -->
    <!-- <el-dialog
      v-model="barcodeDialogVisible"
      title="条形码"
      width="400px"
      align-center
      :close-on-click-modal="true"
    >
   
      <div class="barcode-dialog-body" v-if="currentBarcodeRow">
        <div class="barcode-dialog-img">
          <BarcodeDisplay
            :value="currentBarcodeRow.noteCode"
            :width="320"
            :height="80"
          />
        </div>
        <div class="barcode-dialog-info">
          <div>送货单号：{{ currentBarcodeRow.noteCode }}</div>
          <el-button type="primary" @click="downloadBarcodeFromTable(currentBarcodeRow.noteCode)">
            <el-icon><Download /></el-icon>
            下载条形码
          </el-button>
        </div>
      </div>
    </el-dialog> -->


    <!-- QR 二维码弹窗（备用）-->
    <el-dialog
      v-model="qrDialogVisible"
      title="二维码"
      width="360px"
      align-center
      :close-on-click-modal="true"
    >
      <div class="qr-dialog-body" v-if="currentQrRow">
        <div class="qr-dialog-code">
          <QrCodeDisplay
            ref="qrDisplayRef"
            :value="currentQrRow.noteCode"
            :size="200"
          />
        </div>
        <div class="qr-dialog-info">
          <div>送货单号：{{ currentQrRow.noteCode }}</div>
          <el-button type="primary" @click="downloadQrCode">
            <el-icon><Download /></el-icon>
            下载二维码
          </el-button>
        </div>
      </div>
    </el-dialog>
    
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

.barcode-dialog-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
}

.barcode-dialog-img {
  padding: 12px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
}

.barcode-dialog-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #333;
}

/* QR 二维码弹窗样式（备用） */
.qr-dialog-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
}

.qr-dialog-code {
  padding: 12px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
}

.qr-dialog-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #333;
}
</style>
