import { useEffect, useState } from 'react'
import { Text, View, ScrollView } from '@tarojs/components'
import { useShareAppMessage } from '@tarojs/taro'
import { useTaskStore } from '../../store/useTaskStore'
import {
  computeUrgent,
  getOverallCategoryProgress,
} from '../../utils/taskUtils'

const CATEGORIES: { key: 'research' | 'work' | 'life'; label: string; color: string }[] = [
  { key: 'research', label: '研究', color: '#7c5cff' },
  { key: 'work', label: '工作', color: '#07c160' },
  { key: 'life', label: '生活', color: '#ff9f43' },
]

export default function Index() {
  useShareAppMessage(() => ({
    title: '四象限周复盘 · 人生主线',
    path: '/pages/index/index',
  }))

  const tasks = useTaskStore((s) => s.tasks)
  const goals = useTaskStore((s) => s.goals)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const urgent = tasks.filter((t) => computeUrgent(t, now)).length
  const progress = total === 0 ? 0 : done / total

  return (
    <ScrollView scrollY style={{ height: '100vh', backgroundColor: '#f5f5f5' }}>
      <View style={{ padding: '32rpx' }}>
        <Text style={{ fontSize: '44rpx', fontWeight: 'bold', color: '#222' }}>
          四象限周复盘
        </Text>
        <Text style={{ fontSize: '26rpx', color: '#999', marginLeft: '16rpx' }}>
          人生主线
        </Text>

        {/* 总进度卡片 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: '20rpx',
            padding: '32rpx',
            marginTop: '24rpx',
            boxShadow: '0 4rpx 16rpx rgba(0,0,0,0.04)',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: '30rpx', fontWeight: 'bold', color: '#222' }}>
              总体完成度
            </Text>
            <Text style={{ fontSize: '30rpx', color: '#07c160', fontWeight: 'bold' }}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
          <View
            style={{
              height: '16rpx',
              backgroundColor: '#eee',
              borderRadius: '8rpx',
              marginTop: '20rpx',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${progress * 100}%`,
                backgroundColor: '#07c160',
                borderRadius: '8rpx',
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              marginTop: '24rpx',
              justifyContent: 'space-around',
            }}
          >
            <Stat label="任务总数" value={total} color="#222" />
            <Stat label="已完成" value={done} color="#07c160" />
            <Stat label="今日紧急" value={urgent} color="#ff5b5b" />
            <Stat label="人生目标" value={goals.length} color="#7c5cff" />
          </View>
        </View>

        {/* 分类进度 */}
        <Text style={{ fontSize: '30rpx', fontWeight: 'bold', color: '#222', marginTop: '32rpx', display: 'block' }}>
          分类进度
        </Text>
        {CATEGORIES.map((c) => {
          const p = getOverallCategoryProgress(tasks, c.key)
          const pct = p === null ? 0 : p
          return (
            <View
              key={c.key}
              style={{
                backgroundColor: '#fff',
                borderRadius: '16rpx',
                padding: '24rpx',
                marginTop: '16rpx',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: '16rpx',
                  height: '16rpx',
                  borderRadius: '8rpx',
                  backgroundColor: c.color,
                  marginRight: '20rpx',
                }}
              />
              <Text style={{ fontSize: '28rpx', color: '#333', width: '120rpx' }}>
                {c.label}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: '12rpx',
                  backgroundColor: '#eee',
                  borderRadius: '6rpx',
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${pct * 100}%`,
                    backgroundColor: c.color,
                  }}
                />
              </View>
              <Text style={{ fontSize: '26rpx', color: '#999', marginLeft: '16rpx' }}>
                {Math.round(pct * 100)}%
              </Text>
            </View>
          )
        })}

        <Text style={{ fontSize: '24rpx', color: '#bbb', marginTop: '40rpx', display: 'block', textAlign: 'center' }}>
          数据保存在本机 · 切换底部标签开始使用
        </Text>
      </View>
    </ScrollView>
  )
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: '40rpx', fontWeight: 'bold', color }}>{value}</Text>
      <Text style={{ fontSize: '22rpx', color: '#999', marginTop: '6rpx' }}>{label}</Text>
    </View>
  )
}
