import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { useTaskStore } from './store/useTaskStore'

export default function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    // 每天首次打开时执行"顺延革新"：把过期未完成的任务顺延到今天
    useTaskStore.getState().initializeForToday(new Date())
  })

  return children
}
