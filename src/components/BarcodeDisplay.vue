<script setup>
/**
 * BarcodeDisplay.vue
 *
 * 条形码组件 — 使用 jsbarcode 生成 Code128 条形码。
 *
 * ## 扫码枪兼容说明
 * 标准的条形码可以很好地被扫码枪识别。
 * 生产线/仓库场景建议使用条形码，通用性好、成本低。
 *
 * ## 切换回二维码
 * 若后续需要切换回二维码，替换此组件内容即可，
 * 或启用下方注释掉的 QRCode 方案。
 */
import { ref, watch, onMounted } from 'vue'
import JsBarcode from 'jsbarcode'

const props = defineProps({
  /** 要编码的文本（送货单号） */
  value: { type: String, required: true },
  /** 显示宽度 */
  width: { type: Number, default: 160 },
  /** 显示高度 */
  height: { type: Number, default: 50 }
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
  <canvas ref="canvasRef" :width="width" :height="height" />
</template>

<!--
==============================================================================
  如需切换回二维码，取消下方注释并删除上方内容即可：
==============================================================================
<script setup>
import { ref, watch, onMounted } from 'vue'
import QRCode from 'qrcode'

const props = defineProps({
  value: { type: String, required: true },
  width: { type: Number, default: 80 },
  height: { type: Number, default: 80 }
})

const imgSrc = ref('')

async function renderQR() {
  if (!props.value) return
  const content = `http://srm/receive?deliveryNo=${props.value}`
  imgSrc.value = await QRCode.toDataURL(content, {
    width: props.width,
    margin: 1,
    color: { dark: '#000', light: '#fff' }
  })
}

watch(() => props.value, renderQR)
onMounted(renderQR)
</script>

<template>
  <img v-if="imgSrc" :src="imgSrc" :width="width" :height="height" alt="二维码" />
  <span v-else>二维码</span>
</template>
-->
