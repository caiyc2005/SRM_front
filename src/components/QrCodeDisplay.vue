<script setup>
/**
 * QrCodeDisplay.vue
 *
 * 二维码组件 — 使用 qrcode 包生成二维码。
 * 编码内容为送货单号，扫码收料时自动识别。
 */
import { ref, watch, onMounted } from 'vue'
import QRCode from 'qrcode'

const props = defineProps({
  /** 要编码的文本（送货单号） */
  value: { type: String, required: true },
  /** 二维码尺寸（宽高相同） */
  size: { type: Number, default: 120 },
  /** canvas 元素 id（用于下载定位） */
  canvasId: { type: String, default: '' }
})

const canvasRef = ref(null)

function renderQrCode() {
  if (!canvasRef.value || !props.value) return
  try {
    QRCode.toCanvas(canvasRef.value, props.value, {
      width: props.size,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
  } catch (e) {
    console.error('二维码生成失败:', e)
  }
}

/** 获取二维码图片的数据 URL（用于下载） */
function getDataURL() {
  if (!canvasRef.value) return ''
  return canvasRef.value.toDataURL('image/png')
}

defineExpose({ getDataURL })

watch(() => props.value, renderQrCode)
onMounted(renderQrCode)
</script>

<template>
  <canvas ref="canvasRef" :id="canvasId || undefined" :width="size" :height="size" />
</template>
