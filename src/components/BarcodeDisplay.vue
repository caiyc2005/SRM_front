<script setup>
/**
 * BarcodeDisplay.vue
 *
 * 条形码组件 — 使用 jsbarcode 生成 Code128 条形码。
 * 编码内容为送货单号，收料时扫码自动识别。
 */
import { ref, watch, onMounted } from 'vue'
import JsBarcode from 'jsbarcode'

const props = defineProps({
  /** 要编码的文本（送货单号） */
  value: { type: String, required: true },
  /** 显示宽度 */
  width: { type: Number, default: 160 },
  /** 显示高度 */
  height: { type: Number, default: 50 },
  /** canvas 元素 id（用于下载定位） */
  canvasId: { type: String, default: '' }
})

const canvasRef = ref(null)

function renderBarcode() {
  if (!canvasRef.value || !props.value) return
  try {
    JsBarcode(canvasRef.value, props.value, {
      format: 'CODE128',
      width: 1.2,
      height: 40,
      displayValue: true,
      fontSize: 12,
      margin: 5,
      background: '#fff',
      lineColor: '#000'
    })
  } catch (e) {
    console.error('条形码生成失败:', e)
  }
}

watch(() => props.value, renderBarcode)
onMounted(renderBarcode)
</script>

<template>
  <canvas ref="canvasRef" :id="canvasId || undefined" :width="width" :height="height" />
</template>
