<script setup>
import { ref, onMounted } from 'vue'
import BarcodeDisplay from '@/components/BarcodeDisplay.vue'

const delivery = ref(JSON.parse(sessionStorage.getItem('printDelivery') || '{}'))

onMounted(() => {
  setTimeout(() => window.print(), 500)
})
</script>

<template>
  <div class="print-page" v-if="delivery.noteCode">
    <div class="print-title">送 货 单</div>

    <div class="print-base">
      <div><span class="label">送货单号：</span><b>{{ delivery.noteCode }}</b></div>
      <div><span class="label">对应订单号：</span><b>{{ delivery.orderCode }}</b></div>
      <div><span class="label">供应商编码：</span><b>{{ delivery.supplierCode }}</b></div>
      <div><span class="label">供应商名称：</span><b>{{ delivery.supplierName }}</b></div>
      <div><span class="label">预计送达：</span><b>{{ delivery.expectDate }}</b></div>
      <div><span class="label">创建时间：</span><b>{{ delivery.createTime }}</b></div>
    </div>

    <table class="print-table">
      <thead>
        <tr>
          <th width="40">序号</th>
          <th width="90">物料编码</th>
          <th>物料名称</th>
          <th width="100">规格型号</th>
          <th width="50">单位</th>
          <th width="70">送货数量</th>
          <th width="100">备注</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, index) in delivery.materials" :key="index">
          <td>{{ index + 1 }}</td>
          <td>{{ item.materialCode }}</td>
          <td style="text-align: left; padding-left: 8px;">{{ item.materialName }}</td>
          <td>{{ item.spec }}</td>
          <td>{{ item.unit }}</td>
          <td>{{ item.quantity }}</td>
          <td>{{ item.remark || '' }}</td>
        </tr>
      </tbody>
    </table>

    <div class="print-footer">
      <div class="barcode-section">
        <BarcodeDisplay
          v-if="delivery.noteCode"
          :value="delivery.noteCode"
          :width="140"
          :height="40"
        />
        <div class="barcode-text">扫码收料</div>
      </div>
      <div class="sign-section">
        <div class="sign-line">送货人签字：______________</div>
        <div class="sign-line">收货人签字：______________</div>
      </div>
    </div>
  </div>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

.print-page {
  width: 100%;
  padding: 15mm 20mm;
  font-family: 'SimSun', '宋体', serif;
}

.print-title {
  text-align: center;
  font-size: 28pt;
  font-weight: 700;
  letter-spacing: 8px;
  margin-bottom: 20pt;
}

.print-base {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6pt;
  margin-bottom: 16pt;
  font-size: 11pt;
  line-height: 1.8;
}

.label { color: #555; }

.print-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16pt;
}

.print-table th,
.print-table td {
  border: 1px solid #000;
  padding: 5pt 3pt;
  text-align: center;
  font-size: 10pt;
}

.print-table th {
  background: #f0f0f0;
  font-weight: 600;
}

.print-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.barcode-section {
  text-align: center;
}

.barcode-text {
  font-size: 9pt;
  color: #555;
  margin-top: 4px;
}

.sign-section {
  text-align: right;
  font-size: 11pt;
  line-height: 2.5;
}

.sign-line {
  white-space: nowrap;
}

@page {
  size: A4;
  margin: 0;
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
