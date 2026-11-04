export const groups={
  campus:{name:'校园与学习',index:'01',intro:'我从采访里学会组织材料，又尝试用已有图纸约束 AI。点「设计 × AI」，能看到当时的建筑作品。',layers:[
    {id:'media',name:'新媒体实践',time:'2024.09—2025.06',tag:'组织 · 表达',text:'在重庆大学建筑城规学院参与新媒体与采访工作，统筹内容生产和跨校活动，把复杂信息转化为清晰表达。',foot:'校园经历',kind:'media'},
    {id:'competition',name:'设计 × AI',time:'2025',tag:'约束 · 迭代',text:'以已有设计图纸与要点约束 AI，迭代分析图及效果表达，在不改变设计事实的前提下提升逻辑与视觉质量。',foot:'第 13 届未来设计师 NCDA 大赛：省级一等奖 · 中国区三等奖（同一作品）',kind:'design'},
    {id:'learning',name:'主动学习 AI',time:'已完成相关课程学习',tag:'自驱 · 跨界',text:'完成机器学习、深度学习与强化学习相关课程学习，将技术理解带回 AI 产品与独立工具的实践。',foot:'从建筑设计走向 AI 产品',kind:'learning'}
  ]},
  internships:{name:'在真实业务中实践',index:'02',intro:'在 OPPO 查数据为何波动，在 Zeemo 看创作者为何中途离开，在猿辅导检查课堂总结是否说到了学生的难处。',layers:[
    {id:'oppo',name:'OPPO',focus:'商业化数据分析',role:'产品运营',time:'2025.07—2025.10',tag:'商业化 · 数据分析',text:'参与 IAA 竞价验证与异常归因，独立负责应用商店核心资源位投放。',foot:'商业平台部 · 产品运营',kind:'data'},
    {id:'zeemo',name:'Zeemo',focus:'AI 视频创作体验',role:'AI 产品经理',time:'2025.10—2026.01',tag:'AIGC · 创作体验',text:'面向海外创作者，推进 AIGC 视频生成平台 Web 端的编辑功能交付、Prompt 输入引导与视频模板建设。',foot:'AIGC 产品部 · AI 产品经理',kind:'video',link:'https://zeemo.ai/',linkText:'访问 Zeemo 官网'},
    {id:'yuan',name:'猿辅导',focus:'AI 教学交互与评测',role:'AI 产品经理',time:'2026.03—2026.07',tag:'交互设计 · 生成评测',text:'围绕 AI Native 教育产品 1.0—2.0 迭代，推进生成评测、课程交互与商业问题分析。',foot:'AI 产品经理',kind:'classroom',link:'https://www.xiaoyuanai1v1.com/#/',linkText:'访问产品官网'}
  ]},
  projects:{name:'把想法做成工具',index:'03',intro:'读资讯、定选题、记投递，都是我想省下重复劳动的事。选一件打开，既能读做法，也能试成品。',layers:[
    {id:'daily',name:'AI 日报网站',time:'2026.04',tag:'信息聚合 · AI 工作流',text:'把分散的 AI 资讯组织为定时采集、主题分类与结构化生成的流程，让行业信息更便于集中阅读。',foot:'使用 Claude Code 开发 · LLM API 集成',kind:'news',link:'https://liz-lu.github.io/ai-daily-report/daily-briefs/index.html',linkText:'阅读 AI 日报'},
    {id:'topic',name:'AI 选题搭子',time:'2026.07',tag:'需求拆解 · MVP',text:'结合账号定位与热点信息，把选题、拍摄、剪辑和发布串成执行方案，帮助创作者从“想做什么”走向“如何做”。',foot:'使用 Claude Code 开发 · DeepSeek API',kind:'workflow',link:'https://liz-lu.github.io/ai-daily-report/duxiaoman-submission/%E5%BA%A6%E5%B0%8F%E6%BB%A1%E7%AC%94%E8%AF%95-MVP%E5%8E%9F%E5%9E%8B.html',linkText:'体验 AI 选题搭子'},
    {id:'jobs',name:'AI 求职工作台',time:'2026 秋招',tag:'信息组织 · 求职管理',text:'将招聘入口、投递记录和进度追踪集中到同一工作台，减少求职过程中信息分散与重复整理。',foot:'从自身求职需求出发的工具实践',kind:'dashboard',link:'https://liz-lu.github.io/ai-daily-report/campus-jobs/',linkText:'打开 AI 求职工作台'}
  ]}
};
