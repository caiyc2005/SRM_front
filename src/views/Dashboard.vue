<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'
import * as echarts from 'echarts'

const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
const userName = userInfo.userName || 'admin'

const currentTime = ref('')
let clockTimer = null

const stats = ref({ totalOrders:0, pendingOrders:0, pendingDelivery:0, totalDeliveries:0, totalReceives:0, suppliers:0 })

async function fetchStats() {
  const t = localStorage.getItem('token')
  const h = { 'Content-Type':'application/json', ...(t?{'Authorization':`Bearer ${t}`}:{}) }
  const r = await Promise.allSettled([
    fetch('/api/Orders/GetOrdersByList', {method:'POST',headers:h,body:'{"pageIndex":1,"pageSize":1}'}),
    fetch('/api/Orders/GetOrdersByList', {method:'POST',headers:h,body:'{"status":0,"pageIndex":1,"pageSize":1}'}),
    fetch('/api/Orders/GetOrdersByList', {method:'POST',headers:h,body:'{"status":2,"pageIndex":1,"pageSize":1}'}),
    fetch('/api/Delivery/GetDeliveryNote', {method:'POST',headers:h,body:'{"page":1,"pageSize":1}'}),
    fetch('/api/Receive/GetReceivesList', {method:'POST',headers:h,body:'{"page":1,"pageSize":10}'}),
    fetch('/api/Supplier/GetAllSuppliers', {method:'POST',headers:h}),
  ])
  try{if(r[0].status==='fulfilled'){const j=JSON.parse(await r[0].value.text());if(j.success)stats.value.totalOrders=j.data.total||0}}catch{}
  try{if(r[1].status==='fulfilled'){const j=JSON.parse(await r[1].value.text());if(j.success)stats.value.pendingOrders=j.data.total||0}}catch{}
  try{if(r[2].status==='fulfilled'){const j=JSON.parse(await r[2].value.text());if(j.success)stats.value.pendingDelivery=j.data.total||0}}catch{}
  try{if(r[3].status==='fulfilled'){const j=JSON.parse(await r[3].value.text());if(j.code===200)stats.value.totalDeliveries=j.data.total||0}}catch{}
  try{if(r[4].status==='fulfilled'){const j=JSON.parse(await r[4].value.text());if(j.code===200)stats.value.totalReceives=j.data.total||(j.data.items?.length||0)}}catch{}
  try{if(r[5].status==='fulfilled'){const j=JSON.parse(await r[5].value.text());if(j.success)stats.value.suppliers=j.data.length||0}}catch{}
}

const completionRate = computed(()=>stats.value.totalOrders?Math.round((stats.value.totalOrders-stats.value.pendingOrders)/stats.value.totalOrders*100):0)
const deliveryRate = computed(()=>stats.value.totalOrders?Math.round(stats.value.totalDeliveries/stats.value.totalOrders*100):0)
const receiveRate = computed(()=>stats.value.totalDeliveries?Math.min(Math.round(stats.value.totalReceives/stats.value.totalDeliveries*100),100):0)

function tick(){
  const n=new Date();const w=['日','一','二','三','四','五','六']
  currentTime.value=`${n.getFullYear()}年${String(n.getMonth()+1).padStart(2,'0')}月${String(n.getDate()).padStart(2,'0')}日 星期${w[n.getDay()]} ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`
}

// ===== 图表 =====
let barChart = null, lineChart = null, pieChart = null

function initCharts() {
  nextTick(() => {
    initBarChart()
    initLineChart()
    initPieChart()
  })
}

function initBarChart() {
  const el = document.getElementById('chart-bar')
  if (!el) return
  barChart = echarts.init(el)
  const s = stats.value
  barChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(5,10,21,.9)', borderColor: 'rgba(0,200,255,.3)', textStyle: { color: '#c8d6e5' } },
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: ['待确认', '待发货', '收料记录'], axisLabel: { color: '#909399', fontWeight:500 }, axisLine: { lineStyle: { color: '#dcdfe6' } } },
    yAxis: { type: 'value', minInterval:1, axisLabel: { color: '#909399' }, splitLine: { lineStyle: { color: '#ebeef5' } } },
    series: [{
      type: 'bar', barWidth: '45%',
      data: [
        { value: s.pendingOrders, itemStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#f0c040'},{offset:1,color:'#e6a23c'}]) } },
        { value: s.pendingDelivery, itemStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#60d080'},{offset:1,color:'#45a060'}]) } },
        { value: s.totalReceives, itemStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#6090f0'},{offset:1,color:'#4060c0'}]) } }
      ],
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } }
    }]
  })
}

