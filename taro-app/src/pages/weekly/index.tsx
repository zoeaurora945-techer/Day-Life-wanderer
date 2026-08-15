import { useEffect, useState, type ReactNode } from 'react'
import { Text, View, ScrollView, Textarea, Input, Button } from '@tarojs/components'
import { useShareAppMessage } from '@tarojs/taro'
import { useTaskStore } from '../../store/useTaskStore'
import {
  getWeekRangeForDate,
  formatDateKey,
  getWeekNumberOfYear,
} from '../../utils/dateUtils'
import type { WeeklyReview } from '../../types/task'

export default function Weekly() {
  useShareAppMessage(() => ({
    title: '我的本周复盘 · 四象限周复盘',
    path: '/pages/weekly/index',
  }))

  const weeklyReviews = useTaskStore((s) => s.weeklyReviews)
  const upsertWeeklyReview = useTaskStore((s) => s.upsertWeeklyReview)
  const updateWeeklyReview = useTaskStore((s) => s.updateWeeklyReview)
  const addNextAction = useTaskStore((s) => s.addNextAction)
  const deleteNextAction = useTaskStore((s) => s.deleteNextAction)

  const [review, setReview] = useState<WeeklyReview | null>(null)
  const [newAction, setNewAction] = useState('')

  useEffect(() => {
    const { start, end } = getWeekRangeForDate(new Date())
    const weekStart = formatDateKey(start)
    const weekEnd = formatDateKey(end)
    const r = upsertWeeklyReview(weekStart, weekEnd)
    setReview(r)
  }, [upsertWeeklyReview])

  if (!review) return <View />

  const { week } = getWeekNumberOfYear(new Date())

  const handleUpdate = (patch: Partial<WeeklyReview>) => {
    updateWeeklyReview(review.id, patch)
    setReview({ ...review, ...patch })
  }

  const handleAddAction = () => {
    const content = newAction.trim()
    if (!content) return
    addNextAction(review.id, content)
    const updated = useTaskStore
      .getState()
      .weeklyReviews.find((r) => r.id === review.id)
    if (updated) setReview(updated)
    setNewAction('')
  }

  const handleDeleteAction = (actionId: string) => {
    deleteNextAction(review.id, actionId)
    const updated = useTaskStore
      .getState()
      .weeklyReviews.find((r) => r.id === review.id)
    if (updated) setReview(updated)
  }

  return (
    <ScrollView scrollY style={{ height: '100vh', backgroundColor: '#f5f5f5' }}>
      <View style={{ padding: '32rpx' }}>
        <Text style={{ fontSize: '44rpx', fontWeight: 'bold', color: '#222' }}>
          第 {week} 周复盘
        </Text>
        <Text style={{ fontSize: '24rpx', color: '#999', marginLeft: '16rpx' }}>
          {review.weekStartDate} ~ {review.weekEndDate}
        </Text>

        <Field label="本周亮点">
          <Textarea
            value={review.highlights}
            onInput={(e) => handleUpdate({ highlights: e.detail.value })}
            placeholder="做成了什么？有什么收获？"
            style={{
              backgroundColor: '#fff',
              borderRadius: '12rpx',
              padding: '20rpx',
              fontSize: '28rpx',
              width: '100%',
              minHeight: '140rpx',
            }}
          />
        </Field>

        <Field label="卡点与阻碍">
          <Textarea
            value={review.blockers}
            onInput={(e) => handleUpdate({ blockers: e.detail.value })}
            placeholder="卡在哪里？需要什么支持？"
            style={{
              backgroundColor: '#fff',
              borderRadius: '12rpx',
              padding: '20rpx',
              fontSize: '28rpx',
              width: '100%',
              minHeight: '140rpx',
            }}
          />
        </Field>

        <Text style={{ fontSize: '30rpx', fontWeight: 'bold', color: '#222', marginTop: '24rpx', display: 'block' }}>
          下周行动
        </Text>
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: '12rpx',
            padding: '20rpx',
            marginTop: '16rpx',
          }}
        >
          {review.nextActions.length === 0 && (
            <Text style={{ fontSize: '24rpx', color: '#ccc' }}>还没有行动项</Text>
          )}
          {review.nextActions.map((a) => (
            <View
              key={a.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: '14rpx 0',
                borderBottomWidth: '1rpx',
                borderBottomColor: '#f0f0f0',
                borderBottomStyle: 'solid',
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: '28rpx',
                  color: a.status === 'converted' ? '#07c160' : '#333',
                }}
              >
                {a.content}
                {a.status === 'converted' ? ' ✓' : ''}
              </Text>
              <Text
                onClick={() => handleDeleteAction(a.id)}
                style={{ fontSize: '26rpx', color: '#ff5b5b' }}
              >
                删
              </Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', marginTop: '16rpx' }}>
            <Input
              value={newAction}
              onInput={(e) => setNewAction(e.detail.value)}
              placeholder="添加一个行动项…"
              style={{
                flex: 1,
                backgroundColor: '#f5f5f5',
                borderRadius: '10rpx',
                padding: '16rpx',
                fontSize: '26rpx',
              }}
            />
            <Button
              onClick={handleAddAction}
              size="mini"
              style={{
                backgroundColor: '#07c160',
                color: '#fff',
                fontSize: '26rpx',
                marginLeft: '12rpx',
              }}
            >
              添加
            </Button>
          </View>
        </View>

        <Text style={{ fontSize: '22rpx', color: '#bbb', textAlign: 'center', display: 'block', margin: '30rpx 0 40rpx' }}>
          每周坚持复盘，人生主线会越来越清晰
        </Text>
      </View>
    </ScrollView>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: '24rpx' }}>
      <Text style={{ fontSize: '30rpx', fontWeight: 'bold', color: '#222', display: 'block', marginBottom: '12rpx' }}>
        {label}
      </Text>
      {children}
    </View>
  )
}
