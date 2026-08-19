import { useState } from 'react'
import { Text, View, ScrollView, Input, Button } from '@tarojs/components'
import { useShareAppMessage } from '@tarojs/taro'
import { useTaskStore } from '../../store/useTaskStore'

export default function Life() {
  useShareAppMessage(() => ({
    title: '我的人生主线 · 四象限周复盘',
    path: '/pages/life/index',
  }))

  const goals = useTaskStore((s) => s.goals)
  const projects = useTaskStore((s) => s.projects)
  const addGoal = useTaskStore((s) => s.addGoal)
  const deleteGoal = useTaskStore((s) => s.deleteGoal)
  const addProject = useTaskStore((s) => s.addProject)
  const deleteProject = useTaskStore((s) => s.deleteProject)

  const [goalTitle, setGoalTitle] = useState('')
  const [projectTitle, setProjectTitle] = useState('')

  const handleAddGoal = () => {
    const t = goalTitle.trim()
    if (!t) return
    addGoal({ title: t, notes: '' })
    setGoalTitle('')
  }

  const handleAddProject = () => {
    const t = projectTitle.trim()
    if (!t) return
    addProject({ title: t, notes: '' })
    setProjectTitle('')
  }

  return (
    <ScrollView scrollY style={{ height: '100vh', backgroundColor: '#f5f5f5' }}>
      <View style={{ padding: '32rpx' }}>
        <Text style={{ fontSize: '44rpx', fontWeight: 'bold', color: '#222' }}>
          人生主线
        </Text>
        <Text style={{ fontSize: '24rpx', color: '#999', marginLeft: '16rpx' }}>
          长期目标 → 中期项目 → 具体任务
        </Text>

        {/* 目标 */}
        <Text style={{ fontSize: '30rpx', fontWeight: 'bold', color: '#222', marginTop: '32rpx', display: 'block' }}>
          长期目标（{goals.length}）
        </Text>
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: '12rpx',
            padding: '20rpx',
            marginTop: '16rpx',
          }}
        >
          {goals.length === 0 && (
            <Text style={{ fontSize: '24rpx', color: '#ccc' }}>还没有长期目标</Text>
          )}
          {goals.map((g) => (
            <View
              key={g.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: '14rpx 0',
                borderBottomWidth: '1rpx',
                borderBottomColor: '#f0f0f0',
                borderBottomStyle: 'solid',
              }}
            >
              <View
                style={{
                  width: '12rpx',
                  height: '12rpx',
                  borderRadius: '6rpx',
                  backgroundColor: '#7c5cff',
                  marginRight: '16rpx',
                }}
              />
              <Text style={{ flex: 1, fontSize: '28rpx', color: '#333' }}>{g.title}</Text>
              <Text
                onClick={() => deleteGoal(g.id)}
                style={{ fontSize: '26rpx', color: '#ff5b5b' }}
              >
                删
              </Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', marginTop: '16rpx' }}>
            <Input
              value={goalTitle}
              onInput={(e) => setGoalTitle(e.detail.value)}
              placeholder="添加一个人生目标…"
              style={{
                flex: 1,
                backgroundColor: '#f5f5f5',
                borderRadius: '10rpx',
                padding: '16rpx',
                fontSize: '26rpx',
              }}
            />
            <Button
              onClick={handleAddGoal}
              size="mini"
              style={{
                backgroundColor: '#7c5cff',
                color: '#fff',
                fontSize: '26rpx',
                marginLeft: '12rpx',
              }}
            >
              添加
            </Button>
          </View>
        </View>

        {/* 项目 */}
        <Text style={{ fontSize: '30rpx', fontWeight: 'bold', color: '#222', marginTop: '32rpx', display: 'block' }}>
          中期项目（{projects.length}）
        </Text>
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: '12rpx',
            padding: '20rpx',
            marginTop: '16rpx',
          }}
        >
          {projects.length === 0 && (
            <Text style={{ fontSize: '24rpx', color: '#ccc' }}>还没有项目</Text>
          )}
          {projects.map((p) => (
            <View
              key={p.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: '14rpx 0',
                borderBottomWidth: '1rpx',
                borderBottomColor: '#f0f0f0',
                borderBottomStyle: 'solid',
              }}
            >
              <View
                style={{
                  width: '12rpx',
                  height: '12rpx',
                  borderRadius: '6rpx',
                  backgroundColor: '#ff9f43',
                  marginRight: '16rpx',
                }}
              />
              <Text style={{ flex: 1, fontSize: '28rpx', color: '#333' }}>{p.title}</Text>
              <Text
                onClick={() => deleteProject(p.id)}
                style={{ fontSize: '26rpx', color: '#ff5b5b' }}
              >
                删
              </Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', marginTop: '16rpx' }}>
            <Input
              value={projectTitle}
              onInput={(e) => setProjectTitle(e.detail.value)}
              placeholder="添加一个项目…"
              style={{
                flex: 1,
                backgroundColor: '#f5f5f5',
                borderRadius: '10rpx',
                padding: '16rpx',
                fontSize: '26rpx',
              }}
            />
            <Button
              onClick={handleAddProject}
              size="mini"
              style={{
                backgroundColor: '#ff9f43',
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
          目标与项目越清晰，每周的任务越有方向
        </Text>
      </View>
    </ScrollView>
  )
}