function initLineChart() {
  const el = document.getElementById('chart-line')
  if (!el) return
  lineChart = echarts.init(el)
  const s = stats.value
  const confirmed = s.totalOrders - s.pendingOrders
  const shipped = s.totalDeliveries || 0
  const received = s.totalReceives || 0
  lineChart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(5,10,21,.9)', borderColor: 'rgba(0,200,255,.3)', textStyle: { color: '#c8d6e5' } },
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: ['采购订单', '已确认', '已发货', '已收货'], axisLabel: { color: '#909399', fontWeight:500 }, axisLine: { lineStyle: { color: '#dcdfe6' } } },
    yAxis: { type: 'value', minInterval:1, axisLabel: { color: '#909399' }, splitLine: { lineStyle: { color: '#ebeef5' } } },
    series: [{
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 8,
      lineStyle: { color: '#409eff', width: 3 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(64,158,255,.4)'},{offset:1,color:'rgba(64,158,255,.05)'}]) },
      data: [s.totalOrders, confirmed, shipped, received],
      emphasis: { focus: 'series', itemStyle: { shadowBlur: 10, shadowColor: 'rgba(64,158,255,.5)' } }
    }]
  })
}

function initPieChart() {
  const el = document.getElementById('chart-pie')
  if (!el) return
  pieChart = echarts.init(el)
  const s = stats.value
  const confirmed = s.totalOrders - s.pendingOrders
  const shipped = s.totalDeliveries || 0
  const received = s.totalReceives || 0
  pieChart.setOption({
    tooltip: { trigger: 'item', backgroundColor: 'rgba(5,10,21,.9)', borderColor: 'rgba(0,200,255,.3)', textStyle: { color: '#c8d6e5' }, formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'],
      label: { color: '#606266', fontSize: 12, formatter: '{b}' },
      emphasis: {
        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.4)' },
        label: { fontSize: 14, fontWeight: 'bold' }
      },
      data: [
        { value: s.pendingOrders, name: '待确认', itemStyle: { color: '#e6a23c' } },
        { value: s.pendingDelivery, name: '待发货', itemStyle: { color: '#67c23a' } },
        { value: confirmed, name: '已确认', itemStyle: { color: '#409eff' } },
        { value: shipped, name: '已发货', itemStyle: { color: '#9b59b6' } },
        { value: received, name: '已收货', itemStyle: { color: '#1abc9c' } },
        { value: s.totalOrders, name: '采购订单', itemStyle: { color: '#3498db' } }
      ]
    }]
  })
}

function resizeCharts() {
  barChart?.resize()
  lineChart?.resize()
  pieChart?.resize()
}

