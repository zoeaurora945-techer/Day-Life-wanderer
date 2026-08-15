export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/quadrant/index',
    'pages/weekly/index',
    'pages/life/index',
  ],
  window: {
    navigationBarTitleText: '四象限周复盘',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f5f5f5',
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#07c160',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/index/index', text: '概览' },
      { pagePath: 'pages/quadrant/index', text: '四象限' },
      { pagePath: 'pages/weekly/index', text: '周复盘' },
      { pagePath: 'pages/life/index', text: '人生主线' },
    ],
  },
})
