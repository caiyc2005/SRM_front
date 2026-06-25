<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import BarcodeDisplay from '@/components/BarcodeDisplay.vue'
import QrCodeDisplay from '@/components/QrCodeDisplay.vue'

const props = defineProps({
  visible: { type: Boolean, required: true },
  delivery: { type: Object, required: true }
})

const emit = defineEmits(['update:visible', 'print'])
const exporting = ref(false)

async function handleExport() {
  const el = document.getElementById('printArea')
  if (!el) return

  exporting.value = true
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false
    })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(`送货单_${props.delivery.noteCode || ''}.pdf`)
    ElMessage.success('PDF 已导出')
  } catch {
    ElMessage.error('导出失败')
  }
  exporting.value = false
  emit('update:visible', false)
}
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
          <div>送货单号：{{ delivery.noteCode }}</div>
          <div>供应商：{{ delivery.supplierCode }}-{{ delivery.supplierName }}</div>
          <div>创建时间：{{ delivery.createTime }}</div>
          <div>预计送达：{{ delivery.expectDate }}</div>
        </div>

        <table class="print-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>物料编码</th>
              <th>物料名称</th>
              <th>规格型号</th>
              <th>单位</th>
              <th>送货数量</th>
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

        <!-- 二维码显示 -->
        <div class="print-qrcode">
          <div class="qrcode-box">
            <QrCodeDisplay
              v-if="delivery.noteCode"
              :value="delivery.noteCode"
              :size="120"
            />
            <span v-else>二维码</span>
          </div>
          <div class="qrcode-text">扫码收料</div>
        </div>

        <!-- 条形码（注释保留，方便后续切换）
        <div class="print-barcode">
          <div class="barcode-box">
            <BarcodeDisplay
              v-if="delivery.noteCode"
              :value="delivery.noteCode"
              :width="160"
              :height="50"
            />
            <span v-else>条形码</span>
          </div>
          <div class="barcode-text">扫码收料</div>
        </div>
        -->
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="exporting" @click="handleExport">导出</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.print-wrap {
  padding: 20px;
}
.print-page {
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
  padding: 30px;
  border: 1px solid #ddd;
  background: #fff;
  box-sizing: border-box;
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

/* 二维码区域 */
.print-qrcode {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.qrcode-box {
  padding: 6px 10px;
  background: #fff;
}
.qrcode-text {
  text-align: center;
  font-size: 12px;
  margin-top: 4px;
}
/* 条形码区域（保留，方便后续切换）
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
*/

</style>

<!-- 打印样式（不能用 scoped，否则 @page 不生效） -->
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

@media print {
  @page {
    size: A4;
    margin: 12mm 15mm;
  }

  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* 隐藏 dialog 外壳 */
  .el-dialog__header,
  .el-dialog__footer,
  .el-overlay {
    display: none !important;
  }

  .el-dialog {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }

  .el-dialog__body {
    padding: 0 !important;
  }

  .print-wrap {
    padding: 0 !important;
  }

  .print-page {
    width: 100% !important;
    max-width: none !important;
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
    page-break-after: avoid;
  }

  .print-title {
    text-align: center;
    font-size: 24pt;
    font-weight: 700;
    letter-spacing: 6px;
    margin-bottom: 18pt;
  }

  .print-base {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6pt;
    margin-bottom: 16pt;
    font-size: 11pt;
    line-height: 1.8;
  }

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

  .print-qrcode {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .qrcode-box {
    padding: 4px 8px;
    background: #fff;
  }

  .qrcode-text {
    text-align: center;
    font-size: 9pt;
    margin-top: 2px;
    color: #555;
  }

  /* 条形码（保留，方便后续切换）
  .print-barcode {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .barcode-box {
    padding: 4px 8px;
    background: #fff;
  }

  .barcode-text {
    text-align: center;
    font-size: 9pt;
    margin-top: 2px;
    color: #555;
  }
  */
}
</style>