onMounted(()=>{
  tick();clockTimer=setInterval(tick,1000)
  fetchStats().then(() => {
    nextTick(() => initCharts())
  })
  addEventListener('resize', resizeCharts)
})
onBeforeUnmount(()=>{
  clearInterval(clockTimer);removeEventListener('resize', resizeCharts)
  barChart?.dispose(); lineChart?.dispose(); pieChart?.dispose()
})
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <div class="main">
      <div class="header"><h3>主数据看板</h3><Logout /></div>
      <div class="content">
        <!-- Banner -->
        <div class="banner">
          <div><h1 class="b-title">供应链数据管理中心</h1><p class="b-sub">实时数据总览 · 关键指标一目了然</p></div>
          <div class="b-right"><div class="b-time">{{ currentTime }}</div><div class="b-user">您好，{{ userName }}</div></div>
        </div>

        <!-- 订单完成进度 -->
        <div class="rate-group-card">
          <div class="rate-group-title">📈 订单完成进度</div>
          <div class="rate-group-body">
            <div class="rate-item">
              <div class="ri-label"><span class="ri-dot" style="background:#409eff"></span>确认率</div>
              <div class="rate-wrap"><div class="rate-bg"><div class="rate-fg" style="background:#409eff" :style="{width:completionRate+'%'}"></div></div><span class="rate-num" style="color:#409eff;">{{ completionRate }}%</span></div>
            </div>
            <div class="rate-item">
              <div class="ri-label"><span class="ri-dot" style="background:#67c23a"></span>发货率</div>
              <div class="rate-wrap"><div class="rate-bg"><div class="rate-fg" style="background:#67c23a" :style="{width:deliveryRate+'%'}"></div></div><span class="rate-num" style="color:#67c23a;">{{ deliveryRate }}%</span></div>
            </div>
            <div class="rate-item">
              <div class="ri-label"><span class="ri-dot" style="background:#e6a23c"></span>收货率</div>
              <div class="rate-wrap"><div class="rate-bg"><div class="rate-fg" style="background:#e6a23c" :style="{width:receiveRate+'%'}"></div></div><span class="rate-num" style="color:#e6a23c;">{{ receiveRate }}%</span></div>
            </div>
          </div>
        </div>

        <!-- 折线图 -->
        <div class="charts-row">
          <div class="chart-box chart-full">
            <div class="chart-box-title">📉 订单流转趋势</div>
            <div id="chart-line" style="width:100%;height:240px;"></div>
          </div>
        </div>

        <!-- 柱状图 + 饼图 -->
        <div class="charts-row">
          <div class="chart-box">
            <div class="chart-box-title">📊 待处理事项</div>
            <div id="chart-bar" style="width:100%;height:240px;"></div>
          </div>
          <div class="chart-box">
            <div class="chart-box-title">🧩 订单状态分布</div>
            <div id="chart-pie" style="width:100%;height:240px;"></div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.layout{display:flex;min-height:100vh}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.header{height:60px;background:#fff;padding:0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eee}
.content{padding:20px;flex:1;overflow-y:auto;background:#f0f4f8}

.banner{background:linear-gradient(135deg,#2b7af0,#1a5cc8);border-radius:12px;padding:28px 32px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;color:#fff;box-shadow:0 4px 16px rgba(43,122,240,.3)}
.b-title{font-size:22px;font-weight:700;margin:0 0 4px;letter-spacing:1px}
.b-sub{font-size:13px;opacity:.85;margin:0}
.b-right{text-align:right}
.b-time{font-size:14px;font-family:'SF Mono','Cascadia Code','Consolas',monospace;opacity:.9}
.b-user{font-size:15px;font-weight:600;margin-top:4px}

.rate-group-card{background:#fff;border-radius:10px;padding:18px 22px;border:1px solid #ebeef5;margin-bottom:20px;transition:all .25s}
.rate-group-card:hover{box-shadow:0 2px 12px rgba(0,0,0,.06)}
.rate-group-title{font-size:14px;font-weight:600;color:#303133;margin-bottom:14px;letter-spacing:.5px}
.rate-group-body{display:flex;flex-direction:column;gap:12px}
.ri-label{font-size:12px;color:#606266;margin-bottom:6px;display:flex;align-items:center;gap:6px;font-weight:500}
.ri-dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0}
.rate-wrap{display:flex;align-items:center;gap:8px}
.rate-bg{flex:1;height:6px;background:#ebeef5;border-radius:3px;overflow:hidden}
.rate-fg{height:100%;border-radius:3px;transition:width .6s ease}
.rate-num{font-size:13px;font-weight:700;min-width:36px;text-align:right}

.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}
.chart-box{background:#fff;border-radius:10px;padding:16px 18px;border:1px solid #ebeef5;transition:all .25s}
.chart-box:hover{box-shadow:0 2px 12px rgba(0,0,0,.06)}
.chart-full{grid-column:1 / -1}
.chart-box-title{font-size:13px;font-weight:600;color:#303133;margin-bottom:8px}

@media(max-width:768px){.charts-row{grid-template-columns:1fr}.banner{flex-direction:column;text-align:center;gap:8px}}
</style>
