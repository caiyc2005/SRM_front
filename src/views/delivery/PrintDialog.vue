<script setup>
import BarcodeDisplay from '@/components/BarcodeDisplay.vue'

// 二维码方案（切换为条形码，保留供后续切换）
// import { ref, watch, nextTick } from 'vue'
// import QRCode from 'qrcode'

const props = defineProps({
  visible: { type: Boolean, required: true },
  delivery: { type: Object, required: true }
})

const emit = defineEmits(['update:visible', 'print'])

// 二维码方案（已切换为条形码，保留供后续切换）
// const qrDataUrl = ref('')
//
// watch(
//   () => [props.visible, props.delivery?.deliveryNo],
//   async ([visible]) => {
//     if (visible && props.delivery?.deliveryNo) {
//       await nextTick()
//       const content = `http://srm/receive?deliveryNo=${props.delivery.deliveryNo}`
//       qrDataUrl.value = await QRCode.toDataURL(content, {
//         width: 80,
//         margin: 1,
//         color: { dark: '#000', light: '#fff' }
//       })
//     }
//   },
//   { immediate: false }
// )
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="打印送货单"
    width="800px"
    :close-on-click-modal="false"
    @update:model-value="val => emit('update:visible', val)"
  >
    <div class="print-wrap">
      <div class="print-page" id="printArea">
        <div class="print-title">送 货 单</div>
        <div class="print-base">
          <div>送货单号：{{ delivery.deliveryNo }}</div>
          <div>对应订单号：{{ delivery.orderNo }}</div>
          <div>供应商编码：{{ delivery.supplierCode }}</div>
          <div>供应商名称：{{ delivery.supplierName }}</div>
          <div>预计送达：{{ delivery.expectDate }}</div>
          <div>创建时间：{{ delivery.createTime }}</div>
        </div>

        <table class="print-table">
          <thead>
            <tr>
              <th width="60">序号</th>
              <th width="120">物料编码</th>
              <th width="180">物料名称</th>
              <th width="120">规格型号</th>
              <th width="70">单位</th>
              <th width="100">送货数量</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in delivery.materials" :key="index">
              <td>{{ index + 1 }}</td>
              <td>{{ item.materialCode }}</td>
              <td>{{ item.materialName }}</td>
              <td>{{ item.spec }}</td>
              <td>{{ item.unit }}</td>
              <td>{{ item.quantity }}</td>
              <td>{{ item.remark || '' }}</td>
            </tr>
          </tbody>
        </table>

        <div class="print-barcode">
          <div class="barcode-box">
            <BarcodeDisplay
              v-if="delivery.deliveryNo"
              :value="delivery.deliveryNo"
              :width="160"
              :height="50"
            />
            <span v-else>条形码</span>
          </div>
          <div class="barcode-text">扫码收料</div>
        </div>

        <!-- 二维码方案（已切换为条形码，保留模板供后续切换） -->
        <!--
        <div class="print-qrcode">
          <div>
            <div class="qrcode-box">
              <img v-if="qrDataUrl" :src="qrDataUrl" alt="二维码" />
              <span v-else>二维码</span>
            </div>
            <div class="qrcode-text">扫码收料</div>
          </div>
        </div>
        -->
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="emit('print')">确认打印</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.print-wrap {
  padding: 20px;
}
.print-page {
  width: 700px;
  margin: 0 auto;
  padding: 30px;
  border: 1px solid #ddd;
  background: #fff;
}
.print-title {
  text-align: center;
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
  letter-spacing: 4px;
}
.print-base {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 20px;
  font-size: 14px;
}
.print-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
}
.print-table th,
.print-table td {
  border: 1px solid #333;
  padding: 8px;
  text-align: center;
  font-size: 14px;
}

/* 条形码区域 */
.print-barcode {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.barcode-box {
  padding: 6px 10px;
  background: #fff;
}
.barcode-text {
  text-align: center;
  font-size: 12px;
  margin-top: 4px;
}

/* 二维码方案（保留样式供后续切换） */
/*
.print-qrcode {
  display: flex;
  justify-content: flex-end;
}
.qrcode-box {
  width: 80px;
  height: 80px;
  border: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.qrcode-box img {
  width: 100%;
  height: 100%;
  display: block;
}
.qrcode-text {
  text-align: center;
  font-size: 12px;
  margin-top: 4px;
}
*/

@media print {
  :deep(.el-dialog__header),
  :deep(.el-dialog__footer) {
    display: none;
  }
}
</style>
