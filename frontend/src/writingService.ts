export const contentTypes = ['社交媒体文案', '文章创作', '广告文案', '产品介绍', '短视频脚本'] as const
export interface WritingBrief {
  type: typeof contentTypes[number]
  topic: string
  audience: string
  tone: string
  length: string
  points: string
}
export interface WritingResult { text: string; source: 'demo' | 'ai' }
// Replace this adapter with the future /api/v1 writing endpoint; no API key belongs in the client.
export interface WritingService { generate(brief: WritingBrief): Promise<WritingResult> }
export const demoWritingService: WritingService = {
  async generate(b) {
    const topic = b.topic.trim()
    if (!topic) throw new Error('请先填写主题或创作需求。')
    const audience = b.audience.trim() || '目标读者'
    const points = b.points.trim().split(/\n/).filter(Boolean)
    const detail = points.length ? points.map(p => `• ${p}`).join('\n') : '• 在这里补充具体场景、真实信息与核心价值。'
    const opening = b.tone === '轻松亲切' ? `和${audience}聊聊：${topic}。` : b.tone === '活泼有趣' ? `${audience}，准备好发现「${topic}」了吗？` : b.tone === '温暖走心' ? `写给${audience}：让「${topic}」走进生活。` : `面向${audience}，聚焦「${topic}」。`
    const bodies: Record<WritingBrief['type'], string> = {
      '社交媒体文案': `${topic}｜分享一个新灵感\n\n${opening}\n\n${detail}\n\n你最关注哪一点？欢迎分享你的想法。\n#灵感分享 #创作记录`,
      '文章创作': `${topic}\n\n引言\n${opening}\n\n一、为什么关注这个话题\n从读者的实际需求出发，补充背景与问题。\n\n二、核心观点\n${detail}\n\n三、行动建议\n结合真实案例，给读者一个可执行的下一步。\n\n结语\n回到「${topic}」，写下你的观察与建议。`,
      '广告文案': `${topic}\n让需求，找到新的可能。\n\n${opening}\n\n核心信息\n${detail}\n\n行动引导：了解详情，选择适合你的方案。\n[发布前请核实功效、价格和活动条件]`,
      '产品介绍': `${topic}｜产品介绍\n\n${opening}\n\n产品概述\n[补充产品定位和使用场景]\n\n核心特点\n${detail}\n\n适用人群\n${audience}\n\n使用方式\n[补充真实操作步骤及注意事项]`,
      '短视频脚本': `${topic}｜短视频脚本\n\n镜头一 · 开场\n画面：[展示主题相关场景]\n口播：${opening}\n\n镜头二 · 核心展示\n画面：[用特写呈现重点]\n口播要点：\n${detail}\n\n镜头三 · 收尾\n画面：[回到主角或产品]\n口播：关于「${topic}」，你还想了解什么？\n字幕：[补充行动引导]`,
    }
    const expansion = b.length === '简短' ? '' : `\n\n补充段落\n围绕「${topic}」，加入一个与${audience}相关的真实场景，说明问题、选择和结果。`
    return { source: 'demo', text: `【模板演示 · 非 AI 生成】\n风格：${b.tone}｜篇幅：${b.length}\n\n${bodies[b.type]}${expansion}${b.length === '详细' ? '\n\n延展思路\n[补充背景资料、对比分析与可核实的案例，让表达更完整。]' : ''}` }
  },
}
