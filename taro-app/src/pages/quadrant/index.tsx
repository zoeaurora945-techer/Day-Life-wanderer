import { useState } from 'react'
import { Text, View, ScrollView, Input, Button, Switch, Picker } from '@tarojs/components'
import { useShareAppMessage } from '@tarojs/taro'
import { useTaskStore } from '../../store/useTaskStore'
import { getTaskQuadrant } from '../../utils/taskUtils'
import { formatDateKey } from '../../utils/dateUtils'
import type { Category, Importance, Quadrant, Task } from '../../types/task'

const QUADRANTS: { key: Quadrant; title: string; desc: string; color: string }[] = [
  { key: 'Q1_IMPORTANT_URGENT', title: '重要且紧急', desc: '立即处理', color: '#ff5b5b' },
  { key: 'Q3_IMPORTANT_NOTURGENT', title: '重要不紧急', desc: '规划投入', color: '#ff9f43' },
  { key: 'Q2_NOTIMPORTANT_URGENT', title: '紧急不重要', desc: '委托/快速处理', color: '#ffd166' },
  { key: 'Q4_NOTIMPORTANT_NOTURGENT', title: '不重要不紧急', desc: '少做或删除', color: '#8ecae6' },
]

const CATEGORY_LABELS: Record<Category, string> = {
  research: '研究',
  work: '工作',
  life: '生活',
}

export default function Quadrant() {
  useShareAppMessage(() => ({
    title: '四象限周复盘 · 人生主线',
    path: '/pages/quadrant/index',
  }))

  const tasks = useTaskStore((s) => s.tasks)
  const addTask = useTaskStore((s) => s.addTask)
  const toggleTaskStatus = useTaskStore((s) => s.toggleTaskStatus)
  const deleteTask = useTaskStore((s) => s.deleteTask)

  const now = new Date()
  const [title, setTitle] = useState('')
  const [important, setImportant] = useState(true)
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [time, setTime] = useState('09:00')

  const grouped: Record<Quadrant, Task[]> = {
    Q1_IMPORTANT_URGENT: [],
    Q2_NOTIMPORTANT_URGENT: [],
    Q3_IMPORTANT_NOTURGENT: [],
    Q4_NOTIMPORTANT_NOTURGENT: [],
  }
  for (const t of tasks) {
    const q = getTaskQuadrant(t, now)
    if (q) grouped[q].push(t)
  }

  const handleAdd = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    const todayKey = formatDateKey(now)
    const [h, m] = time.split(':').map(Number)
    const due = new Date(now)
    due.setHours(h, m, 0, 0)
    const categories: Category[] = ['research', 'work', 'life']
    addTask({
      title: trimmed,
      dueAt: due.toISOString(),
      importance: (important ? 'important' : 'not_important') as Importance,
      category: categories[categoryIndex],
      status: 'todo',
      urgentMode: 'auto',
      urgentManual: null,
    })
    setTitle('')
  }

  return (
    <ScrollView scrollY style={{ height: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* 添加任务 */}
      <View
        style={{
          backgroundColor: '#fff',
          margin: '24rpx',
          borderRadius: '20rpx',
          padding: '24rpx',
        }}
      >
        <Input
          value={title}
          onInput={(e) => setTitle(e.detail.value)}
          placeholder="输入任务标题…"
          style={{
            backgroundColor: '#f5f5f5',
            borderRadius: '12rpx',
            padding: '20rpx',
            fontSize: '28rpx',
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: '20rpx',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: '26rpx', color: '#666' }}>重要</Text>
            <Switch
              checked={important}
              onChange={(e) => setImportant(e.detail.value)}
              color="#07c160"
              style={{ transform: 'scale(0.8)' }}
            />
          </View>
          <Picker
            mode="selector"
            range={['研究', '工作', '生活']}
            value={categoryIndex}
            onChange={(e) => setCategoryIndex(Number(e.detail.value))}
          >
            <View
              style={{
                backgroundColor: '#f5f5f5',
                borderRadius: '10rpx',
                padding: '12rpx 24rpx',
              }}
            >
              <Text style={{ fontSize: '26rpx', color: '#333' }}>
                {['研究', '工作', '生活'][categoryIndex]}
              </Text>
            </View>
          </Picker>
          <Picker
            mode="time"
            value={time}
            onChange={(e) => setTime(e.detail.value)}
          >
            <View
              style={{
                backgroundColor: '#f5f5f5',
                borderRadius: '10rpx',
                padding: '12rpx 24rpx',
              }}
            >
              <Text style={{ fontSize: '26rpx', color: '#333' }}>{time}</Text>
            </View>
          </Picker>
        </View>
        <Button
          onClick={handleAdd}
          size="mini"
          style={{
            marginTop: '20rpx',
            backgroundColor: '#07c160',
            color: '#fff',
            fontSize: '28rpx',
          }}
        >
          添加任务
        </Button>
      </View>

      {/* 2x2 象限 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: '0 12rpx' }}>
        {QUADRANTS.map((q) => (
          <View
            key={q.key}
            style={{
              width: '50%',
              padding: '12rpx',
              boxSizing: 'border-box',
            }}
          >
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: '16rpx',
                minHeight: '260rpx',
                padding: '20rpx',
                borderTopWidth: '6rpx',
                borderTopColor: q.color,
                borderTopStyle: 'solid',
              }}
            >
              <Text style={{ fontSize: '28rpx', fontWeight: 'bold', color: q.color }}>
                {q.title}
              </Text>
              <Text style={{ fontSize: '22rpx', color: '#bbb', marginLeft: '12rpx' }}>
                {q.desc}
              </Text>
              <View style={{ marginTop: '12rpx' }}>
                {grouped[q.key].length === 0 && (
                  <Text style={{ fontSize: '24rpx', color: '#ccc' }}>暂无任务</Text>
                )}
                {grouped[q.key].map((t) => (
                  <View
                    key={t.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: '12rpx 0',
                      borderBottomWidth: '1rpx',
                      borderBottomColor: '#f0f0f0',
                      borderBottomStyle: 'solid',
                    }}
                  >
                    <Text
                      onClick={() => toggleTaskStatus(t.id)}
                      style={{
                        fontSize: '28rpx',
                        color: '#333',
                        flex: 1,
                        textDecoration: 'none',
                      }}
                    >
                      {t.title}
                    </Text>
                    <Text
                      style={{ fontSize: '22rpx', color: '#999', marginRight: '12rpx' }}
                    >
                      {CATEGORY_LABELS[t.category]}
                    </Text>
                    <Text
                      onClick={() => deleteTask(t.id)}
                      style={{ fontSize: '26rpx', color: '#ff5b5b' }}
                    >
                      删
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </View>
      <Text style={{ fontSize: '22rpx', color: '#bbb', textAlign: 'center', display: 'block', margin: '20rpx 0 40rpx' }}>
        点击任务文字即可标记完成
      </Text>
    </ScrollView>
  )
}
